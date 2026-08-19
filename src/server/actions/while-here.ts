"use server";

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import * as schema from "@/db/schema";
import { logEvent } from "@/server/log";
import { clientKeyFromHeaders, rateLimit } from "@/server/rate-limit";

/**
 * While-you-are-here (P1): we are already coming to this household — one tap
 * asks Ran to look at another bike on the same visit. Lands in the requests
 * inbox flagged WHILE_YOU_ARE_HERE; the operator decides feasibility (it never
 * silently extends the visit or changes the price).
 */
export async function addWhileHereAction(
  jobToken: string,
  bicycleId: string,
): Promise<{ ok: boolean; error?: string }> {
  const h = await headers();
  const ip = clientKeyFromHeaders(h);
  if (!rateLimit(`whilehere:${ip}`, 10, 10 * 60 * 1000)) {
    return { ok: false, error: "יותר מדי בקשות" };
  }

  const d = await db();
  const jobs = await d
    .select()
    .from(schema.serviceJobs)
    .where(eq(schema.serviceJobs.publicToken, jobToken));
  const job = jobs[0];
  if (!job || job.status !== "SCHEDULED") {
    return { ok: false, error: "הבקשה זמינה רק לביקור מתוכנן" };
  }

  // the bike must belong to the SAME household — token holders cannot probe others
  const bikes = await d
    .select()
    .from(schema.bicycles)
    .where(
      and(
        eq(schema.bicycles.id, bicycleId),
        eq(schema.bicycles.householdId, job.householdId),
      ),
    );
  if (bikes.length === 0) return { ok: false, error: "אופניים לא נמצאו" };

  // one open while-here request per bike per visit
  const existing = await d
    .select()
    .from(schema.serviceRequests)
    .where(
      and(
        eq(schema.serviceRequests.bicycleId, bicycleId),
        eq(schema.serviceRequests.statusReason, "WHILE_YOU_ARE_HERE"),
        eq(schema.serviceRequests.status, "NEEDS_REVIEW"),
      ),
    );
  if (existing.length > 0) return { ok: true };

  const [request] = await d
    .insert(schema.serviceRequests)
    .values({
      publicToken: randomBytes(16).toString("hex"),
      householdId: job.householdId,
      customerId: job.customerId,
      bicycleId,
      locationId: job.locationId,
      status: "NEEDS_REVIEW",
      statusReason: "WHILE_YOU_ARE_HERE",
      symptomCategory: "unknown",
      intakeAnswers: {
        _linked_job_token: jobToken,
        _note: "הלקוח ביקש הצצה על אופניים נוספים באותו ביקור",
      },
    })
    .returning();

  await logEvent(
    d,
    "service_request",
    request.id,
    "while_you_are_here",
    `customer:${jobToken.slice(0, 6)}`,
    { bicycleId, linkedJob: job.id },
  );
  revalidatePath(`/s/${jobToken}`);
  return { ok: true };
}
