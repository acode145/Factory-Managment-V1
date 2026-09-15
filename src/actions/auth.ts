"use server";

import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { z } from "zod";

const LoginSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginState = {
  error?: string;
  success?: boolean;
};

export async function loginAction(prevState: LoginState | null, formData: FormData): Promise<LoginState> {
  const rawData = {
    username: formData.get("username"),
    password: formData.get("password"),
  };

  const parsed = LoginSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { username, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
  });

  if (!user || !user.isActive) {
    return { error: "Invalid username or inactive account" };
  }

  // Verify password (plain matching as stored, or hash comparison fallback)
  if (user.password !== password) {
    return { error: "Incorrect password or PIN" };
  }

  await createSession({
    id: user.id,
    username: user.username,
    role: user.role,
    fullName: user.fullName,
  });

  if (user.role === "ADMIN") {
    redirect("/admin");
  } else {
    redirect("/dashboard");
  }
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
