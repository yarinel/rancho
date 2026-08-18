import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@/db/schema";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export interface StaffSession {
  id: string;
  email: string;
  name: string;
  role: string;
  technicianId: string | null;
}

/** Single staff gate (decision D14) — call at the top of EVERY /pro page and server action. */
export async function requireStaff(): Promise<StaffSession> {
  const staff = await getStaff();
  if (!staff) redirect("/pro/login");
  return staff;
}

export async function getStaff(): Promise<StaffSession | null> {
  const jar = await cookies();
  const session = verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const d = await db();
  const rows = await d
    .select()
    .from(schema.staffUsers)
    .where(eq(schema.staffUsers.id, session.userId));
  const user = rows[0];
  if (!user || !user.active) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    technicianId: user.technicianId,
  };
}
