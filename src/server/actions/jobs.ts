"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import * as schema from "@/db/schema";
import { requireStaff } from "@/server/auth";
import { buildJobContext } from "@/server/job-context";
import {
  canTransitionJob,
  isVisitFeePath,
  validateFinalAmount,
  approvedTotal,
} from "@/domain/job-machine";
import {
  CHECK_TYPES,
  type CancelReason,
  type JobStatus,
  type UnresolvedReason,
  ILS,
} from "@/domain/types";
import { logAudit, logEvent } from "@/server/log";

type ActionResult = { ok: boolean; error?: string };

const STATUS_TIMESTAMP: Partial<Record<JobStatus, "enRouteAt" | "arrivedAt" | "workStartedAt" | "completedAt">> = {
  EN_ROUTE: "enRouteAt",
  ARRIVED: "arrivedAt",
  IN_SERVICE: "workStartedAt",
  COMPLETED: "completedAt",
};

/** Central status transition — every guard runs here; UI never sets status. */
export async function transitionJobAction(
  jobId: string,
  to: JobStatus,
  extra: {
    unresolvedReason?: UnresolvedReason;
    cancelReason?: CancelReason;
  } = {},
): Promise<ActionResult> {
  const staff = await requireStaff();
  const d = await db();
  const snapshot = await buildJobContext(d, jobId);
  if (!snapshot) return { ok: false, error: "עבודה לא נמצאה" };
  const { job, ctx } = snapshot;

  const res = canTransitionJob({
    from: job.status as JobStatus,
    to,
    actor: "staff",
    ctx,
    unresolvedReason: extra.unresolvedReason,
    cancelReason: extra.cancelReason,
  });
  if (!res.ok) return { ok: false, error: res.error };

  const patch: Partial<typeof schema.serviceJobs.$inferInsert> = {
    status: to,
    updatedAt: new Date(),
  };
  const tsField = STATUS_TIMESTAMP[to];
  if (tsField && !job[tsField]) patch[tsField] = new Date();
  if (extra.unresolvedReason) patch.unresolvedReason = extra.unresolvedReason;
  if (extra.cancelReason) patch.cancelReason = extra.cancelReason;

  for (const effect of res.effects) {
    if (effect.type === "SET_FOLLOW_UP_REQUIRED") patch.followUpRequired = true;
    if (effect.type === "APPLY_VISIT_FEE_ONLY") {
      // the visit ends commercially as diagnosis-only (decision D4)
      patch.expectedTotal = 0;
      patch.expectedTotalHigh = null;
    }
  }

  // completion closes the loop for the north-star metric
  if (to === "COMPLETED" && job.firstVisitResolved == null) {
    const declinedAll = ctx.findings.some((f) => f.resolution === "DECLINED");
    patch.firstVisitResolved = !ctx.findings.some(
      (f) => f.resolution === "DECLINED" || f.resolution === "DEFERRED",
    );
    if (declinedAll) patch.resolutionExclusion = "CUSTOMER_DECLINED";
  }

  // atomic: conditional status write (loses the race cleanly) + effects together
  const releasesAppointment = res.effects.some(
    (e) => e.type === "RELEASE_APPOINTMENT",
  );
  const won = await d.transaction(async (tx) => {
    const updated = await tx
      .update(schema.serviceJobs)
      .set(patch)
      .where(
        and(
          eq(schema.serviceJobs.id, jobId),
          eq(schema.serviceJobs.status, job.status),
        ),
      )
      .returning();
    if (updated.length === 0) return false; // concurrent transition won
    if (releasesAppointment) {
      await tx
        .update(schema.appointments)
        .set({ status: "CANCELLED" })
        .where(
          and(
            eq(schema.appointments.jobId, jobId),
            eq(schema.appointments.status, "ACTIVE"),
          ),
        );
    }
    return true;
  });
  if (!won) {
    return { ok: false, error: "העבודה כבר עודכנה במקביל — רעננו ונסו שוב" };
  }
  await logEvent(d, "service_job", jobId, `status:${to}`, `staff:${staff.id}`, extra);
  revalidatePath(`/pro/jobs/${jobId}`);
  revalidatePath("/pro");
  return { ok: true };
}

/** Departure tap — learning data for travel calibration. */
export async function leftSiteAction(jobId: string): Promise<ActionResult> {
  const staff = await requireStaff();
  const d = await db();
  await d
    .update(schema.serviceJobs)
    .set({ leftSiteAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.serviceJobs.id, jobId));
  await logEvent(d, "service_job", jobId, "left_site", `staff:${staff.id}`);
  revalidatePath(`/pro/jobs/${jobId}`);
  return { ok: true };
}

const openingSchema = z.object({
  initialRideDone: z.boolean().nullable(),
  cleaned: z.boolean().nullable(),
});

export async function saveOpeningAction(
  jobId: string,
  input: z.infer<typeof openingSchema>,
): Promise<ActionResult> {
  await requireStaff();
  const parsed = openingSchema.parse(input);
  const d = await db();
  await d
    .update(schema.serviceJobs)
    .set({
      initialRideDone: parsed.initialRideDone,
      cleaned: parsed.cleaned,
      updatedAt: new Date(),
    })
    .where(eq(schema.serviceJobs.id, jobId));
  revalidatePath(`/pro/jobs/${jobId}`);
  return { ok: true };
}

const checkSchema = z.object({
  phase: z.enum(["INSPECTION", "FINAL"]),
  items: z.array(
    z.object({
      checkType: z.enum(CHECK_TYPES),
      result: z.enum(["OK", "ATTENTION_RECOMMENDED", "UNSAFE", "NOT_APPLICABLE"]),
      note: z.string().max(300).optional(),
    }),
  ),
});

/**
 * Record a safety check phase. UNSAFE results auto-create findings; a GEARS
 * N/A tap writes has_gears=false back to the bicycle (technician truth).
 */
export async function saveSafetyCheckAction(
  jobId: string,
  input: z.infer<typeof checkSchema>,
): Promise<ActionResult> {
  const staff = await requireStaff();
  const parsed = checkSchema.parse(input);
  const d = await db();
  const snapshot = await buildJobContext(d, jobId);
  if (!snapshot) return { ok: false, error: "עבודה לא נמצאה" };
  const { job } = snapshot;

  const existing = await d
    .select()
    .from(schema.safetyChecks)
    .where(
      and(
        eq(schema.safetyChecks.jobId, jobId),
        eq(schema.safetyChecks.phase, parsed.phase),
      ),
    );
  let checkId: string;
  if (existing.length > 0) {
    checkId = existing[0].id;
    await d
      .delete(schema.safetyCheckItems)
      .where(eq(schema.safetyCheckItems.safetyCheckId, checkId));
  } else {
    const [row] = await d
      .insert(schema.safetyChecks)
      .values({ jobId, phase: parsed.phase })
      .returning();
    checkId = row.id;
  }

  await d.insert(schema.safetyCheckItems).values(
    parsed.items.map((i) => ({
      safetyCheckId: checkId,
      checkType: i.checkType,
      result: i.result,
      note: i.note,
    })),
  );
  await d
    .update(schema.safetyChecks)
    .set({ completedAt: new Date() })
    .where(eq(schema.safetyChecks.id, checkId));

  const gearsNA = parsed.items.find(
    (i) => i.checkType === "GEARS" && i.result === "NOT_APPLICABLE",
  );
  if (gearsNA) {
    await d
      .update(schema.bicycles)
      .set({ hasGears: false })
      .where(eq(schema.bicycles.id, job.bicycleId));
  }

  // auto-create findings for UNSAFE items not yet represented
  const CHECK_LABELS: Record<string, string> = {
    CRANK: "קראנק",
    STEM_HANDLEBAR: "סטם וכידון",
    WHEELS_AXLES: "גלגלים וצירים",
    BRAKES: "בלמים",
    GEARS: "הילוכים",
  };
  const existingFindings = await d
    .select()
    .from(schema.findings)
    .where(eq(schema.findings.jobId, jobId));
  for (const item of parsed.items) {
    if (item.result !== "UNSAFE") continue;
    const title = `לא בטוח לרכיבה: ${CHECK_LABELS[item.checkType]}`;
    if (!existingFindings.some((f) => f.titleHe === title)) {
      await d.insert(schema.findings).values({
        jobId,
        bicycleId: job.bicycleId,
        titleHe: title,
        explanationHe: item.note ?? null,
        severity: "UNSAFE",
      });
    }
  }

  await logEvent(d, "service_job", jobId, `safety_check:${parsed.phase}`, `staff:${staff.id}`, {
    items: parsed.items,
  });
  revalidatePath(`/pro/jobs/${jobId}`);
  return { ok: true };
}

const findingSchema = z.object({
  titleHe: z.string().min(2).max(120),
  explanationHe: z.string().max(500).optional(),
  severity: z.enum(["INFO", "ATTENTION_RECOMMENDED", "UNSAFE"]),
  proposedWorkHe: z.string().max(200).optional(),
  proposedPriceShekels: z.coerce.number().min(0).max(5000).optional(),
});

export async function addFindingAction(
  jobId: string,
  input: z.infer<typeof findingSchema>,
): Promise<ActionResult> {
  const staff = await requireStaff();
  const parsed = findingSchema.parse(input);
  const d = await db();
  const snapshot = await buildJobContext(d, jobId);
  if (!snapshot) return { ok: false, error: "עבודה לא נמצאה" };
  await d.insert(schema.findings).values({
    jobId,
    bicycleId: snapshot.job.bicycleId,
    titleHe: parsed.titleHe,
    explanationHe: parsed.explanationHe,
    severity: parsed.severity,
    proposedWorkHe: parsed.proposedWorkHe,
    proposedPrice:
      parsed.proposedPriceShekels != null ? ILS(parsed.proposedPriceShekels) : null,
  });
  await logEvent(d, "service_job", jobId, "finding:added", `staff:${staff.id}`, parsed);
  revalidatePath(`/pro/jobs/${jobId}`);
  return { ok: true };
}

const approvalRequestSchema = z.object({
  findingId: z.string().uuid(),
  proposedWorkHe: z.string().min(2).max(200),
  explanationHe: z.string().max(500).optional(),
  priceShekels: z.coerce.number().min(0).max(5000),
  channel: z.enum(["IN_PERSON", "LINK"]),
  // IN_PERSON: the parent taps approve on the technician's phone right now
  inPersonDecision: z.enum(["APPROVED", "DECLINED"]).optional(),
  approverName: z.string().max(80).optional(),
});

export async function requestApprovalAction(
  jobId: string,
  input: z.infer<typeof approvalRequestSchema>,
): Promise<ActionResult> {
  const staff = await requireStaff();
  const parsed = approvalRequestSchema.parse(input);
  if (parsed.channel === "IN_PERSON") {
    if (!parsed.inPersonDecision || !parsed.approverName?.trim()) {
      return { ok: false, error: "אישור פנים-אל-פנים דורש החלטה ושם מאשר" };
    }
  }
  const d = await db();
  const snapshot = await buildJobContext(d, jobId);
  if (!snapshot) return { ok: false, error: "עבודה לא נמצאה" };
  if (!snapshot.job.technicianId) return { ok: false, error: "חסר טכנאי" };

  const decided = parsed.channel === "IN_PERSON";
  await d.insert(schema.approvalRecords).values({
    jobId,
    findingId: parsed.findingId,
    proposedWorkHe: parsed.proposedWorkHe,
    explanationHe: parsed.explanationHe,
    price: ILS(parsed.priceShekels),
    decision: decided ? parsed.inPersonDecision! : "PENDING",
    channel: parsed.channel,
    approverName: decided ? parsed.approverName!.trim() : null,
    technicianId: snapshot.job.technicianId,
    decidedAt: decided ? new Date() : null,
  });

  await d
    .update(schema.findings)
    .set({
      proposedWorkHe: parsed.proposedWorkHe,
      proposedPrice: ILS(parsed.priceShekels),
      resolution:
        decided && parsed.inPersonDecision === "DECLINED" ? "DECLINED" : "OPEN",
    })
    .where(eq(schema.findings.id, parsed.findingId));

  await logEvent(
    d,
    "service_job",
    jobId,
    decided ? `approval:${parsed.inPersonDecision}` : "approval:requested",
    `staff:${staff.id}`,
    { findingId: parsed.findingId, price: ILS(parsed.priceShekels), channel: parsed.channel },
  );
  revalidatePath(`/pro/jobs/${jobId}`);
  return { ok: true };
}

const findingResolutionSchema = z.object({
  findingId: z.string().uuid(),
  resolution: z.enum(["REPAIRED", "DEFERRED", "REFUSED_UNSAFE_PART", "ACKNOWLEDGED_UNREPAIRED"]),
});

export async function resolveFindingAction(
  jobId: string,
  input: z.infer<typeof findingResolutionSchema>,
): Promise<ActionResult> {
  const staff = await requireStaff();
  const parsed = findingResolutionSchema.parse(input);
  const d = await db();
  await d
    .update(schema.findings)
    .set({
      resolution: parsed.resolution,
      resolvedInJob: parsed.resolution === "REPAIRED",
    })
    .where(and(eq(schema.findings.id, parsed.findingId), eq(schema.findings.jobId, jobId)));
  await logEvent(d, "service_job", jobId, `finding:${parsed.resolution}`, `staff:${staff.id}`, {
    findingId: parsed.findingId,
  });
  revalidatePath(`/pro/jobs/${jobId}`);
  return { ok: true };
}

const actualItemSchema = z.object({
  label: z.string().min(1).max(120),
  priceShekels: z.coerce.number().min(0).max(5000),
  approvalId: z.string().uuid().nullable(),
  partSource: z.enum(["RANCHO", "CUSTOMER"]).default("RANCHO"),
  partsUsed: z.array(z.string().max(60)).default([]),
});

/**
 * Replace the ACTUAL work list. Items beyond the booked work must reference an
 * APPROVED record — enforced here AND in the machine guard (defense in depth).
 */
export async function setActualItemsAction(
  jobId: string,
  items: z.infer<typeof actualItemSchema>[],
): Promise<ActionResult> {
  const staff = await requireStaff();
  const parsed = z.array(actualItemSchema).parse(items);
  const d = await db();
  const snapshot = await buildJobContext(d, jobId);
  if (!snapshot) return { ok: false, error: "עבודה לא נמצאה" };

  const approvedIds = new Set(
    snapshot.ctx.approvals.filter((a) => a.decision === "APPROVED").map((a) => a.id),
  );
  // booked work = labels the customer saw at booking (EXPECTED lines);
  // anything else must carry an APPROVED record — no unapproved substitutions
  const expected = await d
    .select()
    .from(schema.jobLineItems)
    .where(
      and(eq(schema.jobLineItems.jobId, jobId), eq(schema.jobLineItems.kind, "EXPECTED")),
    );
  const bookedLabels = new Set(expected.map((li) => li.label));
  for (const item of parsed) {
    if (item.approvalId && !approvedIds.has(item.approvalId)) {
      return { ok: false, error: `"${item.label}" מפנה לאישור שלא אושר` };
    }
    if (!item.approvalId && !bookedLabels.has(item.label)) {
      return {
        ok: false,
        error: `"${item.label}" אינו חלק מהעבודה שסוכמה — נדרש אישור לקוח (הוסיפו ממצא)`,
      };
    }
  }

  await d
    .delete(schema.jobLineItems)
    .where(and(eq(schema.jobLineItems.jobId, jobId), eq(schema.jobLineItems.kind, "ACTUAL")));
  if (parsed.length > 0) {
    await d.insert(schema.jobLineItems).values(
      parsed.map((i) => ({
        jobId,
        label: i.label,
        kind: "ACTUAL" as const,
        price: ILS(i.priceShekels),
        approvalId: i.approvalId,
        partSource: i.partSource,
        partsUsed: i.partsUsed,
      })),
    );
  }
  await logAudit(d, staff.id, "job.actual_items", "service_job", jobId, { items: parsed });
  revalidatePath(`/pro/jobs/${jobId}`);
  return { ok: true };
}

const paymentSchema = z.object({
  method: z.enum(["PAID_CASH", "PAID_BIT", "PAID_TRANSFER", "PAID_EXTERNAL", "WAIVED"]),
  amountShekels: z.coerce.number().min(0).max(10000),
  adjustReason: z.string().max(200).optional(),
});

/**
 * Record payment. The amount guard (non-negotiable 6) rejects anything above
 * the approved total; downward adjustments demand a recorded reason.
 */
export async function recordPaymentAction(
  jobId: string,
  input: z.infer<typeof paymentSchema>,
): Promise<ActionResult> {
  const staff = await requireStaff();
  const parsed = paymentSchema.parse(input);
  const d = await db();
  const snapshot = await buildJobContext(d, jobId);
  if (!snapshot) return { ok: false, error: "עבודה לא נמצאה" };
  const { job, ctx } = snapshot;
  // payment is recorded exactly once, at the payment stage — closed jobs are immutable
  if (job.status !== "PAYMENT_PENDING") {
    return { ok: false, error: "תשלום נרשם רק בשלב התשלום" };
  }

  const amount = ILS(parsed.amountShekels);
  const visitFeeOnly = isVisitFeePath(ctx); // single source of truth (domain)

  const check = validateFinalAmount(
    { ...ctx, amountAdjustReason: parsed.adjustReason ?? null },
    amount,
    { visitFeeOnly },
  );
  if (!check.ok && parsed.method !== "WAIVED") {
    return { ok: false, error: check.error };
  }

  await d
    .update(schema.serviceJobs)
    .set({
      paymentState: parsed.method,
      // WAIVED stores null — the COMPLETED guard's waiver carve-out keys on it
      finalAmount: parsed.method === "WAIVED" ? null : amount,
      amountAdjustReason: parsed.adjustReason ?? null,
      paymentRecordedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.serviceJobs.id, jobId));
  await logEvent(d, "service_job", jobId, "payment:recorded", `staff:${staff.id}`, {
    method: parsed.method,
    amount,
    approvedTotal: approvedTotal(ctx),
  });
  revalidatePath(`/pro/jobs/${jobId}`);
  return { ok: true };
}

const completionSchema = z.object({
  summaryHe: z.string().max(1000).optional(),
  maintenanceTipHe: z.string().max(300).optional(),
  afterPhotoSkipReason: z.string().max(200).optional(),
});

export async function saveCompletionDetailsAction(
  jobId: string,
  input: z.infer<typeof completionSchema>,
): Promise<ActionResult> {
  await requireStaff();
  const parsed = completionSchema.parse(input);
  const d = await db();
  // partial update — only fields actually provided (never clobber the rest)
  const patch: Partial<typeof schema.serviceJobs.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (parsed.summaryHe !== undefined) patch.summaryHe = parsed.summaryHe;
  if (parsed.maintenanceTipHe !== undefined)
    patch.maintenanceTipHe = parsed.maintenanceTipHe;
  if (parsed.afterPhotoSkipReason !== undefined)
    patch.afterPhotoSkipReason = parsed.afterPhotoSkipReason || null;
  await d
    .update(schema.serviceJobs)
    .set(patch)
    .where(eq(schema.serviceJobs.id, jobId));
  revalidatePath(`/pro/jobs/${jobId}`);
  return { ok: true };
}

/** Attach an uploaded media row to a job as before/after/finding photo. */
export async function attachJobMediaAction(
  jobId: string,
  mediaId: string,
  kind: "BEFORE" | "AFTER" | "FINDING",
): Promise<ActionResult> {
  await requireStaff();
  const d = await db();
  await d
    .update(schema.media)
    .set({ jobId, kind })
    .where(eq(schema.media.id, mediaId));
  if (kind === "BEFORE") {
    await d
      .update(schema.serviceJobs)
      .set({ beforeMediaId: mediaId, updatedAt: new Date() })
      .where(eq(schema.serviceJobs.id, jobId));
  }
  if (kind === "AFTER") {
    await d
      .update(schema.serviceJobs)
      .set({ afterMediaId: mediaId, updatedAt: new Date() })
      .where(eq(schema.serviceJobs.id, jobId));
  }
  revalidatePath(`/pro/jobs/${jobId}`);
  return { ok: true };
}

const settleSchema = z.object({
  approvalId: z.string().uuid(),
  decision: z.enum(["APPROVED", "DECLINED"]),
  approverName: z.string().min(2).max(80),
});

/**
 * Operator records a customer's VERBAL decision on a pending LINK approval
 * (e.g. the parent answered by phone instead of tapping the link). Same
 * immutability: only PENDING records can be settled, exactly once.
 */
export async function settleApprovalAction(
  jobId: string,
  input: z.infer<typeof settleSchema>,
): Promise<ActionResult> {
  const staff = await requireStaff();
  const parsed = settleSchema.parse(input);
  const d = await db();
  const updated = await d
    .update(schema.approvalRecords)
    .set({
      decision: parsed.decision,
      approverName: parsed.approverName.trim(),
      channel: "IN_PERSON",
      decidedAt: new Date(),
    })
    .where(
      and(
        eq(schema.approvalRecords.id, parsed.approvalId),
        eq(schema.approvalRecords.jobId, jobId),
        eq(schema.approvalRecords.decision, "PENDING"),
      ),
    )
    .returning();
  if (updated.length === 0) {
    return { ok: false, error: "האישור כבר הוכרע — אי אפשר לשנות" };
  }
  if (updated[0].findingId && parsed.decision === "DECLINED") {
    await d
      .update(schema.findings)
      .set({ resolution: "DECLINED" })
      .where(eq(schema.findings.id, updated[0].findingId));
  }
  await logEvent(d, "service_job", jobId, `approval:${parsed.decision}`, `staff:${staff.id}`, {
    approvalId: parsed.approvalId,
    verbal: true,
  });
  revalidatePath(`/pro/jobs/${jobId}`);
  return { ok: true };
}
