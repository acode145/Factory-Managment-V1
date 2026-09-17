"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const CreateVendorSchema = z.object({
  name: z.string().trim().min(2, "Vendor name must be at least 2 characters"),
  contactPerson: z.string().trim().min(2, "Contact person name is required"),
  phone: z.string().trim().min(5, "Valid phone number is required"),
  address: z.string().trim().optional().or(z.literal("")),
});

export type VendorActionState = {
  error?: string;
  success?: boolean;
  message?: string;
  vendor?: {
    id: string;
    code: string;
    name: string;
    contactPerson: string | null;
    phone: string | null;
    address: string | null;
  };
};

/**
 * Generate the next sequential vendor code (e.g. VND-001 -> VND-002 -> VND-003)
 */
export async function getNextVendorCode(): Promise<string> {
  const allVendors = await prisma.vendor.findMany({
    select: { code: true },
  });

  let maxNum = 0;
  for (const v of allVendors) {
    const match = v.code.match(/^VND-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  return `VND-${String(maxNum + 1).padStart(3, "0")}`;
}

/**
 * Server action to register a new outsource vendor (Dyer, Printer, Raffu, etc.).
 * Simplified to require only name, contact person, phone, and optional address.
 * Sets default process to "GENERAL" without burdening operator with service selection.
 * Rights restricted to ADMIN and FABRIC_PROCESSING_INCHARGE.
 */
export async function createVendorAction(
  prevState: VendorActionState | null,
  formData: FormData
): Promise<VendorActionState> {
  const session = await requireAuth();

  // Strict RBAC: Only Admin and Fabric Processing Incharge have creation rights
  if (session.role !== "ADMIN" && session.role !== "FABRIC_PROCESSING_INCHARGE") {
    return {
      error: "Access denied. Only Admin and Fabric Processing Incharge have permissions to register vendors.",
    };
  }

  const rawData = {
    name: formData.get("name"),
    contactPerson: formData.get("contactPerson"),
    phone: formData.get("phone"),
    address: formData.get("address"),
  };

  const parsed = CreateVendorSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { name, contactPerson, phone, address } = parsed.data;

  // Check duplicate vendor name (case-insensitive)
  const existingName = await prisma.vendor.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
  });

  if (existingName) {
    return {
      error: `A vendor named "${name}" already exists in the database (${existingName.code}).`,
    };
  }

  // Generate next sequential VND-XXX code
  const nextCode = await getNextVendorCode();

  const newVendor = await prisma.vendor.create({
    data: {
      code: nextCode,
      name,
      defaultProcess: "GENERAL",
      contactPerson,
      phone,
      address: address && address.length > 0 ? address : null,
      isActive: true,
    },
    select: {
      id: true,
      code: true,
      name: true,
      contactPerson: true,
      phone: true,
      address: true,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/admin");

  return {
    success: true,
    message: `Outsource Vendor "${newVendor.name}" registered successfully with ID ${newVendor.code}.`,
    vendor: newVendor,
  };
}
