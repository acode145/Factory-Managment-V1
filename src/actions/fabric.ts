"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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

  let running = 0;
  for (const entry of allEntries) {
    const credit = Number(entry.creditMeters || 0);
    const debit = Number(entry.debitMeters || 0);
    const shrinkage = Number(entry.shrinkageMeters || 0);
    running = Number((running + credit - debit - shrinkage).toFixed(2));

    if (Number(entry.runningBalance) !== running) {
      await tx.fabricLedgerEntry.update({
        where: { id: entry.id },
        data: { runningBalance: running },
      });
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
// 1. PARTY FABRIC INWARD (GATE IN)
// -----------------------------------------------------------------------------
const InwardSchema = z.object({
  challanDate: z.string().optional(),
  partyId: z.string().min(1, "Party selection is required"),
  partyChallanNo: z.string().trim().min(1, "Party Challan # is required"),
  fabricType: z.string().trim().min(1, "Fabric type is required"),
  colorShade: z.string().trim().min(1, "Color / Shade is required"),
  rollCount: z.coerce.number().int().positive("Roll count must be greater than 0"),
  challanMeters: z.coerce.number().positive("Party Challan meterage must be positive"),
  measuredMeters: z.coerce.number().positive("Physical measured meterage must be positive"),
  driverDetails: z.string().optional(),
  remarks: z.string().optional(),
});

export async function createPartyInwardAction(
  prevState: FabricActionState | null,
  formData: FormData
): Promise<FabricActionState> {
  const session = await requireAuth();

  const rawData = {
    challanDate: formData.get("challanDate") || undefined,
    partyId: formData.get("partyId"),
    partyChallanNo: formData.get("partyChallanNo"),
    fabricType: formData.get("fabricType"),
    colorShade: formData.get("colorShade"),
    rollCount: formData.get("rollCount"),
    challanMeters: formData.get("challanMeters"),
    measuredMeters: formData.get("measuredMeters"),
    driverDetails: formData.get("driverDetails") || undefined,
    remarks: formData.get("remarks") || undefined,
  };

  const parsed = InwardSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const {
    challanDate,
    partyId,
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
  const shortageMeters = Number((challanMeters - measuredMeters).toFixed(2));
  const igpNumber = generateCode("IGP");

  try {
    await prisma.$transaction(async (tx: any) => {
      // 1. Create Inward Record (saves user-chosen challanDate, system createdAt auto)
      const inward = await tx.fabricInward.create({
        data: {
          igpNumber,
          partyId,
          partyChallanNo,
          fabricType,
          colorShade,
          rollCount,
          challanMeters,
          measuredMeters,
          shortageMeters,
          challanDate: dateClaimed,
          driverDetails,
          remarks,
          receivedById: session.userId,
        },
      });

      // 2. Row 1: Gross Claimed Party Inward (+Claimed Meters)
      await tx.fabricLedgerEntry.create({
        data: {
          partyId,
          movementType: "PARTY_INWARD",
          referenceNumber: igpNumber,
          creditMeters: challanMeters,
          debitMeters: 0,
          shrinkageMeters: 0,
          runningBalance: 0, // Computed by reconcilePartyLedger
          timestamp: dateClaimed,
          notes: `Inward Challan #${partyChallanNo} (${rollCount} rolls of ${colorShade} ${fabricType})`,
        },
      });

      // 3. Row 2: Dock Measurement Shortage Deduction (-Shortage in Shrinkage column), if shortage > 0
      if (shortageMeters > 0) {
        await tx.fabricLedgerEntry.create({
          data: {
            partyId,
            movementType: "INWARD_SHORTAGE",
            referenceNumber: igpNumber,
            creditMeters: 0,
            debitMeters: 0,
            shrinkageMeters: shortageMeters,
            runningBalance: 0, // Computed by reconcilePartyLedger
            timestamp: dateShortage,
            notes: `Inward Shortage: Challan #${partyChallanNo} claimed ${challanMeters.toFixed(2)}m vs measured ${measuredMeters.toFixed(2)}m (-${shortageMeters.toFixed(2)}m)`,
          },
        });
      }

      // 4. Synchronize all running balances chronologically
      await reconcilePartyLedger(tx, partyId);

      return inward;
    });

    revalidatePath("/dashboard");
    revalidatePath("/ledger");
    return {
      success: true,
      message: `Inward Gate Pass ${igpNumber} generated. Full claimed +${challanMeters}m credited${
        shortageMeters > 0 ? ` and -${shortageMeters}m shortage logged in ledger` : ""
      }.`,
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

    // Build human-readable audit change log
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
      // 1. Update Inward Record
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

      // 2. Synchronize Row 1: PARTY_INWARD ledger entry (Gross claimed meters)
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
            timestamp: dateClaimed,
            notes: `Inward Challan #${partyChallanNo} (${rollCount} rolls of ${colorShade} ${fabricType}) [Edited]`,
          },
        });
      }

      // 3. Synchronize Row 2: INWARD_SHORTAGE ledger entry
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
              timestamp: dateShortage,
              notes: `Inward Shortage: Challan #${partyChallanNo} claimed ${challanMeters.toFixed(2)}m vs measured ${measuredMeters.toFixed(2)}m (-${newShortage.toFixed(2)}m) [Edited]`,
            },
          });
        } else {
          await tx.fabricLedgerEntry.create({
            data: {
              partyId: existing.partyId,
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
        // If shortage was revised to zero/surplus, remove shortage deduction
        await tx.fabricLedgerEntry.delete({
          where: { id: shortageEntry.id },
        });
      }

      // 4. Synchronize all running balances chronologically
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
// -----------------------------------------------------------------------------
const OutsourceDispatchSchema = z.object({
  sentDate: z.string().optional(),
  partyId: z.string().min(1, "Party is required"),
  vendorId: z.string().min(1, "Dyeing / Printing vendor is required"),
  inwardId: z.string().optional(),
  processType: z.string().default("SOLID_DYEING"),
  targetShade: z.string().trim().min(1, "Target color / shade specification is required"),
  sentMeters: z.coerce.number().positive("Sent meters must be positive"),
});

export async function createOutsourceDispatchAction(
  prevState: FabricActionState | null,
  formData: FormData
): Promise<FabricActionState> {
  const session = await requireAuth();

  const rawData = {
    sentDate: formData.get("sentDate") || undefined,
    partyId: formData.get("partyId"),
    vendorId: formData.get("vendorId"),
    inwardId: formData.get("inwardId") || undefined,
    processType: formData.get("processType"),
    targetShade: formData.get("targetShade"),
    sentMeters: formData.get("sentMeters"),
  };

  const parsed = OutsourceDispatchSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { sentDate, partyId, vendorId, inwardId, processType, targetShade, sentMeters } = parsed.data;
  const dateDispatch = parseLedgerDate(sentDate, 2);
  const ogpNumber = generateCode("OGP");

  try {
    const [party, vendor, lastEntry] = await Promise.all([
      prisma.party.findUnique({ where: { id: partyId } }),
      prisma.vendor.findUnique({ where: { id: vendorId } }),
      prisma.fabricLedgerEntry.findFirst({
        where: { partyId },
        orderBy: [
          { timestamp: "desc" },
          { createdAt: "desc" },
          { id: "desc" },
        ],
      }),
    ]);

    if (!party) return { error: "Party not found." };
    if (!vendor) return { error: "Vendor not found." };

    const currentBalance = lastEntry ? Number(lastEntry.runningBalance) : 0;
    if (sentMeters > currentBalance) {
      return {
        error: `Cannot dispatch ${sentMeters.toFixed(2)}m. Party ${party.name} currently only has ${currentBalance.toFixed(2)}m in factory custody.`,
      };
    }

    await prisma.$transaction(async (tx: any) => {
      // 1. Create Outsource Batch
      await tx.outsourceBatch.create({
        data: {
          ogpNumber,
          partyId,
          vendorId,
          inwardId,
          processType,
          targetShade,
          sentMeters,
          sentDate: dateDispatch,
          sentById: session.userId,
          status: "WITH_VENDOR",
        },
      });

      // 2. Post Outward Dispatch Entry to Party Fabric Ledger
      await tx.fabricLedgerEntry.create({
        data: {
          partyId,
          movementType: "OUTWARD_TO_VENDOR",
          referenceNumber: ogpNumber,
          creditMeters: 0,
          debitMeters: sentMeters,
          shrinkageMeters: 0,
          runningBalance: 0, // Computed by reconcilePartyLedger
          timestamp: dateDispatch,
          notes: `Dispatched to ${vendor.name} for ${processType} (Target: ${targetShade})`,
        },
      });

      // 3. Synchronize all running balances chronologically
      await reconcilePartyLedger(tx, partyId);
    });

    revalidatePath("/dashboard");
    revalidatePath("/outsource");
    revalidatePath("/ledger");
    return {
      success: true,
      message: `Outward Gate Pass ${ogpNumber} issued for ${sentMeters}m to ${vendor.name}. Logged in party ledger.`,
    };
  } catch (err: any) {
    console.error("Outsource dispatch error:", err);
    return { error: err.message || "Failed to issue outward gate pass." };
  }
}

// -----------------------------------------------------------------------------
// 3. OUTSOURCE DYEING / PRINTING: RECEIVE RETURN WITH SHRINKAGE
// -----------------------------------------------------------------------------
const OutsourceReturnSchema = z.object({
  batchId: z.string().min(1, "Batch ID is required"),
  receivedDate: z.string().optional(),
  vendorChallanNo: z.string().trim().min(1, "Vendor Return Challan # is required"),
  receivedMeters: z.coerce.number().positive("Received meters must be positive"),
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
      include: { vendor: true },
    });

    if (!batch) {
      return { error: "Outsource batch record not found." };
    }

    const sentMeters = Number(batch.sentMeters);
    const shrinkageMeters = Number((sentMeters - receivedMeters).toFixed(2));
    const shrinkagePercent = Number(((shrinkageMeters / sentMeters) * 100).toFixed(2));

    await prisma.$transaction(async (tx: any) => {
      // 1. Update Batch status
      await tx.outsourceBatch.update({
        where: { id: batchId },
        data: {
          status: "RECEIVED_COMPLETE",
          vendorChallanNo,
          receivedMeters,
          shrinkageMeters,
          shrinkagePercent,
          receivedDate: dateReturn,
          receivedById: session.userId,
          remarks,
        },
      });

      // 2. Option A Ledger Entry:
      // Inward (+) receives gross sentMeters (+5,000m)
      // Shrinkage (-) deducts process loss (-300m)
      // Net custody balance increases by +receivedMeters!
      await tx.fabricLedgerEntry.create({
        data: {
          partyId: batch.partyId,
          movementType: "INWARD_FROM_VENDOR",
          referenceNumber: batch.ogpNumber,
          creditMeters: sentMeters,
          debitMeters: 0,
          shrinkageMeters: shrinkageMeters > 0 ? shrinkageMeters : 0,
          runningBalance: 0, // Computed by reconcilePartyLedger
          timestamp: dateReturn,
          notes: `Received from ${batch.vendor.name} Challan #${vendorChallanNo} (${batch.processType}, ${batch.targetShade}). Received: ${receivedMeters.toFixed(2)}m | Technical Shrinkage: ${shrinkageMeters.toFixed(2)}m (${shrinkagePercent.toFixed(2)}%)`,
        },
      });

      // 3. Synchronize all running balances chronologically
      await reconcilePartyLedger(tx, batch.partyId);
    });

    revalidatePath("/dashboard");
    revalidatePath("/outsource");
    revalidatePath("/ledger");
    return {
      success: true,
      message: `Return accepted: ${receivedMeters}m received. Shrinkage logged: ${shrinkageMeters}m (${shrinkagePercent}%).`,
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

  const { partyId, fabricType, colorShade, totalRolls, totalMeters, vehicleDriver, remarks } =
    parsed.data;

  const dateDelivery = parseLedgerDate(undefined, 4);
  const challanNumber = generateCode("DC");

  try {
    await prisma.$transaction(async (tx: any) => {
      // 1. Create Delivery Challan
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
              fabricType,
              colorShade,
              metersDelivered: totalMeters,
              rollsDelivered: totalRolls,
            },
          },
        },
      });

      // 2. Post Debit to Party Fabric Ledger
      await tx.fabricLedgerEntry.create({
        data: {
          partyId,
          movementType: "DELIVERY_TO_PARTY",
          referenceNumber: challanNumber,
          creditMeters: 0,
          debitMeters: totalMeters,
          shrinkageMeters: 0,
          runningBalance: 0, // Computed by reconcilePartyLedger
          timestamp: dateDelivery,
          notes: `Dispatched on Delivery Challan #${challanNumber} (${totalRolls} rolls of ${colorShade} ${fabricType})`,
        },
      });

      // 3. Synchronize all running balances chronologically
      await reconcilePartyLedger(tx, partyId);

      return challan;
    });

    revalidatePath("/dashboard");
    revalidatePath("/deliveries");
    revalidatePath("/ledger");
    return {
      success: true,
      message: `Delivery Challan ${challanNumber} generated for ${totalMeters}m. Party balance updated.`,
    };
  } catch (err: any) {
    console.error("Delivery error:", err);
    return { error: err.message || "Failed to create delivery challan." };
  }
}
