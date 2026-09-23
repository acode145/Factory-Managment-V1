"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const CreateUserSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters"),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Username must be at least 3 characters")
    .regex(/^[a-z0-9_]+$/, "Username can only contain lowercase letters, numbers, and underscores"),
  password: z.string().min(4, "Password/PIN must be at least 4 characters"),
  role: z.enum([
    "ADMIN",
    "STOREKEEPER",
    "FLOOR_SUPERVISOR",
    "GATE_CLERK",
    "FABRIC_PROCESSING_INCHARGE",
  ]),
  department: z.string().optional(),
});

export type AdminActionState = {
  error?: string;
  success?: boolean;
  message?: string;
};

export async function createUserAction(
  prevState: AdminActionState | null,
  formData: FormData
): Promise<AdminActionState> {
  const session = await requireAuth();
  if (session.role !== "ADMIN") {
    return { error: "Access denied. Only Super Admin can provision users." };
  }

  const rawData = {
    fullName: formData.get("fullName"),
    username: formData.get("username"),
    password: formData.get("password"),
    role: formData.get("role"),
    department: formData.get("department") || undefined,
  };

  const parsed = CreateUserSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { fullName, username, password, role, department } = parsed.data;

  // Check unique username
  const existing = await prisma.user.findUnique({
    where: { username },
  });

  if (existing) {
    return { error: `Username "${username}" is already taken.` };
  }

  await prisma.user.create({
    data: {
      fullName,
      username,
      password, // Visible per admin requirement
      role,
      department: department && department.trim() ? department.trim() : null,
      isActive: true,
    },
  });

  revalidatePath("/admin");
  return { success: true, message: `User "${fullName}" (@${username}) created successfully.` };
}

export async function toggleUserStatusAction(userId: string): Promise<AdminActionState> {
  const session = await requireAuth();
  if (session.role !== "ADMIN") {
    return { error: "Access denied." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { error: "User not found." };
  }

  // Prevent admin from deactivating themselves
  if (user.id === session.userId) {
    return { error: "You cannot deactivate your own account." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: !user.isActive },
  });

  revalidatePath("/admin");
  return { success: true, message: `User status updated.` };
}

export async function updatePasswordAction(userId: string, newPassword: string): Promise<AdminActionState> {
  const session = await requireAuth();
  if (session.role !== "ADMIN") {
    return { error: "Access denied." };
  }

  if (!newPassword || newPassword.trim().length < 4) {
    return { error: "Password must be at least 4 characters." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { password: newPassword.trim() },
  });

  revalidatePath("/admin");
  return { success: true, message: "Password updated successfully." };
}

export async function updateUserDepartmentAction(
  userId: string,
  department: string | null
): Promise<AdminActionState> {
  const session = await requireAuth();
  if (session.role !== "ADMIN") {
    return { error: "Access denied." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { error: "User not found." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { department: department && department.trim() ? department.trim() : null },
  });

  revalidatePath("/admin");
  return { success: true, message: `Updated workstation department for ${user.fullName}.` };
}
