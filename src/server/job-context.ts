import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import type { JobContext } from "@/domain/job-machine";
import type { CheckResult, CheckType, SafetyPhase } from "@/domain/types";

/** Snapshot everything the state-machine guards need, from DB truth. */
export async function buildJobContext(
  d: Db,
  jobId: string,
): Promise<{
  job: typeof schema.serviceJobs.$inferSelect;
  ctx: JobContext;
} | null> {
  const jobs = await d
    .select()
    .from(schema.serviceJobs)
    .where(eq(schema.serviceJobs.id, jobId));
  const job = jobs[0];
  if (!job) return null;

  const [findings, approvals, checks, items, appointments, bikes] =
    await Promise.all([
      d.select().from(schema.findings).where(eq(schema.findings.jobId, jobId)),
      d
        .select()
        .from(schema.approvalRecords)
        .where(eq(schema.approvalRecords.jobId, jobId)),
      d
        .select()
        .from(schema.safetyChecks)
        .where(eq(schema.safetyChecks.jobId, jobId)),
      d
        .select()
        .from(schema.jobLineItems)
        .where(eq(schema.jobLineItems.jobId, jobId)),
      d
        .select()
        .from(schema.appointments)
        .where(eq(schema.appointments.jobId, jobId)),
      d
        .select()
        .from(schema.bicycles)
        .where(eq(schema.bicycles.id, job.bicycleId)),
    ]);

  const checkItemsByCheck = new Map<
    string,
    { checkType: CheckType; result: CheckResult }[]
  >();
  for (const check of checks) {
    const rows = await d
      .select()
      .from(schema.safetyCheckItems)
      .where(eq(schema.safetyCheckItems.safetyCheckId, check.id));
    checkItemsByCheck.set(
      check.id,
      rows.map((r) => ({
        checkType: r.checkType as CheckType,
        result: r.result as CheckResult,
      })),
    );
  }

  const approvalByFinding = new Map(
    approvals.filter((a) => a.findingId).map((a) => [a.findingId!, a]),
  );

  const ctx: JobContext = {
    bikeHasGears: bikes[0]?.hasGears ?? null,
    findings: findings.map((f) => ({
      id: f.id,
      severity: f.severity as never,
      resolution: f.resolution as never,
      proposedPrice: f.proposedPrice,
      hasProposal:
        f.proposedWorkHe != null || approvalByFinding.has(f.id),
    })),
    approvals: approvals.map((a) => ({
      id: a.id,
      findingId: a.findingId,
      decision: a.decision as never,
      price: a.price,
    })),
    safetyChecks: checks.map((c) => ({
      phase: c.phase as SafetyPhase,
      completedAt: c.completedAt,
      items: checkItemsByCheck.get(c.id) ?? [],
    })),
    lineItems: items.map((li) => ({
      kind: li.kind as never,
      price: li.price,
      approvalId: li.approvalId,
    })),
    paymentState: job.paymentState as never,
    finalAmount: job.finalAmount,
    amountAdjustReason: job.amountAdjustReason,
    expectedTotal: job.expectedTotal,
    travelCharge: job.travelCharge,
    visitFee: job.visitFee,
    hasAfterPhoto: job.afterMediaId != null,
    afterPhotoSkipReason: job.afterPhotoSkipReason,
    hasActiveAppointment: appointments.some((a) => a.status === "ACTIVE"),
    retroactive: job.retroactive,
  };

  return { job, ctx };
}
