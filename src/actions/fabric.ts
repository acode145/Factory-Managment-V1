"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { yardsToMeters, metersToYards } from "@/lib/units";

// Helper for generating sequential-style formatted codes
function generateCode(prefix: string) {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 90 + 10);
  return `${prefix}-${timestamp}${random}`;
}

/**
 * Deterministic business date & sequence parser for factory transactions.
 * Sequence offsets ensure proper intra-day chronology on the same calendar date:
 * 0: PARTY_INWARD (+Deposit)
 * 1: INWARD_SHORTAGE (-Dock loss)
 * 2: OUTWARD_TO_VENDOR (-Outsource dispatch)
 * 3: INWARD_FROM_VENDOR (+Vendor return)
 * 4: DELIVERY_TO_PARTY (-Customer delivery)
 * 5: GENERAL ADJUSTMENT
 */
function parseLedgerDate(dateStr?: string, sequenceOffsetSeconds = 0): Date {
  if (!dateStr) {
    const d = new Date();
    if (sequenceOffsetSeconds) {
      d.setSeconds(d.getSeconds() + sequenceOffsetSeconds);
    }
    return d;
  }
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts.map(Number);
    return new Date(Date.UTC(year, month - 1, day, 12, 0, sequenceOffsetSeconds, 0));
  }
  return new Date();
}

/**
 * Recalculate and synchronize all running balances for a party in strict chronological order.
 * Handles both CONTINUOUS fabric (meters) and PIECES (pcs) streams independently.
 */
export async function reconcilePartyLedger(tx: any, partyId: string) {
  const allEntries = await tx.fabricLedgerEntry.findMany({
    where: { partyId },
    orderBy: [
      { timestamp: "asc" },
      { createdAt: "asc" },
      { id: "asc" },
    ],
  });

  let runningMeters = 0;
  let runningPieces = 0;

  for (const entry of allEntries) {
    if (entry.itemCategory === "PIECES") {
      const credit = Number(entry.creditPieces || 0);
      const debit = Number(entry.debitPieces || 0);
      const shortage = Number(entry.shortagePieces || 0);
      runningPieces = runningPieces + credit - debit - shortage;

      if (entry.runningPieces !== runningPieces) {
        await tx.fabricLedgerEntry.update({
          where: { id: entry.id },
          data: { runningPieces },
        });
      }
    } else {
      // CONTINUOUS fabric
      const credit = Number(entry.creditMeters || 0);
      const debit = Number(entry.debitMeters || 0);
      const shrinkage = Number(entry.shrinkageMeters || 0);
      runningMeters = Number((runningMeters + credit - debit - shrinkage).toFixed(2));

      if (Number(entry.runningBalance) !== runningMeters) {
        await tx.fabricLedgerEntry.update({
          where: { id: entry.id },
          data: { runningBalance: runningMeters },
        });
      }
    }
  }
}

export type FabricActionState = {
  error?: string;
  success?: boolean;
  message?: string;
  data?: any;
};

// -----------------------------------------------------------------------------
// 1. PARTY FABRIC INWARD (GATE IN) - MULTI-ROW & MULTI-UOM (m, yd, pcs)
// -----------------------------------------------------------------------------
const InwardItemSchema = z.object({
  fabricType: z.string().trim().min(1, "Fabric type is required"),
  colorShade: z.string().trim().min(1, "Color / Shade is required"),
  unit: z.enum(["METERS", "YARDS", "PIECES"]).default("METERS"),
  rollCount: z.coerce.number().int().positive("Roll / bundle count must be greater than 0"),
  challanQty: z.coerce.number().positive("Party claimed quantity must be positive"),
  measuredQty: z.coerce.number().positive("Physical measured quantity must be positive"),
});

const InwardHeaderSchema = z.object({
  challanDate: z.string().optional(),
  partyId: z.string().min(1, "Party selection is required"),
  partyChallanNo: z.string().trim().min(1, "Party Challan # is required"),
  driverDetails: z.string().optional(),
  remarks: z.string().optional(),
});
export async function createPartyInwardAction(
  prevState: FabricActionState | null,
  formData: FormData
): Promise<FabricActionState> {
  const session = await requireAuth();

  const rawHeader = {
    challanDate: formData.get("challanDate") || undefined,
    partyId: formData.get("partyId"),
    partyChallanNo: formData.get("partyChallanNo"),
    driverDetails: formData.get("driverDetails") || undefined,
    remarks: formData.get("remarks") || undefined,
  };

  const parsedHeader = InwardHeaderSchema.safeParse(rawHeader);
  if (!parsedHeader.success) {
    return { error: parsedHeader.error.issues[0].message };
  }

  let itemsToCreate: Array<z.infer<typeof InwardItemSchema>> = [];
  const itemsPayloadStr = formData.get("itemsPayload") as string | null;

  if (itemsPayloadStr) {
    try {
      const parsedArray = JSON.parse(itemsPayloadStr);
      if (!Array.isArray(parsedArray) || parsedArray.length === 0) {
        return { error: "Please add at least one fabric / item row." };
      }
      for (let i = 0; i < parsedArray.length; i++) {
        const itemRes = InwardItemSchema.safeParse(parsedArray[i]);
        if (!itemRes.success) {
          return { error: `Item ${i + 1}: ${itemRes.error.issues[0].message}` };
        }
        itemsToCreate.push(itemRes.data);
      }
    } catch {
      return { error: "Invalid items payload format." };
    }
  } else {
    const singleRaw = {
      fabricType: formData.get("fabricType"),
      colorShade: formData.get("colorShade"),
      unit: (formData.get("unit") as string) || "METERS",
      rollCount: formData.get("rollCount"),
      challanQty: formData.get("challanMeters") || formData.get("challanQty"),
      measuredQty: formData.get("measuredMeters") || formData.get("measuredQty"),
    };
    const singleParsed = InwardItemSchema.safeParse(singleRaw);
    if (!singleParsed.success) {
      return { error: singleParsed.error.issues[0].message };
    }
    itemsToCreate.push(singleParsed.data);
  }

  const { challanDate, partyId, partyChallanNo, driverDetails, remarks } = parsedHeader.data;
  const dateClaimed = parseLedgerDate(challanDate, 0);
  const dateShortage = parseLedgerDate(challanDate, 1);
  const igpNumber = generateCode("IGP");

  let totalRolls = 0;
  let totalContinuousClaimedMeters = 0;
  let totalContinuousMeasuredMeters = 0;
  let totalContinuousShortageMeters = 0;

  for (const item of itemsToCreate) {
    totalRolls += item.rollCount;
    if (item.unit !== "PIECES") {
      const stdClaimed = item.unit === "YARDS" ? yardsToMeters(item.challanQty) : item.challanQty;
      const stdMeasured = item.unit === "YARDS" ? yardsToMeters(item.measuredQty) : item.measuredQty;
      const stdShort = Math.max(0, Number((stdClaimed - stdMeasured).toFixed(2)));

      totalContinuousClaimedMeters += stdClaimed;
      totalContinuousMeasuredMeters += stdMeasured;
      totalContinuousShortageMeters += stdShort;
    }
  }

  const primaryFabric =
    itemsToCreate.length === 1
      ? itemsToCreate[0].fabricType
      : `Multi-Item (${itemsToCreate.length} lots)`;
  const primaryColor =
    itemsToCreate.length === 1 ? itemsToCreate[0].colorShade : "Mixed";

  try {
    await prisma.$transaction(async (tx: any) => {
      const inward = await tx.fabricInward.create({
        data: {
          igpNumber,
          partyId,
          partyChallanNo,
          fabricType: primaryFabric,
          colorShade: primaryColor,
          rollCount: totalRolls,
          challanMeters: Number(totalContinuousClaimedMeters.toFixed(2)),
          measuredMeters: Number(totalContinuousMeasuredMeters.toFixed(2)),
          shortageMeters: Number(totalContinuousShortageMeters.toFixed(2)),
          challanDate: dateClaimed,
          driverDetails,
          remarks,
          receivedById: session.userId,
        },
      });

      for (let idx = 0; idx < itemsToCreate.length; idx++) {
        const item = itemsToCreate[idx];
        const shortageQty = Number((item.challanQty - item.measuredQty).toFixed(2));

        let stdMeters: number | null = null;
        let stdShortage: number = 0;

        if (item.unit === "YARDS") {
          stdMeters = yardsToMeters(item.measuredQty);
          stdShortage = shortageQty > 0 ? yardsToMeters(shortageQty) : 0;
        } else if (item.unit === "METERS") {
          stdMeters = item.measuredQty;
          stdShortage = shortageQty > 0 ? shortageQty : 0;
        }

        const inwardItem = await tx.fabricInwardItem.create({
          data: {
            inwardId: inward.id,
            itemIndex: idx,
            fabricType: item.fabricType,
            colorShade: item.colorShade,
            unit: item.unit,
            rollCount: item.rollCount,
            challanQty: item.challanQty,
            measuredQty: item.measuredQty,
            shortageQty: Math.max(0, shortageQty),
            standardMeters: stdMeters,
          },
        });

        if (item.unit === "PIECES") {
          await tx.fabricLedgerEntry.create({
            data: {
              partyId,
              partyChallanNo,
              inwardId: inward.id,
              inwardItemId: inwardItem.id,
              itemCategory: "PIECES",
              fabricDescription: `${item.fabricType} (${item.colorShade})`,
              unit: "PIECES",
              movementType: "PARTY_INWARD",
              referenceNumber: igpNumber,
              creditMeters: 0,
              debitMeters: 0,
              shrinkageMeters: 0,
              creditPieces: Math.round(item.challanQty),
              debitPieces: 0,
              shortagePieces: 0,
              runningPieces: 0,
              timestamp: dateClaimed,
              notes: `Inward Challan #${partyChallanNo} - ${item.rollCount} pkgs of ${item.fabricType} (${item.colorShade}) [Claimed: ${Math.round(item.challanQty)} pcs]`,
            },
          });

          if (shortageQty > 0) {
            await tx.fabricLedgerEntry.create({
              data: {
                partyId,
                partyChallanNo,
                inwardId: inward.id,
                inwardItemId: inwardItem.id,
                itemCategory: "PIECES",
                fabricDescription: `${item.fabricType} (${item.colorShade})`,
                unit: "PIECES",
                movementType: "INWARD_SHORTAGE",
                referenceNumber: igpNumber,
                creditMeters: 0,
                debitMeters: 0,
                shrinkageMeters: 0,
                creditPieces: 0,
                debitPieces: 0,
                shortagePieces: Math.round(shortageQty),
                runningPieces: 0,
                timestamp: dateShortage,
                notes: `Inward Shortage: #${partyChallanNo} ${item.fabricType} claimed ${Math.round(item.challanQty)} pcs vs measured ${Math.round(item.measuredQty)} pcs (-${Math.round(shortageQty)} pcs)`,
              },
            });
          }
        } else {
          const stdClaimed = item.unit === "YARDS" ? yardsToMeters(item.challanQty) : item.challanQty;
          const unitSuffix = item.unit === "YARDS" ? "yd" : "m";

          await tx.fabricLedgerEntry.create({
            data: {
              partyId,
              partyChallanNo,
              inwardId: inward.id,
              inwardItemId: inwardItem.id,
              itemCategory: "CONTINUOUS",
              fabricDescription: `${item.fabricType} (${item.colorShade})`,
              unit: item.unit,
              movementType: "PARTY_INWARD",
              referenceNumber: igpNumber,
              creditMeters: stdClaimed,
              debitMeters: 0,
              shrinkageMeters: 0,
              runningBalance: 0,
              timestamp: dateClaimed,
              notes: `Inward Challan #${partyChallanNo} - ${item.rollCount} rolls of ${item.fabricType} (${item.colorShade}) [Claimed: ${item.challanQty} ${unitSuffix}]`,
            },
          });

          if (shortageQty > 0) {
            await tx.fabricLedgerEntry.create({
              data: {
                partyId,
                partyChallanNo,
                inwardId: inward.id,
                inwardItemId: inwardItem.id,
                itemCategory: "CONTINUOUS",
                fabricDescription: `${item.fabricType} (${item.colorShade})`,
                unit: item.unit,
                movementType: "INWARD_SHORTAGE",
                referenceNumber: igpNumber,
                creditMeters: 0,
                debitMeters: 0,
                shrinkageMeters: stdShortage,
                runningBalance: 0,
                timestamp: dateShortage,
                notes: `Inward Shortage: #${partyChallanNo} ${item.fabricType} claimed ${item.challanQty}${unitSuffix} vs measured ${item.measuredQty}${unitSuffix} (-${shortageQty}${unitSuffix})`,
              },
            });
          }
        }
      }

      await reconcilePartyLedger(tx, partyId);
      return inward;
    });

    revalidatePath("/dashboard");
    revalidatePath("/ledger");

    return {
      success: true,
      message: `Inward Gate Pass ${igpNumber} generated successfully with ${itemsToCreate.length} item lot${
        itemsToCreate.length > 1 ? "s" : ""
      }. Party ledger updated.`,
    };
  } catch (err: any) {
    console.error("Inward creation error:", err);
    return { error: err.message || "Failed to process inward receipt." };
  }
}
// -----------------------------------------------------------------------------
// 1B. UPDATE FABRIC INWARD RECEIPT (WITH AUDIT TRAIL & LEDGER RECONCILIATION)
// -----------------------------------------------------------------------------
const UpdateInwardSchema = z.object({
  inwardId: z.string().min(1, "Inward record ID is required"),
  challanDate: z.string().optional(),
  partyChallanNo: z.string().trim().min(1, "Party Challan # is required"),
  fabricType: z.string().trim().min(1, "Fabric type is required"),
  colorShade: z.string().trim().min(1, "Color / Shade is required"),
  rollCount: z.coerce.number().int().positive("Roll count must be greater than 0"),
  challanMeters: z.coerce.number().positive("Party Challan meterage must be positive"),
  measuredMeters: z.coerce.number().positive("Physical measured meterage must be positive"),
  driverDetails: z.string().optional(),
  remarks: z.string().optional(),
});

export async function updateFabricInwardAction(
  prevState: FabricActionState | null,
  formData: FormData
): Promise<FabricActionState> {
  const session = await requireAuth();

  const rawData = {
    inwardId: formData.get("inwardId"),
    challanDate: formData.get("challanDate") || undefined,
    partyChallanNo: formData.get("partyChallanNo"),
    fabricType: formData.get("fabricType"),
    colorShade: formData.get("colorShade"),
    rollCount: formData.get("rollCount"),
    challanMeters: formData.get("challanMeters"),
    measuredMeters: formData.get("measuredMeters"),
    driverDetails: formData.get("driverDetails") || undefined,
    remarks: formData.get("remarks") || undefined,
  };

  const parsed = UpdateInwardSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const {
    inwardId,
    challanDate,
    partyChallanNo,
    fabricType,
    colorShade,
    rollCount,
    challanMeters,
    measuredMeters,
    driverDetails,
    remarks,
  } = parsed.data;

  const dateClaimed = parseLedgerDate(challanDate, 0);
  const dateShortage = parseLedgerDate(challanDate, 1);
  const newShortage = Number((challanMeters - measuredMeters).toFixed(2));

  try {
    const existing = await prisma.fabricInward.findUnique({
      where: { id: inwardId },
      include: { party: true },
    });

    if (!existing) {
      return { error: "Inward receipt record not found." };
    }

    const changeParts: string[] = [];
    const oldMeasured = Number(existing.measuredMeters);
    const oldChallan = Number(existing.challanMeters);
    if (oldMeasured !== measuredMeters) {
      changeParts.push(`Measured: ${oldMeasured}m -> ${measuredMeters}m`);
    }
    if (oldChallan !== challanMeters) {
      changeParts.push(`Claimed: ${oldChallan}m -> ${challanMeters}m`);
    }
    if (existing.rollCount !== rollCount) {
      changeParts.push(`Rolls: ${existing.rollCount} -> ${rollCount}`);
    }
    if (existing.partyChallanNo !== partyChallanNo) {
      changeParts.push(`Challan#: ${existing.partyChallanNo} -> ${partyChallanNo}`);
    }
    if (existing.fabricType !== fabricType) {
      changeParts.push(`Fabric: ${existing.fabricType} -> ${fabricType}`);
    }
    if (existing.colorShade !== colorShade) {
      changeParts.push(`Shade: ${existing.colorShade} -> ${colorShade}`);
    }
    const changesSummary = changeParts.length > 0 ? changeParts.join("; ") : "Details updated";

    const pastHistory = Array.isArray(existing.editHistory) ? (existing.editHistory as any[]) : [];
    const auditEntry = {
      updatedById: session.userId,
      updatedByName: session.fullName || session.username,
      updatedAt: new Date().toISOString(),
      changes: changesSummary,
    };
    const newHistory = [...pastHistory, auditEntry];

    await prisma.$transaction(async (tx: any) => {
      await tx.fabricInward.update({
        where: { id: inwardId },
        data: {
          challanDate: dateClaimed,
          partyChallanNo,
          fabricType,
          colorShade,
          rollCount,
          challanMeters,
          measuredMeters,
          shortageMeters: newShortage,
          driverDetails,
          remarks,
          editHistory: newHistory,
        },
      });

      const inwardEntry = await tx.fabricLedgerEntry.findFirst({
        where: {
          partyId: existing.partyId,
          referenceNumber: existing.igpNumber,
          movementType: "PARTY_INWARD",
        },
      });

      if (inwardEntry) {
        await tx.fabricLedgerEntry.update({
          where: { id: inwardEntry.id },
          data: {
            creditMeters: challanMeters,
            partyChallanNo,
            inwardId: existing.id,
            timestamp: dateClaimed,
            notes: `Inward Challan #${partyChallanNo} (${rollCount} rolls of ${colorShade} ${fabricType}) [Edited]`,
          },
        });
      }

      const shortageEntry = await tx.fabricLedgerEntry.findFirst({
        where: {
          partyId: existing.partyId,
          referenceNumber: existing.igpNumber,
          movementType: "INWARD_SHORTAGE",
        },
      });

      if (newShortage > 0) {
        if (shortageEntry) {
          await tx.fabricLedgerEntry.update({
            where: { id: shortageEntry.id },
            data: {
              shrinkageMeters: newShortage,
              partyChallanNo,
              inwardId: existing.id,
              timestamp: dateShortage,
              notes: `Inward Shortage: Challan #${partyChallanNo} claimed ${challanMeters.toFixed(2)}m vs measured ${measuredMeters.toFixed(2)}m (-${newShortage.toFixed(2)}m) [Edited]`,
            },
          });
        } else {
          await tx.fabricLedgerEntry.create({
            data: {
              partyId: existing.partyId,
              partyChallanNo,
              inwardId: existing.id,
              movementType: "INWARD_SHORTAGE",
              referenceNumber: existing.igpNumber,
              creditMeters: 0,
              debitMeters: 0,
              shrinkageMeters: newShortage,
              runningBalance: 0,
              timestamp: dateShortage,
              notes: `Inward Shortage: Challan #${partyChallanNo} claimed ${challanMeters.toFixed(2)}m vs measured ${measuredMeters.toFixed(2)}m (-${newShortage.toFixed(2)}m) [Edited]`,
            },
          });
        }
      } else if (shortageEntry) {
        await tx.fabricLedgerEntry.delete({
          where: { id: shortageEntry.id },
        });
      }

      await reconcilePartyLedger(tx, existing.partyId);
    });

    revalidatePath("/dashboard");
    revalidatePath("/ledger");
    return {
      success: true,
      message: `Inward Receipt ${existing.igpNumber} updated. Audit recorded and party ledger reconciled.`,
    };
  } catch (err: any) {
    console.error("Update inward error:", err);
    return { error: err.message || "Failed to update inward receipt." };
  }
}
// -----------------------------------------------------------------------------
// 2. OUTSOURCE DYEING / PRINTING: DISPATCH TO VENDOR (OGP)
// Supports both Multi-Item Lot Dispatches (Header + Rows) and Single-Item Fallbacks
// -----------------------------------------------------------------------------
const OutsourceItemSchema = z.object({
  partyId: z.string().min(1, "Party is required"),
  inwardId: z.string().optional(),
  processType: z.string().default("SOLID_DYEING"),
  targetShade: z.string().trim().min(1, "Target color / shade specification is required"),
  sentMeters: z.coerce.number().positive("Sent meters must be positive"),
});

const OutsourceDispatchSchema = z.object({
  sentDate: z.string().optional(),
  vendorId: z.string().min(1, "Dyeing / Printing vendor is required"),
  remarks: z.string().optional(),
});

export async function createOutsourceDispatchAction(
  prevState: FabricActionState | null,
  formData: FormData
): Promise<FabricActionState> {
  const session = await requireAuth();

  const sentDate = (formData.get("sentDate") as string) || undefined;
  const vendorId = (formData.get("vendorId") as string) || "";
  const remarks = (formData.get("remarks") as string) || undefined;

  const headerParsed = OutsourceDispatchSchema.safeParse({ sentDate, vendorId, remarks });
  if (!headerParsed.success) {
    return { error: headerParsed.error.issues[0].message };
  }

  let itemsToDispatch: Array<z.infer<typeof OutsourceItemSchema>> = [];
  const itemsPayloadStr = formData.get("itemsPayload") as string | null;

  if (itemsPayloadStr) {
    try {
      const parsedArray = JSON.parse(itemsPayloadStr);
      if (!Array.isArray(parsedArray) || parsedArray.length === 0) {
        return { error: "Please add at least one lot / challan item to dispatch." };
      }
      for (let i = 0; i < parsedArray.length; i++) {
        const itemResult = OutsourceItemSchema.safeParse(parsedArray[i]);
        if (!itemResult.success) {
          return { error: `Item ${i + 1}: ${itemResult.error.issues[0].message}` };
        }
        itemsToDispatch.push(itemResult.data);
      }
    } catch {
      return { error: "Invalid lot items payload submitted." };
    }
  } else {
    const singleRaw = {
      partyId: formData.get("partyId"),
      inwardId: formData.get("inwardId") || undefined,
      processType: formData.get("processType") || "SOLID_DYEING",
      targetShade: formData.get("targetShade"),
      sentMeters: formData.get("sentMeters"),
    };
    const singleParsed = OutsourceItemSchema.safeParse(singleRaw);
    if (!singleParsed.success) {
      return { error: singleParsed.error.issues[0].message };
    }
    itemsToDispatch.push(singleParsed.data);
  }

  const dateDispatch = parseLedgerDate(sentDate, 2);
  const ogpNumber = generateCode("OGP");

  try {
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) return { error: "Dyeing / printing vendor not found." };

    const partyIds = Array.from(new Set(itemsToDispatch.map((i) => i.partyId)));
    const parties = await prisma.party.findMany({ where: { id: { in: partyIds } } });
    if (parties.length !== partyIds.length) return { error: "One or more selected parties not found." };

    for (const pId of partyIds) {
      const party = parties.find((p) => p.id === pId)!;
      const totalSentForParty = itemsToDispatch
        .filter((i) => i.partyId === pId)
        .reduce((sum, i) => sum + i.sentMeters, 0);

      const lastEntry = await prisma.fabricLedgerEntry.findFirst({
        where: { partyId: pId, itemCategory: "CONTINUOUS" },
        orderBy: [{ timestamp: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      });
      const currentBalance = lastEntry ? Number(lastEntry.runningBalance) : 0;

      if (totalSentForParty > currentBalance) {
        return {
          error: `Cannot dispatch ${totalSentForParty.toFixed(2)}m for ${party.name}. Current in-factory custody balance is ${currentBalance.toFixed(2)}m.`,
        };
      }
    }

    await prisma.$transaction(async (tx: any) => {
      for (const item of itemsToDispatch) {
        let inwardChallanNo: string | null = null;
        if (item.inwardId) {
          const inward = await tx.fabricInward.findUnique({
            where: { id: item.inwardId },
            select: { partyChallanNo: true },
          });
          if (inward) {
            inwardChallanNo = inward.partyChallanNo;
          }
        }

        await tx.outsourceBatch.create({
          data: {
            ogpNumber,
            partyId: item.partyId,
            vendorId,
            inwardId: item.inwardId || null,
            processType: item.processType,
            targetShade: item.targetShade,
            sentMeters: item.sentMeters,
            sentDate: dateDispatch,
            sentById: session.userId,
            status: "WITH_VENDOR",
            remarks,
          },
        });

        await tx.fabricLedgerEntry.create({
          data: {
            partyId: item.partyId,
            partyChallanNo: inwardChallanNo,
            inwardId: item.inwardId || null,
            itemCategory: "CONTINUOUS",
            movementType: "OUTWARD_TO_VENDOR",
            referenceNumber: ogpNumber,
            creditMeters: 0,
            debitMeters: item.sentMeters,
            shrinkageMeters: 0,
            runningBalance: 0,
            timestamp: dateDispatch,
            notes: `Dispatched to ${vendor.name} for ${item.processType} (Target: ${item.targetShade})${
              inwardChallanNo ? ` [Ref: #${inwardChallanNo}]` : ""
            }`,
          },
        });
      }

      for (const pId of partyIds) {
        await reconcilePartyLedger(tx, pId);
      }
    });

    revalidatePath("/dashboard");
    revalidatePath("/outsource");
    revalidatePath("/ledger");

    const totalMeters = itemsToDispatch.reduce((sum, i) => sum + i.sentMeters, 0);
    return {
      success: true,
      message: `Outward Gate Pass ${ogpNumber} issued for ${totalMeters.toFixed(2)}m (${itemsToDispatch.length} lot${
        itemsToDispatch.length > 1 ? "s" : ""
      }) to ${vendor.name}.`,
    };
  } catch (err: any) {
    console.error("Outsource dispatch error:", err);
    return { error: err.message || "Failed to issue outward gate pass." };
  }
}
// -----------------------------------------------------------------------------
// 3. OUTSOURCE DYEING / PRINTING: RECEIVE RETURN (PARTIAL OR FULL WITH TECHNICAL SHRINKAGE)
// -----------------------------------------------------------------------------
const OutsourceReturnSchema = z.object({
  batchId: z.string().min(1, "Batch ID is required"),
  receivedDate: z.string().optional(),
  vendorChallanNo: z.string().trim().min(1, "Dyer delivery slip # is required"),
  accountedMeters: z.coerce.number().positive("Accounted dispatched meterage must be positive").optional(),
  receivedMeters: z.coerce.number().positive("Physical received meters must be positive"),
  remarks: z.string().optional(),
});

export async function returnOutsourceBatchAction(
  prevState: FabricActionState | null,
  formData: FormData
): Promise<FabricActionState> {
  const session = await requireAuth();

  const rawData = {
    batchId: formData.get("batchId"),
    receivedDate: formData.get("receivedDate") || undefined,
    vendorChallanNo: formData.get("vendorChallanNo"),
    accountedMeters: formData.get("accountedMeters") ? formData.get("accountedMeters") : undefined,
    receivedMeters: formData.get("receivedMeters"),
    remarks: formData.get("remarks") || undefined,
  };

  const parsed = OutsourceReturnSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { batchId, receivedDate, vendorChallanNo, receivedMeters, remarks } = parsed.data;
  const dateReturn = parseLedgerDate(receivedDate, 3);

  try {
    const batch = await prisma.outsourceBatch.findUnique({
      where: { id: batchId },
      include: { vendor: true, inward: true },
    });

    if (!batch) {
      return { error: "Outsource batch record not found." };
    }

    const totalSent = Number(batch.sentMeters);
    const prevAccounted = Number(batch.accountedMeters || 0);
    const pendingWithVendor = Number((totalSent - prevAccounted).toFixed(2));

    const accountedMeters = parsed.data.accountedMeters ?? pendingWithVendor;

    if (accountedMeters > pendingWithVendor + 0.05) {
      return {
        error: `Cannot account for ${accountedMeters.toFixed(2)}m. Only ${pendingWithVendor.toFixed(2)}m is currently pending with vendor.`,
      };
    }

    const shrinkageMeters = Number((accountedMeters - receivedMeters).toFixed(2));
    const shrinkagePercent =
      accountedMeters > 0 ? Number(((shrinkageMeters / accountedMeters) * 100).toFixed(2)) : 0;

    await prisma.$transaction(async (tx: any) => {
      await tx.outsourceBatchReturn.create({
        data: {
          batchId,
          vendorChallanNo,
          accountedMeters,
          receivedMeters,
          shrinkageMeters,
          shrinkagePercent,
          returnDate: dateReturn,
          receivedById: session.userId,
          remarks,
        },
      });

      const newAccounted = Number((prevAccounted + accountedMeters).toFixed(2));
      const newReceived = Number(((Number(batch.receivedMeters) || 0) + receivedMeters).toFixed(2));
      const newShrinkage = Number(((Number(batch.shrinkageMeters) || 0) + shrinkageMeters).toFixed(2));
      const isComplete = newAccounted >= totalSent - 0.05;
      const newStatus = isComplete ? "RECEIVED_COMPLETE" : "RECEIVED_PARTIAL";

      const existingSlip = batch.vendorChallanNo;
      const combinedSlips = existingSlip
        ? existingSlip.includes(vendorChallanNo)
          ? existingSlip
          : `${existingSlip}, ${vendorChallanNo}`
        : vendorChallanNo;

      await tx.outsourceBatch.update({
        where: { id: batchId },
        data: {
          status: newStatus,
          accountedMeters: newAccounted,
          receivedMeters: newReceived,
          shrinkageMeters: newShrinkage,
          shrinkagePercent:
            newAccounted > 0 ? Number(((newShrinkage / newAccounted) * 100).toFixed(2)) : 0,
          vendorChallanNo: combinedSlips,
          receivedDate: dateReturn,
          receivedById: session.userId,
          remarks: remarks || batch.remarks,
        },
      });

      const inwardRef = batch.inward?.partyChallanNo;
      await tx.fabricLedgerEntry.create({
        data: {
          partyId: batch.partyId,
          partyChallanNo: inwardRef || null,
          inwardId: batch.inwardId || null,
          itemCategory: "CONTINUOUS",
          movementType: "INWARD_FROM_VENDOR",
          referenceNumber: batch.ogpNumber,
          creditMeters: accountedMeters,
          debitMeters: 0,
          shrinkageMeters: shrinkageMeters > 0 ? shrinkageMeters : 0,
          runningBalance: 0,
          timestamp: dateReturn,
          notes: `Received from ${batch.vendor.name} Dyer Slip #${vendorChallanNo}${
            inwardRef ? ` [Ref: #${inwardRef}]` : ""
          } (${batch.processType}, ${batch.targetShade}). Received: ${receivedMeters.toFixed(2)}m | Technical Shrinkage: ${shrinkageMeters.toFixed(2)}m (${shrinkagePercent.toFixed(2)}%) [Accounted: ${accountedMeters.toFixed(2)}m]`,
        },
      });

      await reconcilePartyLedger(tx, batch.partyId);
    });

    revalidatePath("/dashboard");
    revalidatePath("/outsource");
    revalidatePath("/ledger");

    const remaining = Number((totalSent - (prevAccounted + accountedMeters)).toFixed(2));
    const remainingText = remaining > 0 ? ` (Remaining with vendor: ${remaining.toFixed(2)}m)` : " (Batch completed)";

    return {
      success: true,
      message: `Return recorded on Dyer Slip #${vendorChallanNo}: +${receivedMeters.toFixed(2)}m received, -${shrinkageMeters.toFixed(2)}m shrinkage${remainingText}.`,
    };
  } catch (err: any) {
    console.error("Outsource return error:", err);
    return { error: err.message || "Failed to process vendor return." };
  }
}

// -----------------------------------------------------------------------------
// 4. OUTWARD DELIVERY CHALLAN TO PARTY
// -----------------------------------------------------------------------------
const DeliverySchema = z.object({
  partyId: z.string().min(1, "Party selection is required"),
  inwardId: z.string().optional(),
  fabricType: z.string().trim().min(1, "Fabric specification is required"),
  colorShade: z.string().trim().min(1, "Color / Shade is required"),
  totalRolls: z.coerce.number().int().positive("Roll count must be at least 1"),
  totalMeters: z.coerce.number().positive("Delivered meterage must be positive"),
  vehicleDriver: z.string().optional(),
  remarks: z.string().optional(),
});

export async function createDeliveryChallanAction(
  prevState: FabricActionState | null,
  formData: FormData
): Promise<FabricActionState> {
  const session = await requireAuth();

  const rawData = {
    partyId: formData.get("partyId"),
    inwardId: formData.get("inwardId") || undefined,
    fabricType: formData.get("fabricType"),
    colorShade: formData.get("colorShade"),
    totalRolls: formData.get("totalRolls"),
    totalMeters: formData.get("totalMeters"),
    vehicleDriver: formData.get("vehicleDriver") || undefined,
    remarks: formData.get("remarks") || undefined,
  };

  const parsed = DeliverySchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { partyId, inwardId, fabricType, colorShade, totalRolls, totalMeters, vehicleDriver, remarks } =
    parsed.data;

  const dateDelivery = parseLedgerDate(undefined, 4);
  const challanNumber = generateCode("DC");

  try {
    let inwardChallanNo: string | null = null;
    if (inwardId) {
      const inward = await prisma.fabricInward.findUnique({
        where: { id: inwardId },
        select: { partyChallanNo: true },
      });
      if (inward) inwardChallanNo = inward.partyChallanNo;
    }

    await prisma.$transaction(async (tx: any) => {
      const challan = await tx.deliveryChallan.create({
        data: {
          challanNumber,
          partyId,
          totalMeters,
          totalRolls,
          vehicleDriver,
          remarks,
          dispatchedById: session.userId,
          items: {
            create: {
              inwardId: inwardId || null,
              fabricType,
              colorShade,
              metersDelivered: totalMeters,
              rollsDelivered: totalRolls,
            },
          },
        },
      });

      await tx.fabricLedgerEntry.create({
        data: {
          partyId,
          partyChallanNo: inwardChallanNo,
          inwardId: inwardId || null,
          itemCategory: "CONTINUOUS",
          movementType: "DELIVERY_TO_PARTY",
          referenceNumber: challanNumber,
          creditMeters: 0,
          debitMeters: totalMeters,
          shrinkageMeters: 0,
          runningBalance: 0,
          timestamp: dateDelivery,
          notes: `Dispatched on Delivery Challan #${challanNumber}${
            inwardChallanNo ? ` [Ref: #${inwardChallanNo}]` : ""
          } (${totalRolls} rolls of ${colorShade} ${fabricType})`,
        },
      });

      await reconcilePartyLedger(tx, partyId);
      return challan;
    });

    revalidatePath("/dashboard");
    revalidatePath("/deliveries");
    revalidatePath("/ledger");
    return {
      success: true,
      message: `Delivery Challan ${challanNumber} generated for ${totalMeters.toFixed(2)}m. Party balance updated.`,
    };
  } catch (err: any) {
    console.error("Delivery error:", err);
    return { error: err.message || "Failed to create delivery challan." };
  }
}
