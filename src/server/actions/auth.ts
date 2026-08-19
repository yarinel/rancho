"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import * as schema from "@/db/schema";
import { verifyPassword } from "@/server/password";
import { createSessionToken, SESSION_COOKIE } from "@/server/session";
import { logAudit } from "@/server/log";
import { clientKeyFromHeaders, rateLimit } from "@/server/rate-limit";
import { headers } from "next/headers";

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

  // brute-force / scrypt-DoS protection: throttle by client AND by target account
  const h = await headers();
  const ip = clientKeyFromHeaders(h);
  if (
    !rateLimit(`login:ip:${ip}`, 10, 15 * 60 * 1000) ||
    !rateLimit(`login:email:${email}`, 10, 15 * 60 * 1000)
  ) {
    return { error: "יותר מדי נסיונות — נסו שוב בעוד רבע שעה" };
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
