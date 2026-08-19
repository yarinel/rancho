import { describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@/db/test-helpers";
import { seed } from "@/db/seed";
import * as schema from "@/db/schema";
import { buildJobContext } from "./job-context";
import { canTransitionJob } from "@/domain/job-machine";
import { CHECK_TYPES, ILS, type JobStatus } from "@/domain/types";
import { eq } from "drizzle-orm";

/**
 * Integration: Scenario A (simple puncture) and Scenario C (additional work
 * with recorded approval) walked through DB truth + the state machine —
 * the same context builder and guards the server actions use.
 */

async function createBookedJob(d: TestDb) {
  await seed(d);
  const [tech] = await d.select().from(schema.technicians);
  const [hh] = await d.insert(schema.households).values({ label: "כהן" }).returning();
  const [cust] = await d
    .insert(schema.customers)
    .values({ householdId: hh.id, name: "יעל כהן", phone: "+972501234567" })
    .returning();
  const [bike] = await d
    .insert(schema.bicycles)
    .values({ householdId: hh.id, category: "kids", wheelSize: "w20", hasGears: false })
    .returning();
  const [loc] = await d
    .insert(schema.locations)
    .values({ householdId: hh.id, formattedAddress: "באר שבע" })
    .returning();
  const [job] = await d
    .insert(schema.serviceJobs)
    .values({
      publicToken: "job-test-token-1",
      householdId: hh.id,
      customerId: cust.id,
      bicycleId: bike.id,
      locationId: loc.id,
      technicianId: tech.id,
      status: "SCHEDULED",
      reportedSymptoms: "puncture",
      expectedTotal: ILS(80),
      travelCharge: 0,
    })
    .returning();
  await d.insert(schema.appointments).values({
    jobId: job.id,
    technicianId: tech.id,
    windowStart: new Date("2026-09-01T14:00:00Z"),
    windowEnd: new Date("2026-09-01T14:30:00Z"),
    blockStart: new Date("2026-09-01T14:00:00Z"),
    blockEnd: new Date("2026-09-01T14:40:00Z"),
    plannedStart: new Date("2026-09-01T14:00:00Z"),
  });
  return { job, bike, cust };
}

async function transition(
  d: TestDb,
  jobId: string,
  to: JobStatus,
  extra: Parameters<typeof canTransitionJob>[0] extends infer T
    ? Partial<Pick<Extract<T, object>, never>> & {
        unresolvedReason?: never;
        cancelReason?: never;
      }
    : never = {},
) {
  const snapshot = (await buildJobContext(d, jobId))!;
  const res = canTransitionJob({
    from: snapshot.job.status as JobStatus,
    to,
    actor: "staff",
    ctx: snapshot.ctx,
    ...extra,
  });
  if (res.ok) {
    await d
      .update(schema.serviceJobs)
      .set({ status: to })
      .where(eq(schema.serviceJobs.id, jobId));
  }
  return res;
}

async function recordFullCheck(
  d: TestDb,
  jobId: string,
  phase: "INSPECTION" | "FINAL",
  gears: "OK" | "NOT_APPLICABLE" = "NOT_APPLICABLE",
) {
  const [check] = await d
    .insert(schema.safetyChecks)
    .values({ jobId, phase, completedAt: new Date() })
    .returning();
  await d.insert(schema.safetyCheckItems).values(
    CHECK_TYPES.map((t) => ({
      safetyCheckId: check.id,
      checkType: t,
      result: t === "GEARS" ? gears : "OK",
    })),
  );
}

describe("job lifecycle (integration)", () => {
  it("Scenario A: puncture visit start→finish with safety guards enforced", async () => {
    const d = await createTestDb();
    const { job } = await createBookedJob(d);

    expect((await transition(d, job.id, "EN_ROUTE")).ok).toBe(true);
    expect((await transition(d, job.id, "ARRIVED")).ok).toBe(true);
    expect((await transition(d, job.id, "INSPECTION")).ok).toBe(true);

    // cannot start work before the 5-point inspection check
    expect((await transition(d, job.id, "IN_SERVICE")).ok).toBe(false);
    await recordFullCheck(d, job.id, "INSPECTION"); // gearless bike → GEARS N/A legal
    expect((await transition(d, job.id, "IN_SERVICE")).ok).toBe(true);

    // actual work performed
    await d.insert(schema.jobLineItems).values({
      jobId: job.id,
      label: "החלפת פנימית רגילה",
      kind: "ACTUAL",
      price: ILS(80),
    });

    expect((await transition(d, job.id, "FINAL_SAFETY_CHECK")).ok).toBe(true);
    // cannot reach payment before the FINAL check
    expect((await transition(d, job.id, "PAYMENT_PENDING")).ok).toBe(false);
    await recordFullCheck(d, job.id, "FINAL");
    expect((await transition(d, job.id, "PAYMENT_PENDING")).ok).toBe(true);

    // completion requires recorded payment + after photo (or skip reason)
    expect((await transition(d, job.id, "COMPLETED")).ok).toBe(false);
    await d
      .update(schema.serviceJobs)
      .set({
        paymentState: "PAID_BIT",
        finalAmount: ILS(80),
        afterPhotoSkipReason: null,
      })
      .where(eq(schema.serviceJobs.id, job.id));
    expect((await transition(d, job.id, "COMPLETED")).ok).toBe(false); // still no photo
    await d
      .update(schema.serviceJobs)
      .set({ afterPhotoSkipReason: "מצלמה נרטבה" })
      .where(eq(schema.serviceJobs.id, job.id));
    expect((await transition(d, job.id, "COMPLETED")).ok).toBe(true);
  });

  it("Scenario C: additional work blocked until an APPROVED record exists; overcharge rejected", async () => {
    const d = await createTestDb();
    const { job, bike } = await createBookedJob(d);
    for (const to of ["EN_ROUTE", "ARRIVED", "INSPECTION"] as const) {
      await transition(d, job.id, to);
    }
    await recordFullCheck(d, job.id, "INSPECTION");

    // finding with a proposal
    const [finding] = await d
      .insert(schema.findings)
      .values({
        jobId: job.id,
        bicycleId: bike.id,
        titleHe: "כבל בלם שחוק",
        severity: "ATTENTION_RECOMMENDED",
        proposedWorkHe: "החלפת כבל מעצור",
        proposedPrice: ILS(80),
      })
      .returning();

    // undecided proposal blocks work
    expect((await transition(d, job.id, "IN_SERVICE")).ok).toBe(false);

    // customer approves — immutable record
    const [tech] = await d.select().from(schema.technicians);
    const [approval] = await d
      .insert(schema.approvalRecords)
      .values({
        jobId: job.id,
        findingId: finding.id,
        proposedWorkHe: "החלפת כבל מעצור",
        price: ILS(80),
        decision: "APPROVED",
        channel: "IN_PERSON",
        approverName: "יעל",
        technicianId: tech.id,
        decidedAt: new Date(),
      })
      .returning();
    await d
      .update(schema.findings)
      .set({ resolution: "REPAIRED", resolvedInJob: true })
      .where(eq(schema.findings.id, finding.id));

    expect((await transition(d, job.id, "IN_SERVICE")).ok).toBe(true);
    await d.insert(schema.jobLineItems).values([
      { jobId: job.id, label: "החלפת פנימית", kind: "ACTUAL", price: ILS(80) },
      { jobId: job.id, label: "החלפת כבל מעצור", kind: "ACTUAL", price: ILS(80), approvalId: approval.id },
    ]);
    await transition(d, job.id, "FINAL_SAFETY_CHECK");
    await recordFullCheck(d, job.id, "FINAL");
    await transition(d, job.id, "PAYMENT_PENDING");

    // 80 booked + 80 approved = 160 ceiling; 200 must be rejected
    await d
      .update(schema.serviceJobs)
      .set({ paymentState: "PAID_CASH", finalAmount: ILS(200), afterPhotoSkipReason: "x" })
      .where(eq(schema.serviceJobs.id, job.id));
    expect((await transition(d, job.id, "COMPLETED")).ok).toBe(false);

    await d
      .update(schema.serviceJobs)
      .set({ finalAmount: ILS(160) })
      .where(eq(schema.serviceJobs.id, job.id));
    expect((await transition(d, job.id, "COMPLETED")).ok).toBe(true);
  });

  it("visit-fee ending: all proposals declined → PAYMENT_PENDING legal only with inspection check", async () => {
    const d = await createTestDb();
    const { job, bike } = await createBookedJob(d);
    for (const to of ["EN_ROUTE", "ARRIVED", "INSPECTION"] as const) {
      await transition(d, job.id, to);
    }
    const [tech] = await d.select().from(schema.technicians);
    const [finding] = await d
      .insert(schema.findings)
      .values({
        jobId: job.id,
        bicycleId: bike.id,
        titleHe: "פנימית קרועה",
        severity: "ATTENTION_RECOMMENDED",
        proposedWorkHe: "החלפת פנימית",
        proposedPrice: ILS(80),
      })
      .returning();
    await d.insert(schema.approvalRecords).values({
      jobId: job.id,
      findingId: finding.id,
      proposedWorkHe: "החלפת פנימית",
      price: ILS(80),
      decision: "DECLINED",
      channel: "IN_PERSON",
      approverName: "יעל",
      technicianId: tech.id,
      decidedAt: new Date(),
    });
    await d
      .update(schema.findings)
      .set({ resolution: "DECLINED" })
      .where(eq(schema.findings.id, finding.id));

    // safety check still mandatory — even on a no-work visit
    expect((await transition(d, job.id, "PAYMENT_PENDING")).ok).toBe(false);
    await recordFullCheck(d, job.id, "INSPECTION");
    const res = await transition(d, job.id, "PAYMENT_PENDING");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.effects).toContainEqual({ type: "APPLY_VISIT_FEE_ONLY" });
    }
  });
});
