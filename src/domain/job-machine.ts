import type {
  Agorot,
  ApprovalDecision,
  CancelReason,
  CheckResult,
  CheckType,
  FindingResolution,
  FindingSeverity,
  JobStatus,
  PaymentState,
  SafetyPhase,
  UnresolvedReason,
} from "./types";
import { CHECK_TYPES } from "./types";

/**
 * Service Job state machine (docs/STATE_MACHINES.md).
 * Pure: guards receive a JobContext snapshot; callers persist and log events.
 *
 * Non-negotiables encoded here:
 *  - every visit records the 5-point safety check (INSPECTION phase) before
 *    work starts, and the FINAL phase before payment;
 *  - GEARS is the only check that may be NOT_APPLICABLE, and only when the
 *    bicycle has no gears;
 *  - the customer approves additional work BEFORE it happens, and the final
 *    charge can never exceed the approved total (upward edits blocked);
 *  - the decline-after-diagnosis visit (visit fee only) is a first-class path.
 */

export interface CtxFinding {
  id: string;
  severity: FindingSeverity;
  resolution: FindingResolution;
  proposedPrice: Agorot | null;
  hasProposal: boolean; // proposed work was offered to the customer
}

export interface CtxApproval {
  id: string;
  findingId: string | null;
  decision: ApprovalDecision;
  price: Agorot;
}

export interface CtxSafetyCheck {
  phase: SafetyPhase;
  completedAt: Date | null;
  items: { checkType: CheckType; result: CheckResult }[];
}

export interface CtxLineItem {
  kind: "EXPECTED" | "ACTUAL";
  price: Agorot | null;
  approvalId: string | null;
}

export interface JobContext {
  bikeHasGears: boolean | null; // null = unknown
  findings: CtxFinding[];
  approvals: CtxApproval[];
  safetyChecks: CtxSafetyCheck[];
  lineItems: CtxLineItem[];
  paymentState: PaymentState;
  finalAmount: Agorot | null;
  amountAdjustReason: string | null;
  expectedTotal: Agorot | null; // agreed at booking (base work)
  travelCharge: Agorot;
  visitFee: Agorot;
  hasAfterPhoto: boolean;
  afterPhotoSkipReason: string | null;
  hasActiveAppointment: boolean;
  retroactive: boolean;
}

export interface JobTransitionInput {
  from: JobStatus;
  to: JobStatus;
  actor: "staff" | "customer" | "system";
  ctx: JobContext;
  unresolvedReason?: UnresolvedReason;
  cancelReason?: CancelReason;
}

export type JobTransitionResult =
  | { ok: true; effects: JobEffect[] }
  | { ok: false; error: string };

/** Side-effects the caller must apply atomically with the status change. */
export type JobEffect =
  | { type: "SET_FOLLOW_UP_REQUIRED" }
  | { type: "RELEASE_APPOINTMENT" }
  | { type: "APPLY_VISIT_FEE_ONLY" };

/* ------------------------------ guard helpers ------------------------------ */

function safetyCheck(ctx: JobContext, phase: SafetyPhase) {
  return ctx.safetyChecks.find((c) => c.phase === phase) ?? null;
}

/** All 5 items recorded; N/A legal only for GEARS on a gearless bike. */
export function safetyCheckComplete(
  ctx: JobContext,
  phase: SafetyPhase,
): { complete: boolean; error?: string } {
  const check = safetyCheck(ctx, phase);
  if (!check) return { complete: false, error: `בדיקת ${phase} לא נרשמה` };
  for (const type of CHECK_TYPES) {
    const item = check.items.find((i) => i.checkType === type);
    if (!item) {
      return { complete: false, error: `חסרה בדיקה: ${type}` };
    }
    if (item.result === "NOT_APPLICABLE") {
      if (type !== "GEARS") {
        return {
          complete: false,
          error: `NOT_APPLICABLE אינו חוקי עבור ${type}`,
        };
      }
      if (ctx.bikeHasGears !== false) {
        return {
          complete: false,
          error: "GEARS יכול להיות לא-רלוונטי רק לאופניים ללא הילוכים",
        };
      }
    }
  }
  return { complete: true };
}

/** Findings that still need a customer decision. */
function undecidedFindings(ctx: JobContext): CtxFinding[] {
  return ctx.findings.filter(
    (f) => f.hasProposal && f.resolution === "OPEN",
  );
}

/**
 * UNSAFE results must be repaired or explicitly customer-acknowledged —
 * DECLINED/DEFERRED are never sufficient for a safety-critical finding.
 * Considers both UNSAFE check items in the phase AND UNSAFE findings from any
 * source (manual findings included).
 */
function unsafeHandled(ctx: JobContext, phase: SafetyPhase) {
  const check = safetyCheck(ctx, phase);
  const unsafeItems = check?.items.filter((i) => i.result === "UNSAFE") ?? [];
  const unsafeFindings = ctx.findings.filter((f) => f.severity === "UNSAFE");
  if (unsafeItems.length === 0 && unsafeFindings.length === 0) {
    return { handled: true, followUp: false };
  }
  if (unsafeItems.length > 0 && unsafeFindings.length === 0) {
    return {
      handled: false,
      followUp: false,
      error: "ממצא UNSAFE חייב להירשם כ-Finding",
    };
  }
  const unresolved = unsafeFindings.filter(
    (f) =>
      f.resolution !== "REPAIRED" &&
      f.resolution !== "ACKNOWLEDGED_UNREPAIRED",
  );
  if (unresolved.length > 0) {
    return {
      handled: false,
      followUp: false,
      error: "ממצא בטיחות חמור חייב תיקון או אישור לקוח מתועד",
    };
  }
  const followUp = unsafeFindings.some(
    (f) => f.resolution === "ACKNOWLEDGED_UNREPAIRED",
  );
  return { handled: true, followUp };
}

/** Sum the customer approved: booked work + approved additions (+ travel). */
export function approvedTotal(ctx: JobContext): Agorot {
  const approvedAdditions = ctx.approvals
    .filter((a) => a.decision === "APPROVED")
    .reduce((sum, a) => sum + a.price, 0);
  return (ctx.expectedTotal ?? 0) + ctx.travelCharge + approvedAdditions;
}

/**
 * Payment amount guard (non-negotiable 6): upward edits beyond the approved
 * total are rejected; downward edits require a recorded reason.
 */
export function validateFinalAmount(
  ctx: JobContext,
  amount: Agorot,
  opts: { visitFeeOnly?: boolean } = {},
): { ok: true } | { ok: false; error: string } {
  const ceiling = opts.visitFeeOnly
    ? ctx.visitFee + ctx.travelCharge
    : approvedTotal(ctx);
  if (amount > ceiling) {
    return {
      ok: false,
      error: `הסכום ${amount / 100}₪ גבוה מהסך המאושר ${ceiling / 100}₪ — נדרש אישור לקוח`,
    };
  }
  if (amount < ceiling && !ctx.amountAdjustReason) {
    return { ok: false, error: "הפחתה מהסכום המאושר מחייבת סיבה מתועדת" };
  }
  return { ok: true };
}

/** Actual work items beyond booked work must reference an APPROVED record. */
function actualItemsApproved(ctx: JobContext): { ok: boolean; error?: string } {
  const approvedIds = new Set(
    ctx.approvals.filter((a) => a.decision === "APPROVED").map((a) => a.id),
  );
  const unapproved = ctx.lineItems.filter(
    (li) => li.kind === "ACTUAL" && li.approvalId && !approvedIds.has(li.approvalId),
  );
  if (unapproved.length > 0) {
    return { ok: false, error: "פריט עבודה מפנה לאישור שלא אושר" };
  }
  return { ok: true };
}

export const isVisitFeePath = (ctx: JobContext) =>
  ctx.findings.filter((f) => f.hasProposal).length > 0 &&
  ctx.findings
    .filter((f) => f.hasProposal)
    .every(
      (f) =>
        f.resolution === "DECLINED" ||
        f.resolution === "DEFERRED" ||
        f.resolution === "ACKNOWLEDGED_UNREPAIRED",
    ) &&
  ctx.lineItems.filter((li) => li.kind === "ACTUAL").length === 0;

/* ------------------------------- transitions ------------------------------- */

type Guard = (input: JobTransitionInput) =>
  | { ok: true; effects?: JobEffect[] }
  | { ok: false; error: string };

const TRANSITIONS: Record<string, { actors: string[]; guard?: Guard }> = {
  "DRAFT→SCHEDULED": {
    actors: ["staff", "customer", "system"],
    guard: ({ ctx }) =>
      ctx.hasActiveAppointment
        ? { ok: true }
        : { ok: false, error: "אין תור פעיל" },
  },
  "SCHEDULED→EN_ROUTE": { actors: ["staff"] },
  "EN_ROUTE→ARRIVED": { actors: ["staff"] },
  // retroactive/operator jobs may skip EN_ROUTE/ARRIVED with a recorded reason
  "SCHEDULED→ARRIVED": {
    actors: ["staff"],
    guard: ({ ctx }) =>
      ctx.retroactive
        ? { ok: true }
        : { ok: false, error: "דילוג על יציאה מותר רק בעבודה רטרואקטיבית" },
  },
  "ARRIVED→INSPECTION": { actors: ["staff"] },
  "INSPECTION→AWAITING_APPROVAL": {
    actors: ["staff"],
    guard: ({ ctx }) => {
      if (ctx.findings.filter((f) => f.hasProposal).length === 0) {
        return { ok: false, error: "אין ממצאים שממתינים להחלטת לקוח" };
      }
      return { ok: true };
    },
  },
  "IN_SERVICE→AWAITING_APPROVAL": {
    actors: ["staff"],
    guard: ({ ctx }) => {
      if (ctx.findings.filter((f) => f.hasProposal).length === 0) {
        return { ok: false, error: "אין ממצאים שממתינים להחלטת לקוח" };
      }
      return { ok: true };
    },
  },
  "INSPECTION→IN_SERVICE": {
    actors: ["staff"],
    guard: ({ ctx }) => {
      const s = safetyCheckComplete(ctx, "INSPECTION");
      if (!s.complete) return { ok: false, error: s.error! };
      const undecided = undecidedFindings(ctx);
      if (undecided.length > 0) {
        return { ok: false, error: "יש ממצאים שממתינים להחלטת לקוח" };
      }
      return { ok: true };
    },
  },
  "AWAITING_APPROVAL→IN_SERVICE": {
    actors: ["staff"],
    guard: ({ ctx }) => {
      const s = safetyCheckComplete(ctx, "INSPECTION");
      if (!s.complete) return { ok: false, error: s.error! };
      if (undecidedFindings(ctx).length > 0) {
        return { ok: false, error: "יש ממצאים שממתינים להחלטת לקוח" };
      }
      return { ok: true };
    },
  },
  // decline-after-diagnosis / visit-fee path — first-class
  "INSPECTION→PAYMENT_PENDING": {
    actors: ["staff"],
    guard: visitFeeGuard,
  },
  "AWAITING_APPROVAL→PAYMENT_PENDING": {
    actors: ["staff"],
    guard: visitFeeGuard,
  },
  "IN_SERVICE→FINAL_SAFETY_CHECK": {
    actors: ["staff"],
    guard: ({ ctx }) => {
      if (undecidedFindings(ctx).length > 0) {
        return { ok: false, error: "כל ממצא חייב החלטה לפני בדיקת סיום" };
      }
      const a = actualItemsApproved(ctx);
      if (!a.ok) return { ok: false, error: a.error! };
      return { ok: true };
    },
  },
  "FINAL_SAFETY_CHECK→PAYMENT_PENDING": {
    actors: ["staff"],
    guard: ({ ctx }) => {
      const s = safetyCheckComplete(ctx, "FINAL");
      if (!s.complete) return { ok: false, error: s.error! };
      const u = unsafeHandled(ctx, "FINAL");
      if (!u.handled) return { ok: false, error: u.error! };
      const effects: JobEffect[] = u.followUp
        ? [{ type: "SET_FOLLOW_UP_REQUIRED" }]
        : [];
      return { ok: true, effects };
    },
  },
  // rework: the final check surfaced a problem — go back and fix it
  "FINAL_SAFETY_CHECK→IN_SERVICE": { actors: ["staff"] },
  "PAYMENT_PENDING→COMPLETED": {
    actors: ["staff"],
    guard: ({ ctx }) => {
      if (ctx.paymentState === "PENDING") {
        return { ok: false, error: "יש לתעד תשלום (או ויתור) לפני סגירה" };
      }
      if (ctx.finalAmount == null && ctx.paymentState !== "WAIVED") {
        return { ok: false, error: "חסר סכום סופי" };
      }
      // WAIVED is an explicit goodwill decision — amount validation not applicable
      if (ctx.finalAmount != null && ctx.paymentState !== "WAIVED") {
        const v = validateFinalAmount(ctx, ctx.finalAmount, {
          visitFeeOnly: isVisitFeePath(ctx),
        });
        if (!v.ok) return v;
      }
      if (!ctx.hasAfterPhoto && !ctx.afterPhotoSkipReason) {
        return { ok: false, error: "חסרה תמונת אחרי (או סיבת דילוג)" };
      }
      return { ok: true };
    },
  },
  "SCHEDULED→CANCELLED": { actors: ["staff", "customer"], guard: cancelGuard },
  "DRAFT→CANCELLED": { actors: ["staff", "customer"], guard: cancelGuard },
  "EN_ROUTE→CANCELLED": { actors: ["staff"], guard: cancelGuard },
  "ARRIVED→UNRESOLVED": { actors: ["staff"], guard: unresolvedGuard },
  "INSPECTION→UNRESOLVED": { actors: ["staff"], guard: unresolvedGuard },
  "AWAITING_APPROVAL→UNRESOLVED": { actors: ["staff"], guard: unresolvedGuard },
  "IN_SERVICE→UNRESOLVED": { actors: ["staff"], guard: unresolvedGuard },
  "FINAL_SAFETY_CHECK→UNRESOLVED": { actors: ["staff"], guard: unresolvedGuard },
  "PAYMENT_PENDING→UNRESOLVED": { actors: ["staff"], guard: unresolvedGuard },
};

function visitFeeGuard(input: JobTransitionInput) {
  const { ctx } = input;
  const s = safetyCheckComplete(ctx, "INSPECTION");
  if (!s.complete) {
    return {
      ok: false as const,
      error: `גם בביקור ללא עבודה חובה בדיקת בטיחות: ${s.error}`,
    };
  }
  if (!isVisitFeePath(ctx)) {
    return {
      ok: false as const,
      error:
        "מסלול דמי-ביקור חוקי רק כשכל ההצעות נדחו/נדחו-להמשך ואין עבודה בפועל",
    };
  }
  // an UNSAFE finding cannot be quietly declined away: it must be repaired or
  // explicitly customer-acknowledged (recorded), and acknowledgment flags a
  // follow-up — same bar as the FINAL-check path (non-negotiable 4)
  const u = unsafeHandled(ctx, "INSPECTION");
  if (!u.handled) return { ok: false as const, error: u.error! };
  const effects: JobEffect[] = [{ type: "APPLY_VISIT_FEE_ONLY" }];
  if (u.followUp) effects.push({ type: "SET_FOLLOW_UP_REQUIRED" });
  return { ok: true as const, effects };
}

function cancelGuard(input: JobTransitionInput) {
  if (!input.cancelReason) {
    return { ok: false as const, error: "ביטול מחייב סיבה" };
  }
  return {
    ok: true as const,
    effects: [{ type: "RELEASE_APPOINTMENT" } as JobEffect],
  };
}

function unresolvedGuard(input: JobTransitionInput) {
  if (!input.unresolvedReason) {
    return { ok: false as const, error: "סיום חריג מחייב סיבה" };
  }
  return {
    ok: true as const,
    effects: [{ type: "RELEASE_APPOINTMENT" } as JobEffect],
  };
}

/* --------------------------------- API ------------------------------------- */

export function canTransitionJob(
  input: JobTransitionInput,
): JobTransitionResult {
  const key = `${input.from}→${input.to}`;
  const rule = TRANSITIONS[key];
  if (!rule) {
    return { ok: false, error: `illegal transition ${key}` };
  }
  if (!rule.actors.includes(input.actor)) {
    return { ok: false, error: `actor ${input.actor} may not perform ${key}` };
  }
  if (rule.guard) {
    const g = rule.guard(input);
    if (!g.ok) return { ok: false, error: g.error };
    return { ok: true, effects: g.effects ?? [] };
  }
  return { ok: true, effects: [] };
}

export const TERMINAL_JOB_STATUSES: JobStatus[] = [
  "COMPLETED",
  "CANCELLED",
  "UNRESOLVED",
];
