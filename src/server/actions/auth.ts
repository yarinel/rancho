"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import * as schema from "@/db/schema";
import { verifyPassword } from "@/server/password";
import { createSessionToken, SESSION_COOKIE } from "@/server/session";
import { logAudit } from "@/server/log";

export interface LoginState {
  error?: string;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "נא למלא אימייל וסיסמה" };
  }

  const d = await db();
  const rows = await d
    .select()
    .from(schema.staffUsers)
    .where(eq(schema.staffUsers.email, email));
  const user = rows[0];
  // uniform error — no user enumeration
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    return { error: "פרטי התחברות שגויים" };
  }

  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSessionToken(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  await logAudit(d, user.id, "login", "staff_user", user.id);
  redirect("/pro");
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/pro/login");
}
