"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

function generateCode(prefix: string) {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 90 + 10);
  return `${prefix}-${timestamp}${random}`;
}

import { WORKSTATION_DEPARTMENTS, WorkstationDepartment } from "@/lib/workstations";
import { metersToYards } from "@/lib/units";

const TransferSchema = z.object({
  partyId: z.string().min(1, "Party is required"),
  inwardId: z.string().optional(),
  inwardItemId: z.string().optional(),
  fabricDescription: z.string().trim().min(1, "Fabric description is required"),
  unit: z.enum(["METERS", "YARDS", "PIECES"]).default("METERS"),
  fromDepartment: z.enum(WORKSTATION_DEPARTMENTS, {
    message: "Invalid source department.",
  }),
  toDepartment: z.enum(WORKSTATION_DEPARTMENTS, {
    message: "Invalid destination department.",
  }),
  quantity: z.coerce.number().positive("Transfer quantity must be greater than 0"),
  damagedQuantity: z.coerce.number().min(0).default(0),
  machineNumber: z.string().trim().optional(),
  operatorName: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
  transferDate: z.string().optional(),
});

export type TransferActionState = {
  error?: string;
  success?: boolean;
  message?: string;
};

export async function createDepartmentTransferAction(
  prevState: TransferActionState | null,
  formData: FormData
): Promise<TransferActionState> {
  const session = await requireAuth();

  const rawData = {
    partyId: formData.get("partyId"),
    inwardId: formData.get("inwardId") || undefined,
    inwardItemId: formData.get("inwardItemId") || undefined,
    fabricDescription: (formData.get("fabricDescription") as string)?.trim() || "General Fabric",
    unit: formData.get("unit") || "METERS",
    fromDepartment: formData.get("fromDepartment"),
    toDepartment: formData.get("toDepartment"),
    quantity: formData.get("quantity"),
    damagedQuantity: formData.get("damagedQuantity") || 0,
    machineNumber: formData.get("machineNumber") || undefined,
    operatorName: formData.get("operatorName") || undefined,
    remarks: formData.get("remarks") || undefined,
    transferDate: formData.get("transferDate") || undefined,
  };

  const parsed = TransferSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const {
    partyId,
    inwardId,
    inwardItemId,
    fabricDescription,
    unit,
    fromDepartment,
    toDepartment,
    quantity,
    damagedQuantity,
    machineNumber,
    operatorName,
    remarks,
    transferDate,
  } = parsed.data;

  if (fromDepartment === toDepartment) {
    return { error: "Source and destination departments cannot be the same." };
  }

  // Enforce origin department lock for department incharges
  const isUnrestricted =
    session.role === "ADMIN" ||
    session.role === "FABRIC_PROCESSING_INCHARGE" ||
    !session.department;

  if (!isUnrestricted && session.department && fromDepartment !== session.department) {
    return {
      error: `Access Denied: You are assigned to ${session.department}. You can only transfer fabric FROM ${session.department}.`,
    };
  }

  // Calculate current available quantity at fromDepartment for this lot/party
  const lotWhere: any = { partyId };
  if (inwardItemId) {
    lotWhere.inwardItemId = inwardItemId;
  } else if (inwardId) {
    lotWhere.inwardId = inwardId;
  }

  const previousTransfers = await prisma.departmentTransfer.findMany({
    where: lotWhere,
    select: {
      fromDepartment: true,
      toDepartment: true,
      quantity: true,
      damagedQuantity: true,
    },
  });

  // Calculate net transferred into and out of each department
  let qtyIntoFromDept = 0;
  let qtyOutOfFromDept = 0;

  for (const t of previousTransfers) {
    const q = Number(t.quantity);
    const d = Number(t.damagedQuantity || 0);

    if (t.toDepartment === fromDepartment) {
      qtyIntoFromDept += q;
    }
    if (t.fromDepartment === fromDepartment) {
      qtyOutOfFromDept += (q + d);
    }
  }

  let availableAtFromDept = qtyIntoFromDept - qtyOutOfFromDept;

  // If transferring from STORE, the starting base is the fabric balance currently in factory custody
  if (fromDepartment === "STORE") {
    let baseStoreQty = 0;

    let ledgerWhere: any = { partyId };
    if (inwardItemId) {
      ledgerWhere = {
        OR: [
          { inwardItemId },
          { inwardId: inwardId || undefined, inwardItemId: null },
        ],
      };
    } else if (inwardId) {
      ledgerWhere = { inwardId };
    }

    const ledgerEntries = await prisma.fabricLedgerEntry.findMany({
      where: ledgerWhere,
      select: {
        creditMeters: true,
        debitMeters: true,
        shrinkageMeters: true,
        creditPieces: true,
        debitPieces: true,
        shortagePieces: true,
        unit: true,
      },
    });

    if (unit === "PIECES") {
      const c = ledgerEntries.reduce((s, e) => s + Number(e.creditPieces || 0), 0);
      const d = ledgerEntries.reduce((s, e) => s + Number(e.debitPieces || 0), 0);
      const sh = ledgerEntries.reduce((s, e) => s + Number(e.shortagePieces || 0), 0);
      baseStoreQty = Math.max(0, c - d - sh);
    } else {
      const c = ledgerEntries.reduce((s, e) => s + Number(e.creditMeters || 0), 0);
      const d = ledgerEntries.reduce((s, e) => s + Number(e.debitMeters || 0), 0);
      const sh = ledgerEntries.reduce((s, e) => s + Number(e.shrinkageMeters || 0), 0);
      const netMeters = Math.max(0, Number((c - d - sh).toFixed(2)));
      baseStoreQty = unit === "YARDS" ? Number(metersToYards(netMeters).toFixed(2)) : netMeters;
    }

    // Include base store stock currently in factory custody
    availableAtFromDept = Math.max(0, Number((baseStoreQty + qtyIntoFromDept - qtyOutOfFromDept).toFixed(2)));
  }

  // Verification guard: cannot move more than available at source department
  if (quantity + damagedQuantity > availableAtFromDept + 0.01) {
    return {
      error: `Cannot transfer ${quantity} ${unit}. Only ${availableAtFromDept.toFixed(
        2
      )} ${unit} is available in ${fromDepartment} (Material may currently be with outsource dyer or already delivered).`,
    };
  }

  const transferNumber = generateCode("TRF");
  const effectiveDate = transferDate ? new Date(transferDate) : new Date();

  try {
    await prisma.departmentTransfer.create({
      data: {
        transferNumber,
        partyId,
        inwardId: inwardId || null,
        inwardItemId: inwardItemId || null,
        fabricDescription,
        unit,
        quantity,
        damagedQuantity,
        fromDepartment,
        toDepartment,
        machineNumber: machineNumber || null,
        operatorName: operatorName || null,
        remarks: remarks || null,
        transferredById: session.userId,
        transferDate: effectiveDate,
      },
    });

    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Transfer #${transferNumber} logged: Moved ${quantity} ${unit} from ${fromDepartment} to ${toDepartment}.`,
    };
  } catch (err: any) {
    console.error("Department transfer error:", err);
    return { error: err.message || "Failed to record department transfer." };
  }
}

export async function deleteDepartmentTransferAction(
  transferId: string
): Promise<TransferActionState> {
  const session = await requireAuth();

  try {
    const existing = await prisma.departmentTransfer.findUnique({
      where: { id: transferId },
    });

    if (!existing) {
      return { error: "Transfer record not found." };
    }

    await prisma.departmentTransfer.delete({
      where: { id: transferId },
    });

    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Transfer #${existing.transferNumber} deleted. Material returned to source workstation.`,
    };
  } catch (err: any) {
    console.error("Delete transfer error:", err);
    return { error: err.message || "Failed to delete transfer record." };
  }
}
