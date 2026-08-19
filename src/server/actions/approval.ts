"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/server/db";
import * as schema from "@/db/schema";
import { logEvent } from "@/server/log";
import { rateLimit } from "@/server/rate-limit";

/**
 * Customer decision on proposed additional work, via the status-page link.
 * ApprovalRecords are immutable once decided — a second decision is rejected.
 */
export async function decideApprovalAction(
  jobToken: string,
  approvalId: string,
  decision: "APPROVED" | "DECLINED",
  approverName: string,
): Promise<{ ok: boolean; error?: string }> {
  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`approve:${ip}`, 20, 10 * 60 * 1000)) {
    return { ok: false, error: "יותר מדי נסיונות" };
  }
  if (!approverName || approverName.trim().length < 2) {
    return { ok: false, error: "נא לרשום שם מאשר" };
  }

  const d = await db();
  const jobs = await d
    .select()
    .from(schema.serviceJobs)
    .where(eq(schema.serviceJobs.publicToken, jobToken));
  const job = jobs[0];
  if (!job) return { ok: false, error: "לא נמצא" };

  const approvals = await d
    .select()
    .from(schema.approvalRecords)
    .where(
      and(
        eq(schema.approvalRecords.id, approvalId),
        eq(schema.approvalRecords.jobId, job.id),
      ),
    );
  const approval = approvals[0];
  if (!approval) return { ok: false, error: "לא נמצא" };
  if (approval.decision !== "PENDING") {
    return { ok: false, error: "ההחלטה כבר נרשמה — אי אפשר לשנות אישור" };
  }

  await d
    .update(schema.approvalRecords)
    .set({
      decision,
      approverName: approverName.trim(),
      decidedAt: new Date(),
    })
    .where(
      and(
        eq(schema.approvalRecords.id, approvalId),
        eq(schema.approvalRecords.decision, "PENDING"), // immutability at the row level
      ),
    );

  if (approval.findingId) {
    await d
      .update(schema.findings)
      .set({ resolution: decision === "APPROVED" ? "OPEN" : "DECLINED" })
      .where(eq(schema.findings.id, approval.findingId));
  }

  await logEvent(
    d,
    "service_job",
    job.id,
    `approval:${decision}`,
    `customer:${jobToken.slice(0, 6)}`,
    { approvalId, price: approval.price },
  );
  revalidatePath(`/s/${jobToken}`);
  return { ok: true };
}
