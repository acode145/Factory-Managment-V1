"use server";

import { destroySession, signInWithPassword } from "@/lib/auth";
import { redirect } from "next/navigation";

export type LoginState = {
  error?: string;
  success?: boolean;
};

export async function loginAction(prevState: LoginState | null, formData: FormData): Promise<LoginState> {
  const result = await signInWithPassword(formData);
  if ("error" in result) return { error: result.error };

  if (result.role === "ADMIN") {
    redirect("/admin");
  } else {
    redirect("/dashboard");
  }
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
