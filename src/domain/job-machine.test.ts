import { describe, expect, it } from "vitest";
import {
  canTransitionJob,
  safetyCheckComplete,
  validateFinalAmount,
  approvedTotal,
  type JobContext,
} from "./job-machine";
import { CHECK_TYPES, ILS, JOB_STATUSES, type JobStatus } from "./types";

/** Minimal healthy context factory; override per test. */
function ctx(overrides: Partial<JobContext> = {}): JobContext {
  return {
    bikeHasGears: true,
    findings: [],
    approvals: [],
    safetyChecks: [],
    lineItems: [],
    paymentState: "PENDING",
    finalAmount: null,
    amountAdjustReason: null,
    expectedTotal: ILS(80),
    travelCharge: 0,
    visitFee: ILS(60),
    hasAfterPhoto: false,
    afterPhotoSkipReason: null,
    hasActiveAppointment: true,
    retroactive: false,
    ...overrides,
  };
}

const fullCheck = (
  phase: "INSPECTION" | "FINAL",
  result: "OK" | "UNSAFE" = "OK",
  gears: "OK" | "NOT_APPLICABLE" = "OK",
) => ({
  phase,
  completedAt: new Date(),
  items: CHECK_TYPES.map((t) => ({
    checkType: t,
    result: t === "GEARS" ? gears : t === "BRAKES" ? result : ("OK" as const),
  })),
});

describe("job machine — transition table", () => {
  const LEGAL = new Set(
    [
      "DRAFT→SCHEDULED",
      "SCHEDULED→EN_ROUTE",
      "EN_ROUTE→ARRIVED",
      "SCHEDULED→ARRIVED",
      "ARRIVED→INSPECTION",
      "INSPECTION→AWAITING_APPROVAL",
      "IN_SERVICE→AWAITING_APPROVAL",
      "INSPECTION→IN_SERVICE",
      "AWAITING_APPROVAL→IN_SERVICE",
      "INSPECTION→PAYMENT_PENDING",
      "AWAITING_APPROVAL→PAYMENT_PENDING",
      "IN_SERVICE→FINAL_SAFETY_CHECK",
      "FINAL_SAFETY_CHECK→PAYMENT_PENDING",
      "FINAL_SAFETY_CHECK→IN_SERVICE",
      "PAYMENT_PENDING→COMPLETED",
      "DRAFT→CANCELLED",
      "SCHEDULED→CANCELLED",
      "EN_ROUTE→CANCELLED",
      "ARRIVED→UNRESOLVED",
      "INSPECTION→UNRESOLVED",
      "AWAITING_APPROVAL→UNRESOLVED",
      "IN_SERVICE→UNRESOLVED",
      "FINAL_SAFETY_CHECK→UNRESOLVED",
      "PAYMENT_PENDING→UNRESOLVED",
    ].map((s) => s),
  );

  it("rejects every pair outside the legal set outright", () => {
    for (const from of JOB_STATUSES) {
      for (const to of JOB_STATUSES) {
        if (from === to) continue;
        const key = `${from}→${to}`;
        if (LEGAL.has(key)) continue;
        const res = canTransitionJob({
          from: from as JobStatus,
          to: to as JobStatus,
          actor: "staff",
          ctx: ctx(),
          unresolvedReason: "OTHER",
          cancelReason: "OTHER",
        });
        expect(res.ok, key).toBe(false);
      }
    }
  });

  it("a job never jumps SCHEDULED → COMPLETED", () => {
    expect(
      canTransitionJob({
        from: "SCHEDULED",
        to: "COMPLETED",
        actor: "staff",
        ctx: ctx(),
      }).ok,
    ).toBe(false);
  });
});

describe("job machine — guards", () => {
  it("DRAFT→SCHEDULED requires an active appointment", () => {
    expect(
      canTransitionJob({
        from: "DRAFT",
        to: "SCHEDULED",
        actor: "system",
        ctx: ctx({ hasActiveAppointment: false }),
      }).ok,
    ).toBe(false);
  });

  it("skipping EN_ROUTE is allowed only for retroactive jobs", () => {
    expect(
      canTransitionJob({ from: "SCHEDULED", to: "ARRIVED", actor: "staff", ctx: ctx() })
        .ok,
    ).toBe(false);
    expect(
      canTransitionJob({
        from: "SCHEDULED",
        to: "ARRIVED",
        actor: "staff",
        ctx: ctx({ retroactive: true }),
      }).ok,
    ).toBe(true);
  });

  it("INSPECTION→IN_SERVICE requires the full 5-point inspection check", () => {
    expect(
      canTransitionJob({ from: "INSPECTION", to: "IN_SERVICE", actor: "staff", ctx: ctx() })
        .ok,
    ).toBe(false);

    const partial = fullCheck("INSPECTION");
    partial.items = partial.items.slice(0, 4); // drop GEARS
    expect(
      canTransitionJob({
        from: "INSPECTION",
        to: "IN_SERVICE",
        actor: "staff",
        ctx: ctx({ safetyChecks: [partial] }),
      }).ok,
    ).toBe(false);

    expect(
      canTransitionJob({
        from: "INSPECTION",
        to: "IN_SERVICE",
        actor: "staff",
        ctx: ctx({ safetyChecks: [fullCheck("INSPECTION")] }),
      }).ok,
    ).toBe(true);
  });

  it("GEARS may be NOT_APPLICABLE only when the bike has no gears", () => {
    const withNA = ctx({
      safetyChecks: [fullCheck("INSPECTION", "OK", "NOT_APPLICABLE")],
    });
    expect(safetyCheckComplete(withNA, "INSPECTION").complete).toBe(false);
    expect(
      safetyCheckComplete(
        { ...withNA, bikeHasGears: false },
        "INSPECTION",
      ).complete,
    ).toBe(true);
    // NOT_APPLICABLE on any other check is never legal
    const badNA = ctx({
      bikeHasGears: false,
      safetyChecks: [
        {
          phase: "INSPECTION",
          completedAt: new Date(),
          items: CHECK_TYPES.map((t) => ({
            checkType: t,
            result: t === "BRAKES" ? ("NOT_APPLICABLE" as const) : ("OK" as const),
          })),
        },
      ],
    });
    expect(safetyCheckComplete(badNA, "INSPECTION").complete).toBe(false);
  });

  it("undecided findings block IN_SERVICE and FINAL_SAFETY_CHECK", () => {
    const withOpen = ctx({
      safetyChecks: [fullCheck("INSPECTION")],
      findings: [
        {
          id: "f1",
          severity: "ATTENTION_RECOMMENDED",
          resolution: "OPEN",
          proposedPrice: ILS(80),
          hasProposal: true,
        },
      ],
    });
    expect(
      canTransitionJob({
        from: "AWAITING_APPROVAL",
        to: "IN_SERVICE",
        actor: "staff",
        ctx: withOpen,
      }).ok,
    ).toBe(false);
    expect(
      canTransitionJob({
        from: "IN_SERVICE",
        to: "FINAL_SAFETY_CHECK",
        actor: "staff",
        ctx: withOpen,
      }).ok,
    ).toBe(false);
  });

  it("visit-fee path: all proposals declined, inspection check done, no actual work", () => {
    const declinedAll = ctx({
      safetyChecks: [fullCheck("INSPECTION")],
      findings: [
        {
          id: "f1",
          severity: "ATTENTION_RECOMMENDED",
          resolution: "DECLINED",
          proposedPrice: ILS(80),
          hasProposal: true,
        },
      ],
    });
    const res = canTransitionJob({
      from: "AWAITING_APPROVAL",
      to: "PAYMENT_PENDING",
      actor: "staff",
      ctx: declinedAll,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.effects).toContainEqual({ type: "APPLY_VISIT_FEE_ONLY" });
    }

    // without the inspection check it is blocked — safety on EVERY visit
    const noCheck = { ...declinedAll, safetyChecks: [] };
    expect(
      canTransitionJob({
        from: "AWAITING_APPROVAL",
        to: "PAYMENT_PENDING",
        actor: "staff",
        ctx: noCheck,
      }).ok,
    ).toBe(false);

    // an UNSAFE finding can never be quietly declined away on the visit-fee
    // path — it must be repaired or explicitly customer-acknowledged
    const unsafeDeclined = {
      ...declinedAll,
      findings: [
        {
          id: "f-unsafe",
          severity: "UNSAFE" as const,
          resolution: "DECLINED" as const,
          proposedPrice: ILS(80),
          hasProposal: true,
        },
      ],
    };
    expect(
      canTransitionJob({
        from: "AWAITING_APPROVAL",
        to: "PAYMENT_PENDING",
        actor: "staff",
        ctx: unsafeDeclined,
      }).ok,
    ).toBe(false);
    const unsafeAcknowledged = {
      ...unsafeDeclined,
      findings: [
        {
          ...unsafeDeclined.findings[0],
          resolution: "ACKNOWLEDGED_UNREPAIRED" as const,
        },
      ],
    };
    const ackRes = canTransitionJob({
      from: "AWAITING_APPROVAL",
      to: "PAYMENT_PENDING",
      actor: "staff",
      ctx: unsafeAcknowledged,
    });
    expect(ackRes.ok).toBe(true);
    if (ackRes.ok) {
      expect(ackRes.effects).toContainEqual({ type: "SET_FOLLOW_UP_REQUIRED" });
    }

    // with actual work performed it is not a visit-fee ending
    const withWork = {
      ...declinedAll,
      lineItems: [
        { kind: "ACTUAL" as const, price: ILS(80), approvalId: null },
      ],
    };
    expect(
      canTransitionJob({
        from: "AWAITING_APPROVAL",
        to: "PAYMENT_PENDING",
        actor: "staff",
        ctx: withWork,
      }).ok,
    ).toBe(false);
  });

  it("FINAL check: UNSAFE result demands a repaired or acknowledged finding, acknowledgment sets follow-up", () => {
    const unsafeUnhandled = ctx({
      safetyChecks: [fullCheck("FINAL", "UNSAFE")],
      findings: [
        {
          id: "f1",
          severity: "UNSAFE",
          resolution: "OPEN",
          proposedPrice: null,
          hasProposal: false,
        },
      ],
    });
    expect(
      canTransitionJob({
        from: "FINAL_SAFETY_CHECK",
        to: "PAYMENT_PENDING",
        actor: "staff",
        ctx: unsafeUnhandled,
      }).ok,
    ).toBe(false);

    const acknowledged = {
      ...unsafeUnhandled,
      findings: [
        { ...unsafeUnhandled.findings[0], resolution: "ACKNOWLEDGED_UNREPAIRED" as const },
      ],
    };
    const res = canTransitionJob({
      from: "FINAL_SAFETY_CHECK",
      to: "PAYMENT_PENDING",
      actor: "staff",
      ctx: acknowledged,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.effects).toContainEqual({ type: "SET_FOLLOW_UP_REQUIRED" });
    }
  });

  it("payment guard: upward edits beyond the approved total are rejected", () => {
    const c = ctx({
      expectedTotal: ILS(80),
      approvals: [
        { id: "a1", findingId: "f1", decision: "APPROVED", price: ILS(80) },
      ],
    });
    expect(approvedTotal(c)).toBe(ILS(160));
    expect(validateFinalAmount(c, ILS(160)).ok).toBe(true);
    expect(validateFinalAmount(c, ILS(200)).ok).toBe(false); // surprise ⇒ blocked
    expect(validateFinalAmount(c, ILS(140)).ok).toBe(false); // discount needs reason
    expect(
      validateFinalAmount(
        { ...c, amountAdjustReason: "מחווה ללקוח חוזר" },
        ILS(140),
      ).ok,
    ).toBe(true);
  });

  it("COMPLETED requires recorded payment and an after-photo (or skip reason)", () => {
    const base = ctx({
      paymentState: "PAID_CASH",
      finalAmount: ILS(80),
      safetyChecks: [fullCheck("INSPECTION"), fullCheck("FINAL")],
    });
    expect(
      canTransitionJob({
        from: "PAYMENT_PENDING",
        to: "COMPLETED",
        actor: "staff",
        ctx: base,
      }).ok,
    ).toBe(false); // no after photo

    expect(
      canTransitionJob({
        from: "PAYMENT_PENDING",
        to: "COMPLETED",
        actor: "staff",
        ctx: { ...base, hasAfterPhoto: true },
      }).ok,
    ).toBe(true);

    expect(
      canTransitionJob({
        from: "PAYMENT_PENDING",
        to: "COMPLETED",
        actor: "staff",
        ctx: { ...base, paymentState: "PENDING", hasAfterPhoto: true },
      }).ok,
    ).toBe(false); // payment not recorded
  });

  it("cancel and unresolved endings require reasons and release the appointment", () => {
    expect(
      canTransitionJob({ from: "SCHEDULED", to: "CANCELLED", actor: "staff", ctx: ctx() })
        .ok,
    ).toBe(false);
    const cancelled = canTransitionJob({
      from: "SCHEDULED",
      to: "CANCELLED",
      actor: "staff",
      ctx: ctx(),
      cancelReason: "CUSTOMER_REQUEST",
    });
    expect(cancelled.ok).toBe(true);
    if (cancelled.ok) {
      expect(cancelled.effects).toContainEqual({ type: "RELEASE_APPOINTMENT" });
    }

    expect(
      canTransitionJob({ from: "ARRIVED", to: "UNRESOLVED", actor: "staff", ctx: ctx() })
        .ok,
    ).toBe(false);
    const noShow = canTransitionJob({
      from: "ARRIVED",
      to: "UNRESOLVED",
      actor: "staff",
      ctx: ctx(),
      unresolvedReason: "NO_SHOW",
    });
    expect(noShow.ok).toBe(true);
    if (noShow.ok) {
      expect(noShow.effects).toContainEqual({ type: "RELEASE_APPOINTMENT" });
    }
  });

  it("customers can never drive operational transitions", () => {
    for (const key of [
      ["SCHEDULED", "EN_ROUTE"],
      ["INSPECTION", "IN_SERVICE"],
      ["PAYMENT_PENDING", "COMPLETED"],
    ] as const) {
      expect(
        canTransitionJob({
          from: key[0],
          to: key[1],
          actor: "customer",
          ctx: ctx({ safetyChecks: [fullCheck("INSPECTION")] }),
        }).ok,
      ).toBe(false);
    }
  });
});
