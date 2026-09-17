"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const CreatePartySchema = z.object({
  name: z.string().trim().min(2, "Party name must be at least 2 characters"),
  contactPerson: z.string().trim().min(2, "Contact person name is required"),
  phone: z.string().trim().min(5, "Valid phone number is required"),
  address: z.string().trim().optional().or(z.literal("")),
});

export type PartyActionState = {
  error?: string;
  success?: boolean;
  message?: string;
  party?: {
    id: string;
    code: string;
    name: string;
    contactPerson: string | null;
    phone: string | null;
    address: string | null;
  };
};

/**
 * Generate the next sequential party code (e.g. PRT-001 -> PRT-002 -> PRT-004)
 */
export async function getNextPartyCode(): Promise<string> {
  const allParties = await prisma.party.findMany({
    select: { code: true },
  });

  let maxNum = 0;
  for (const p of allParties) {
    const match = p.code.match(/^PRT-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  return `PRT-${String(maxNum + 1).padStart(3, "0")}`;
}

/**
 * Server action to register a new client party.
 * Rights strictly restricted to ADMIN and FABRIC_PROCESSING_INCHARGE.
 */
export async function createPartyAction(
  prevState: PartyActionState | null,
  formData: FormData
): Promise<PartyActionState> {
  const session = await requireAuth();

  // Strict RBAC: Only Admin and Fabric Processing Incharge have creation rights
  if (session.role !== "ADMIN" && session.role !== "FABRIC_PROCESSING_INCHARGE") {
    return {
      error: "Access denied. Only Admin and Fabric Processing Incharge have permissions to create parties.",
    };
  }

  const rawData = {
    name: formData.get("name"),
    contactPerson: formData.get("contactPerson"),
    phone: formData.get("phone"),
    address: formData.get("address"),
  };

  const parsed = CreatePartySchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { name, contactPerson, phone, address } = parsed.data;

  // Check duplicate party name (case-insensitive)
  const existingName = await prisma.party.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
  });

  if (existingName) {
    return {
      error: `A party named "${name}" already exists in the database (${existingName.code}).`,
    };
  }

  // Generate next sequential PRT-XXX code
  const nextCode = await getNextPartyCode();

  const newParty = await prisma.party.create({
    data: {
      code: nextCode,
      name,
      partyType: "REGULAR_CLIENT",
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
    message: `Party "${newParty.name}" registered successfully with ID ${newParty.code}.`,
    party: newParty,
  };
}
