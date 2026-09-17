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
  const updateFns: (() => Promise<any>)[] = [];

  for (const entry of allEntries) {
    if (entry.itemCategory === "PIECES") {
      const credit = Number(entry.creditPieces || 0);
      const debit = Number(entry.debitPieces || 0);
      const shortage = Number(entry.shortagePieces || 0);
      runningPieces = runningPieces + credit - debit - shortage;

      if (entry.runningPieces !== runningPieces) {
        const targetPieces = runningPieces;
        updateFns.push(() =>
          tx.fabricLedgerEntry.update({
            where: { id: entry.id },
            data: { runningPieces: targetPieces },
          })
        );
      }
    } else {
      // CONTINUOUS fabric
      const credit = Number(entry.creditMeters || 0);
      const debit = Number(entry.debitMeters || 0);
      const shrinkage = Number(entry.shrinkageMeters || 0);
      runningMeters = Number((runningMeters + credit - debit - shrinkage).toFixed(2));

      if (Number(entry.runningBalance) !== runningMeters) {
        const targetBalance = runningMeters;
        updateFns.push(() =>
          tx.fabricLedgerEntry.update({
            where: { id: entry.id },
            data: { runningBalance: targetBalance },
          })
        );
      }
    }
  }

  // Execute updates in parallel chunks of 5 for speed without overwhelming connection pool
  for (let i = 0; i < updateFns.length; i += 5) {
    const chunk = updateFns.slice(i, i + 5);
    await Promise.all(chunk.map((fn) => fn()));
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

      // Query latest running balances for this party so newly created entries already have the correct running balances
      const lastContEntry = await tx.fabricLedgerEntry.findFirst({
        where: { partyId, itemCategory: "CONTINUOUS" },
        orderBy: [{ timestamp: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        select: { runningBalance: true },
      });
      let currentRunningBalance = Number(lastContEntry?.runningBalance || 0);

      const lastPieceEntry = await tx.fabricLedgerEntry.findFirst({
        where: { partyId, itemCategory: "PIECES" },
        orderBy: [{ timestamp: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        select: { runningPieces: true },
      });
      let currentRunningPieces = Number(lastPieceEntry?.runningPieces || 0);

      for (let idx = 0; idx < itemsToCreate.length; idx++) {
        const item = itemsToCreate[idx];
        const shortageQty = Number((item.challanQty - item.measuredQty).toFixed(2));

        let stdMeters: number | null = null;
        if (item.unit === "YARDS") {
          stdMeters = yardsToMeters(item.measuredQty);
        } else if (item.unit === "METERS") {
          stdMeters = item.measuredQty;
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
          const shortagePieces = Math.round(shortageQty); // positive = shortage, negative = surplus
          const diffText =
            shortagePieces > 0
              ? ` (-${shortagePieces} pcs)`
              : shortagePieces < 0
              ? ` (+${Math.abs(shortagePieces)} pcs)`
              : "";
          const notes = `Inward Challan #${partyChallanNo} - ${item.rollCount} pkgs of ${item.fabricType} (${item.colorShade}) [Claimed: ${Math.round(item.challanQty)} pcs] vs [Measured: ${Math.round(item.measuredQty)} pcs]${diffText}`;

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
              shortagePieces: shortagePieces,
              runningPieces: 0,
              timestamp: dateClaimed,
              notes,
            },
          });
        } else {
          const stdClaimed = item.unit === "YARDS" ? yardsToMeters(item.challanQty) : item.challanQty;
          const stdMeasured = item.unit === "YARDS" ? yardsToMeters(item.measuredQty) : item.measuredQty;
          // stdSignedShortage: positive = shortage (claimed > measured), negative = surplus (claimed < measured)
          const stdSignedShortage = Number((stdClaimed - stdMeasured).toFixed(2));
          const unitSuffix = item.unit === "YARDS" ? "yd" : "m";
          const diffText =
            shortageQty > 0
              ? ` (-${shortageQty}${unitSuffix})`
              : shortageQty < 0
              ? ` (+${Math.abs(shortageQty)}${unitSuffix})`
              : "";
          const notes = `Inward Challan #${partyChallanNo} - ${item.rollCount} rolls of ${item.fabricType} (${item.colorShade}) [Claimed: ${item.challanQty} ${unitSuffix}] vs [Measured: ${item.measuredQty} ${unitSuffix}]${diffText}`;

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
              shrinkageMeters: stdSignedShortage,
              runningBalance: 0,
              timestamp: dateClaimed,
              notes,
            },
          });
        }
      }

      await reconcilePartyLedger(tx, partyId);
      return inward;
    }, { maxWait: 15000, timeout: 45000 });

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
  remarks: z.string().optional(),
});

export async function updateFabricInwardAction(
  prevState: FabricActionState | null,
  formData: FormData
): Promise<FabricActionState> {
  const session = await requireAuth();

  const rawHeader = {
    inwardId: formData.get("inwardId"),
    challanDate: formData.get("challanDate") || undefined,
    partyChallanNo: formData.get("partyChallanNo"),
    remarks: formData.get("remarks") || undefined,
  };

  const parsedHeader = UpdateInwardSchema.safeParse(rawHeader);
  if (!parsedHeader.success) {
    return { error: parsedHeader.error.issues[0].message };
  }

  const { inwardId, challanDate, partyChallanNo, remarks } = parsedHeader.data;

  let itemsToUpdate: Array<z.infer<typeof InwardItemSchema>> = [];
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
        itemsToUpdate.push(itemRes.data);
      }
    } catch {
      return { error: "Invalid items payload format." };
    }
  } else {
    // Fallback for legacy single-item callers
    const singleParsed = InwardItemSchema.safeParse({
      fabricType: formData.get("fabricType"),
      colorShade: formData.get("colorShade"),
      unit: "METERS",
      rollCount: formData.get("rollCount"),
      challanQty: formData.get("challanMeters"),
      measuredQty: formData.get("measuredMeters"),
    });
    if (!singleParsed.success) {
      return { error: singleParsed.error.issues[0].message };
    }
    itemsToUpdate.push(singleParsed.data);
  }

  const dateClaimed = parseLedgerDate(challanDate, 0);
  const dateVariance = parseLedgerDate(challanDate, 1);

  let totalRolls = 0;
  let totalContinuousClaimedMeters = 0;
  let totalContinuousMeasuredMeters = 0;
  let totalContinuousShortageMeters = 0;

  for (const item of itemsToUpdate) {
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
    itemsToUpdate.length === 1
      ? itemsToUpdate[0].fabricType
      : `Multi-Item (${itemsToUpdate.length} lots)`;
  const primaryColor =
    itemsToUpdate.length === 1 ? itemsToUpdate[0].colorShade : "Mixed";

  try {
    const existing = await prisma.fabricInward.findUnique({
      where: { id: inwardId },
      include: { party: true, items: true },
    });

    if (!existing) {
      return { error: "Inward receipt record not found." };
    }

    const changeParts: string[] = [];
    if (existing.partyChallanNo !== partyChallanNo) {
      changeParts.push(`Challan#: ${existing.partyChallanNo} -> ${partyChallanNo}`);
    }
    if (Number(existing.rollCount) !== totalRolls) {
      changeParts.push(`Packs: ${existing.rollCount} -> ${totalRolls}`);
    }
    if (Number(existing.measuredMeters) !== Number(totalContinuousMeasuredMeters.toFixed(2))) {
      changeParts.push(`Measured Cont.: ${Number(existing.measuredMeters)}m -> ${totalContinuousMeasuredMeters.toFixed(2)}m`);
    }
    if (existing.items.length !== itemsToUpdate.length) {
      changeParts.push(`Lots: ${existing.items.length} -> ${itemsToUpdate.length}`);
    }
    const changesSummary = changeParts.length > 0 ? changeParts.join("; ") : "Lots / details updated";

    const pastHistory = Array.isArray(existing.editHistory) ? (existing.editHistory as any[]) : [];
    const auditEntry = {
      updatedById: session.userId,
      updatedByName: session.fullName || session.username,
      updatedAt: new Date().toISOString(),
      changes: changesSummary,
    };
    const newHistory = [...pastHistory, auditEntry];

    await prisma.$transaction(
      async (tx: any) => {
        // 1. Update Inward Header
        await tx.fabricInward.update({
          where: { id: inwardId },
          data: {
            challanDate: dateClaimed,
            partyChallanNo,
            fabricType: primaryFabric,
            colorShade: primaryColor,
            rollCount: totalRolls,
            challanMeters: Number(totalContinuousClaimedMeters.toFixed(2)),
            measuredMeters: Number(totalContinuousMeasuredMeters.toFixed(2)),
            shortageMeters: Number(totalContinuousShortageMeters.toFixed(2)),
            remarks,
            editHistory: newHistory,
          },
        });

        // 2. Remove previous ledger entries and items for this inward
        await tx.fabricLedgerEntry.deleteMany({
          where: { inwardId },
        });

        await tx.fabricInwardItem.deleteMany({
          where: { inwardId },
        });

        // 3. Create updated items and updated ledger entries
        for (let idx = 0; idx < itemsToUpdate.length; idx++) {
          const item = itemsToUpdate[idx];
          const shortageQty = Number((item.challanQty - item.measuredQty).toFixed(2));

          let stdMeters: number | null = null;
          if (item.unit === "YARDS") {
            stdMeters = yardsToMeters(item.measuredQty);
          } else if (item.unit === "METERS") {
            stdMeters = item.measuredQty;
          }

          const inwardItem = await tx.fabricInwardItem.create({
            data: {
              inwardId: existing.id,
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
            const shortagePieces = Math.round(shortageQty); // positive = shortage, negative = surplus
            const diffText =
              shortagePieces > 0
                ? ` (-${shortagePieces} pcs)`
                : shortagePieces < 0
                ? ` (+${Math.abs(shortagePieces)} pcs)`
                : "";
            const notes = `Inward Challan #${partyChallanNo} - ${item.rollCount} pkgs of ${item.fabricType} (${item.colorShade}) [Claimed: ${Math.round(item.challanQty)} pcs] vs [Measured: ${Math.round(item.measuredQty)} pcs]${diffText}`;

            await tx.fabricLedgerEntry.create({
              data: {
                partyId: existing.partyId,
                partyChallanNo,
                inwardId: existing.id,
                inwardItemId: inwardItem.id,
                itemCategory: "PIECES",
                fabricDescription: `${item.fabricType} (${item.colorShade})`,
                unit: "PIECES",
                movementType: "PARTY_INWARD",
                referenceNumber: existing.igpNumber,
                creditMeters: 0,
                debitMeters: 0,
                shrinkageMeters: 0,
                creditPieces: Math.round(item.challanQty),
                debitPieces: 0,
                shortagePieces: shortagePieces,
                runningPieces: 0,
                timestamp: dateClaimed,
                notes,
              },
            });
          } else {
            const stdClaimed = item.unit === "YARDS" ? yardsToMeters(item.challanQty) : item.challanQty;
            const stdMeasured = item.unit === "YARDS" ? yardsToMeters(item.measuredQty) : item.measuredQty;
            // stdSignedShortage: positive = shortage (claimed > measured), negative = surplus (claimed < measured)
            const stdSignedShortage = Number((stdClaimed - stdMeasured).toFixed(2));
            const unitSuffix = item.unit === "YARDS" ? "yd" : "m";
            const diffText =
              shortageQty > 0
                ? ` (-${shortageQty}${unitSuffix})`
                : shortageQty < 0
                ? ` (+${Math.abs(shortageQty)}${unitSuffix})`
                : "";
            const notes = `Inward Challan #${partyChallanNo} - ${item.rollCount} rolls of ${item.fabricType} (${item.colorShade}) [Claimed: ${item.challanQty} ${unitSuffix}] vs [Measured: ${item.measuredQty} ${unitSuffix}]${diffText}`;

            await tx.fabricLedgerEntry.create({
              data: {
                partyId: existing.partyId,
                partyChallanNo,
                inwardId: existing.id,
                inwardItemId: inwardItem.id,
                itemCategory: "CONTINUOUS",
                fabricDescription: `${item.fabricType} (${item.colorShade})`,
                unit: item.unit,
                movementType: "PARTY_INWARD",
                referenceNumber: existing.igpNumber,
                creditMeters: stdClaimed,
                debitMeters: 0,
                shrinkageMeters: stdSignedShortage,
                runningBalance: 0,
                timestamp: dateClaimed,
                notes,
              },
            });
          }
        }

        // 4. Reconcile party ledger
        await reconcilePartyLedger(tx, existing.partyId);
      },
      { maxWait: 15000, timeout: 45000 }
    );

    revalidatePath("/dashboard");
    revalidatePath("/ledger");
    return {
      success: true,
      message: `Inward Receipt ${existing.igpNumber} updated successfully. Audit logged and ledger reconciled.`,
    };
  } catch (err: any) {
    console.error("Update inward error:", err);
    return { error: err.message || "Failed to update inward receipt." };
  }
}
// -----------------------------------------------------------------------------
// 2. OUTSOURCE DYEING / PRINTING: DISPATCH TO VENDOR (OGP)
// Supports Multi-Unit Lots (M, Yd, Pcs) with Dual-Ledger Posting
// -----------------------------------------------------------------------------
const OutsourceItemSchema = z.object({
  partyId: z.string().min(1, "Party is required"),
  inwardId: z.string().optional(),
  inwardItemId: z.string().optional(),
  unit: z.enum(["METERS", "YARDS", "PIECES"]).default("METERS"),
  processType: z.string().default("SOLID_DYEING"),
  targetShade: z.string().trim().min(1, "Target color / shade specification is required"),
  sentQty: z.coerce.number().positive("Sent quantity must be positive"),
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
        const rawItem = parsedArray[i];
        if (rawItem.sentQty === undefined && rawItem.sentMeters !== undefined) {
          rawItem.sentQty = rawItem.sentMeters;
        }
        const itemResult = OutsourceItemSchema.safeParse(rawItem);
        if (!itemResult.success) {
          return { error: `Item ${i + 1}: ${itemResult.error.issues[0].message}` };
        }
        itemsToDispatch.push(itemResult.data);
      }
    } catch {
      return { error: "Invalid lot items payload submitted." };
    }
  } else {
    const rawSent = formData.get("sentQty") || formData.get("sentMeters");
    const singleRaw = {
      partyId: formData.get("partyId"),
      inwardId: formData.get("inwardId") || undefined,
      inwardItemId: formData.get("inwardItemId") || undefined,
      unit: (formData.get("unit") as string) || "METERS",
      processType: formData.get("processType") || "SOLID_DYEING",
      targetShade: formData.get("targetShade"),
      sentQty: rawSent,
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

    // Validate balances by category (Continuous vs Pieces)
    for (const pId of partyIds) {
      const party = parties.find((p) => p.id === pId)!;
      const continuousSent = itemsToDispatch
        .filter((i) => i.partyId === pId && i.unit !== "PIECES")
        .reduce((sum, i) => sum + (i.unit === "YARDS" ? yardsToMeters(i.sentQty) : i.sentQty), 0);
      const piecesSent = itemsToDispatch
        .filter((i) => i.partyId === pId && i.unit === "PIECES")
        .reduce((sum, i) => sum + Math.round(i.sentQty), 0);

      if (continuousSent > 0) {
        const lastContEntry = await prisma.fabricLedgerEntry.findFirst({
          where: { partyId: pId, itemCategory: "CONTINUOUS" },
          orderBy: [{ timestamp: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        });
        const currentContBalance = lastContEntry ? Number(lastContEntry.runningBalance) : 0;
        if (continuousSent > currentContBalance) {
          return {
            error: `Cannot dispatch ${continuousSent.toFixed(2)}m for ${party.name}. Current in-factory continuous custody balance is ${currentContBalance.toFixed(2)}m.`,
          };
        }
      }

      if (piecesSent > 0) {
        const lastPieceEntry = await prisma.fabricLedgerEntry.findFirst({
          where: { partyId: pId, itemCategory: "PIECES" },
          orderBy: [{ timestamp: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        });
        const currentPieceBalance = lastPieceEntry ? Number(lastPieceEntry.runningPieces) : 0;
        if (piecesSent > currentPieceBalance) {
          return {
            error: `Cannot dispatch ${piecesSent} pcs for ${party.name}. Current in-factory cut pieces custody balance is ${currentPieceBalance} pcs.`,
          };
        }
      }
    }

    // Validate individual lot & line-item available balances
    for (const item of itemsToDispatch) {
      if (item.inwardItemId) {
        const inwardItem = await prisma.fabricInwardItem.findUnique({
          where: { id: item.inwardItemId },
          include: { inward: true },
        });
        if (inwardItem) {
          const itemEntries = await prisma.fabricLedgerEntry.findMany({
            where: { inwardItemId: item.inwardItemId },
          });
          const isItemPieces = inwardItem.unit === "PIECES" || item.unit === "PIECES";

          if (isItemPieces) {
            let availPieces = Number(inwardItem.measuredQty);
            if (itemEntries.length > 0) {
              const c = itemEntries.reduce((s: number, e: any) => s + (e.creditPieces || 0), 0);
              const d = itemEntries.reduce((s: number, e: any) => s + (e.debitPieces || 0), 0);
              const sh = itemEntries.reduce((s: number, e: any) => s + (e.shortagePieces || 0), 0);
              availPieces = Math.max(0, c - d - sh);
            }
            const sentPcs = Math.round(item.sentQty);
            if (sentPcs > availPieces) {
              return {
                error: `Cannot dispatch ${sentPcs} pcs. Maximum available in lot #${inwardItem.inward.partyChallanNo} (${inwardItem.fabricType} - ${inwardItem.colorShade}) is ${availPieces} pcs.`,
              };
            }
          } else {
            let availMeters =
              inwardItem.standardMeters !== null
                ? Number(inwardItem.standardMeters)
                : inwardItem.unit === "YARDS"
                ? yardsToMeters(Number(inwardItem.measuredQty))
                : Number(inwardItem.measuredQty);

            if (itemEntries.length > 0) {
              const c = itemEntries.reduce((s: number, e: any) => s + Number(e.creditMeters || 0), 0);
              const d = itemEntries.reduce((s: number, e: any) => s + Number(e.debitMeters || 0), 0);
              const sh = itemEntries.reduce((s: number, e: any) => s + Number(e.shrinkageMeters || 0), 0);
              availMeters = Math.max(0, Number((c - d - sh).toFixed(2)));
            }

            const reqMeters = item.unit === "YARDS" ? yardsToMeters(item.sentQty) : item.sentQty;
            if (reqMeters > availMeters + 0.01) {
              const maxInSelectedUnit =
                item.unit === "YARDS" ? Number(metersToYards(availMeters).toFixed(2)) : availMeters;
              const unitSuffix = item.unit === "YARDS" ? "yd" : "m";
              return {
                error: `Cannot dispatch ${item.sentQty.toFixed(2)} ${unitSuffix}. Maximum available in lot #${inwardItem.inward.partyChallanNo} (${inwardItem.fabricType} - ${inwardItem.colorShade}) is ${maxInSelectedUnit.toFixed(2)} ${unitSuffix} (≈ ${availMeters.toFixed(2)} m).`,
              };
            }
          }
        }
      } else if (item.inwardId) {
        const inward = await prisma.fabricInward.findUnique({
          where: { id: item.inwardId },
        });
        if (inward) {
          const inwardEntries = await prisma.fabricLedgerEntry.findMany({
            where: { inwardId: item.inwardId },
          });
          let availMeters = Number(inward.measuredMeters);
          if (inwardEntries.length > 0) {
            const c = inwardEntries.reduce((s: number, e: any) => s + Number(e.creditMeters || 0), 0);
            const d = inwardEntries.reduce((s: number, e: any) => s + Number(e.debitMeters || 0), 0);
            const sh = inwardEntries.reduce((s: number, e: any) => s + Number(e.shrinkageMeters || 0), 0);
            availMeters = Math.max(0, Number((c - d - sh).toFixed(2)));
          }

          const reqMeters = item.unit === "YARDS" ? yardsToMeters(item.sentQty) : item.sentQty;
          if (reqMeters > availMeters + 0.01) {
            const maxInSelectedUnit =
              item.unit === "YARDS" ? Number(metersToYards(availMeters).toFixed(2)) : availMeters;
            const unitSuffix = item.unit === "YARDS" ? "yd" : "m";
            return {
              error: `Cannot dispatch ${item.sentQty.toFixed(2)} ${unitSuffix}. Maximum available in Challan #${inward.partyChallanNo} is ${maxInSelectedUnit.toFixed(2)} ${unitSuffix} (≈ ${availMeters.toFixed(2)} m).`,
            };
          }
        }
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

        const isPieces = item.unit === "PIECES";
        const stdQty = isPieces
          ? item.sentQty
          : item.unit === "YARDS"
          ? yardsToMeters(item.sentQty)
          : item.sentQty;

        await tx.outsourceBatch.create({
          data: {
            ogpNumber,
            partyId: item.partyId,
            vendorId,
            inwardId: item.inwardId || null,
            inwardItemId: item.inwardItemId || null,
            unit: item.unit,
            itemCategory: isPieces ? "PIECES" : "CONTINUOUS",
            processType: item.processType,
            targetShade: item.targetShade,
            sentMeters: item.sentQty,
            sentDate: dateDispatch,
            sentById: session.userId,
            status: "WITH_VENDOR",
            remarks,
          },
        });

        if (isPieces) {
          const sentPieces = Math.round(item.sentQty);
          await tx.fabricLedgerEntry.create({
            data: {
              partyId: item.partyId,
              partyChallanNo: inwardChallanNo,
              inwardId: item.inwardId || null,
              inwardItemId: item.inwardItemId || null,
              itemCategory: "PIECES",
              unit: "PIECES",
              movementType: "OUTWARD_TO_VENDOR",
              referenceNumber: ogpNumber,
              creditMeters: 0,
              debitMeters: 0,
              shrinkageMeters: 0,
              creditPieces: 0,
              debitPieces: sentPieces,
              shortagePieces: 0,
              runningPieces: 0,
              timestamp: dateDispatch,
              notes: `Dispatched to ${vendor.name} for ${item.processType} (Target: ${item.targetShade}) - ${sentPieces} pcs${
                inwardChallanNo ? ` [Ref: #${inwardChallanNo}]` : ""
              }`,
            },
          });
        } else {
          const unitSuffix = item.unit === "YARDS" ? "yd" : "m";
          await tx.fabricLedgerEntry.create({
            data: {
              partyId: item.partyId,
              partyChallanNo: inwardChallanNo,
              inwardId: item.inwardId || null,
              inwardItemId: item.inwardItemId || null,
              itemCategory: "CONTINUOUS",
              unit: item.unit,
              movementType: "OUTWARD_TO_VENDOR",
              referenceNumber: ogpNumber,
              creditMeters: 0,
              debitMeters: stdQty,
              shrinkageMeters: 0,
              runningBalance: 0,
              timestamp: dateDispatch,
              notes: `Dispatched to ${vendor.name} for ${item.processType} (Target: ${item.targetShade}) - ${item.sentQty} ${unitSuffix}${
                item.unit === "YARDS" ? ` (≈ ${stdQty.toFixed(2)}m)` : ""
              }${inwardChallanNo ? ` [Ref: #${inwardChallanNo}]` : ""}`,
            },
          });
        }
      }

      for (const pId of partyIds) {
        await reconcilePartyLedger(tx, pId);
      }
    }, { maxWait: 15000, timeout: 45000 });

    revalidatePath("/dashboard");
    revalidatePath("/outsource");
    revalidatePath("/ledger");

    const totalContinuous = itemsToDispatch
      .filter((i) => i.unit !== "PIECES")
      .reduce((sum, i) => sum + (i.unit === "YARDS" ? yardsToMeters(i.sentQty) : i.sentQty), 0);
    const totalPieces = itemsToDispatch
      .filter((i) => i.unit === "PIECES")
      .reduce((sum, i) => sum + Math.round(i.sentQty), 0);

    const summaryParts = [];
    if (totalContinuous > 0) summaryParts.push(`${totalContinuous.toFixed(2)}m`);
    if (totalPieces > 0) summaryParts.push(`${totalPieces} pcs`);

    return {
      success: true,
      message: `Outward Gate Pass ${ogpNumber} issued for ${summaryParts.join(" + ")} (${itemsToDispatch.length} lot${
        itemsToDispatch.length > 1 ? "s" : ""
      }) to ${vendor.name}.`,
    };
  } catch (err: any) {
    console.error("Outsource dispatch error:", err);
    return { error: err.message || "Failed to issue outward gate pass." };
  }
}
// -----------------------------------------------------------------------------
// 3. OUTSOURCE DYEING / PRINTING: RECEIVE RETURN (PARTIAL OR FULL WITH SHRINKAGE)
// -----------------------------------------------------------------------------
const OutsourceReturnSchema = z.object({
  batchId: z.string().min(1, "Batch ID is required"),
  receivedDate: z.string().optional(),
  vendorChallanNo: z.string().trim().min(1, "Dyer delivery slip # is required"),
  accountedQty: z.coerce.number().positive("Accounted quantity must be positive").optional(),
  receivedQty: z.coerce.number().positive("Physical received quantity must be positive"),
  remarks: z.string().optional(),
});

export async function returnOutsourceBatchAction(
  prevState: FabricActionState | null,
  formData: FormData
): Promise<FabricActionState> {
  const session = await requireAuth();

  const rawAccounted = formData.get("accountedQty") || formData.get("accountedMeters") || undefined;
  const rawReceived = formData.get("receivedQty") || formData.get("receivedMeters");

  const rawData = {
    batchId: formData.get("batchId"),
    receivedDate: formData.get("receivedDate") || undefined,
    vendorChallanNo: formData.get("vendorChallanNo"),
    accountedQty: rawAccounted,
    receivedQty: rawReceived,
    remarks: formData.get("remarks") || undefined,
  };

  const parsed = OutsourceReturnSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { batchId, receivedDate, vendorChallanNo, receivedQty, remarks } = parsed.data;
  const dateReturn = parseLedgerDate(receivedDate, 3);

  try {
    const batch = await prisma.outsourceBatch.findUnique({
      where: { id: batchId },
      include: { vendor: true, inward: true },
    });

    if (!batch) {
      return { error: "Outsource batch record not found." };
    }

    const isPieces = batch.itemCategory === "PIECES" || batch.unit === "PIECES";
    const selectedReturnUnit = formData.get("returnUnit") as string | null;

    if (!isPieces && !selectedReturnUnit) {
      return { error: "Please select delivery slip unit (Meters or Yards)." };
    }

    const effectiveUnit = isPieces ? "PIECES" : (selectedReturnUnit || batch.unit || "METERS");
    const unitLabel = isPieces ? "pcs" : effectiveUnit === "YARDS" ? "yd" : "m";

    const totalSentInBatchUnit = Number(batch.sentMeters);
    const prevAccountedInBatchUnit = Number(batch.accountedMeters || 0);
    const pendingInBatchUnit = Math.max(0, totalSentInBatchUnit - prevAccountedInBatchUnit);

    // Convert pending to effectiveUnit
    let pendingWithVendor = pendingInBatchUnit;
    if (!isPieces) {
      if (batch.unit === "YARDS" && effectiveUnit === "METERS") {
        pendingWithVendor = Number(yardsToMeters(pendingInBatchUnit).toFixed(2));
      } else if (batch.unit === "METERS" && effectiveUnit === "YARDS") {
        pendingWithVendor = Number(metersToYards(pendingInBatchUnit).toFixed(2));
      }
    }

    const accountedQty = parsed.data.accountedQty ?? pendingWithVendor;

    if (accountedQty > pendingWithVendor + 0.05) {
      return {
        error: `Cannot account for ${accountedQty} ${unitLabel}. Only ${pendingWithVendor} ${unitLabel} is currently pending with vendor.`,
      };
    }

    const shrinkageQty = Number((accountedQty - receivedQty).toFixed(2));
    const shrinkagePercent =
      accountedQty > 0 ? Number(((shrinkageQty / accountedQty) * 100).toFixed(2)) : 0;

    // What needs to be added to batch.accountedMeters (in batch.unit)?
    let accountedInBatchUnit = accountedQty;
    let receivedInBatchUnit = receivedQty;
    let shrinkageInBatchUnit = shrinkageQty;

    if (!isPieces) {
      if (effectiveUnit === "METERS" && batch.unit === "YARDS") {
        accountedInBatchUnit = Number(metersToYards(accountedQty).toFixed(2));
        receivedInBatchUnit = Number(metersToYards(receivedQty).toFixed(2));
        shrinkageInBatchUnit = Number(metersToYards(shrinkageQty).toFixed(2));
      } else if (effectiveUnit === "YARDS" && batch.unit === "METERS") {
        accountedInBatchUnit = Number(yardsToMeters(accountedQty).toFixed(2));
        receivedInBatchUnit = Number(yardsToMeters(receivedQty).toFixed(2));
        shrinkageInBatchUnit = Number(yardsToMeters(shrinkageQty).toFixed(2));
      }
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.outsourceBatchReturn.create({
        data: {
          batchId,
          vendorChallanNo,
          unit: effectiveUnit,
          accountedMeters: accountedQty,
          receivedMeters: receivedQty,
          shrinkageMeters: shrinkageQty,
          shrinkagePercent,
          returnDate: dateReturn,
          receivedById: session.userId,
          remarks,
        },
      });

      const newAccounted = Number((prevAccountedInBatchUnit + accountedInBatchUnit).toFixed(2));
      const newReceived = Number(((Number(batch.receivedMeters) || 0) + receivedInBatchUnit).toFixed(2));
      const newShrinkage = Number(((Number(batch.shrinkageMeters) || 0) + shrinkageInBatchUnit).toFixed(2));
      const isComplete = newAccounted >= totalSentInBatchUnit - 0.05;
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
      if (isPieces) {
        const accountedPcs = Math.round(accountedQty);
        const receivedPcs = Math.round(receivedQty);
        const lossPcs = Math.max(0, Math.round(shrinkageQty));

        await tx.fabricLedgerEntry.create({
          data: {
            partyId: batch.partyId,
            partyChallanNo: inwardRef || null,
            inwardId: batch.inwardId || null,
            inwardItemId: batch.inwardItemId || null,
            itemCategory: "PIECES",
            unit: "PIECES",
            movementType: "INWARD_FROM_VENDOR",
            referenceNumber: batch.ogpNumber,
            creditMeters: 0,
            debitMeters: 0,
            shrinkageMeters: 0,
            creditPieces: accountedPcs,
            debitPieces: 0,
            shortagePieces: lossPcs,
            runningPieces: 0,
            timestamp: dateReturn,
            notes: `Received from ${batch.vendor.name} Dyer Slip #${vendorChallanNo}${
              inwardRef ? ` [Ref: #${inwardRef}]` : ""
            } (${batch.processType}, ${batch.targetShade}). Received: ${receivedPcs} pcs | Vendor Loss: ${lossPcs} pcs [Accounted: ${accountedPcs} pcs]`,
          },
        });
      } else {
        const stdAccounted = batch.unit === "YARDS" ? yardsToMeters(accountedQty) : accountedQty;
        const stdShrinkage = batch.unit === "YARDS" ? yardsToMeters(shrinkageQty) : shrinkageQty;

        await tx.fabricLedgerEntry.create({
          data: {
            partyId: batch.partyId,
            partyChallanNo: inwardRef || null,
            inwardId: batch.inwardId || null,
            inwardItemId: batch.inwardItemId || null,
            itemCategory: "CONTINUOUS",
            unit: batch.unit || "METERS",
            movementType: "INWARD_FROM_VENDOR",
            referenceNumber: batch.ogpNumber,
            creditMeters: stdAccounted,
            debitMeters: 0,
            shrinkageMeters: stdShrinkage > 0 ? stdShrinkage : 0,
            runningBalance: 0,
            timestamp: dateReturn,
            notes: `Received from ${batch.vendor.name} Dyer Slip #${vendorChallanNo}${
              inwardRef ? ` [Ref: #${inwardRef}]` : ""
            } (${batch.processType}, ${batch.targetShade}). Received: ${receivedQty.toFixed(2)}${unitLabel} | Technical Shrinkage: ${shrinkageQty.toFixed(2)}${unitLabel} (${shrinkagePercent.toFixed(2)}%) [Accounted: ${accountedQty.toFixed(2)}${unitLabel}]`,
          },
        });
      }

      await reconcilePartyLedger(tx, batch.partyId);
    }, { maxWait: 15000, timeout: 45000 });

    revalidatePath("/dashboard");
    revalidatePath("/outsource");
    revalidatePath("/ledger");

    const remaining = Number((pendingWithVendor - accountedQty).toFixed(2));
    const remainingText = remaining > 0 ? ` (Remaining with vendor: ${remaining} ${unitLabel})` : " (Batch completed)";

    return {
      success: true,
      message: `Return recorded on Dyer Slip #${vendorChallanNo}: +${receivedQty} ${unitLabel} received, -${shrinkageQty} ${unitLabel} shrinkage${remainingText}.`,
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
    }, { maxWait: 15000, timeout: 45000 });

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
