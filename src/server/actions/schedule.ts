"use server";

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import * as schema from "@/db/schema";
import {
  computeSlots,
  isSlotStillEligible,
  loadSchedulingConfig,
} from "@/server/scheduling";
import { emptyJobContext, requestForScheduling } from "@/server/job-helpers";
import { canTransitionRequest } from "@/domain/request-machine";
import { canTransitionJob } from "@/domain/job-machine";
import { logEvent } from "@/server/log";
import { clientKeyFromHeaders, rateLimit } from "@/server/rate-limit";
import { headers } from "next/headers";

const token = () => randomBytes(16).toString("hex");

export interface BookResult {
  ok: boolean;
  jobToken?: string;
  stale?: boolean; // chosen slot no longer available — show fresh alternatives
  noSlots?: boolean;
  error?: string;
}

/**
 * Booking commit (docs/SCHEDULING.md): full Stage-1 revalidation inside the
 * transaction; the appointments exclusion constraint serializes overlapping
 * commits at the schema level — the loser gets honest alternatives, never a
 * silent double-booking.
 */
export async function bookSlotAction(
  requestToken: string,
  plannedStartISO: string,
): Promise<BookResult> {
  const h = await headers();
  const ip = clientKeyFromHeaders(h);
  if (!rateLimit(`book:${ip}`, 10, 10 * 60 * 1000)) {
    return { ok: false, error: "יותר מדי נסיונות — רגע הפסקה" };
  }

  const d = await db();
  const requests = await d
    .select()
    .from(schema.serviceRequests)
    .where(eq(schema.serviceRequests.publicToken, requestToken));
  const request = requests[0];
  if (!request) return { ok: false, error: "הבקשה לא נמצאה" };
  if (request.status !== "READY_TO_BOOK") {
    return { ok: false, error: "הבקשה כבר טופלה" };
  }
  const schedReq = requestForScheduling(d, request);
  if (!schedReq || !request.assessment) {
    return { ok: false, error: "חסרים נתונים לשיבוץ" };
  }

  const plannedStart = new Date(plannedStartISO);
  if (Number.isNaN(plannedStart.getTime())) {
    return { ok: false, error: "מועד לא תקין" };
  }

  // Stage-1 revalidation against fresh calendar truth (staleness guard)
  if (!(await isSlotStillEligible(d, schedReq, plannedStart))) {
    return { ok: false, stale: true };
  }

  const config = await loadSchedulingConfig(d);
  const a = request.assessment;
  const zone = (
    await d
      .select()
      .from(schema.serviceZones)
      .where(eq(schema.serviceZones.id, schedReq.zoneId))
  )[0];
  const techs = await d
    .select()
    .from(schema.technicians)
    .where(eq(schema.technicians.active, true));
  const tech = techs[0];

  const blockEnd = new Date(
    plannedStart.getTime() + a.blockDurationMin * 60 * 1000,
  );
  const windowEnd = new Date(
    plannedStart.getTime() + config.windowMinutes * 60 * 1000,
  );

  const services = a.expectedServiceIds.length
    ? await d.select().from(schema.serviceCatalogItems)
    : [];
  const expectedServices = services.filter((s) =>
    a.expectedServiceIds.includes(s.id),
  );

  const jobToken = token();
  try {
    const result = await d.transaction(async (tx) => {
      const [job] = await tx
        .insert(schema.serviceJobs)
        .values({
          publicToken: jobToken,
          householdId: request.householdId!,
          customerId: request.customerId!,
          bicycleId: request.bicycleId!,
          locationId: request.locationId!,
          technicianId: tech.id,
          serviceRequestId: request.id,
          status: "DRAFT",
          reportedSymptoms: request.symptomCategory,
          intakeSnapshot: request.intakeAnswers,
          expectedTotal: a.priceLow,
          expectedTotalHigh: a.priceHigh,
          travelCharge: zone?.travelCharge ?? 0,
          priceNoteHe:
            zone && zone.travelCharge == null
              ? "כולל הגעה — תוספת האזור תאושר סופית בתיאום"
              : null,
        })
        .returning();

      // exclusion constraint fires here on overlap — the race guard
      await tx.insert(schema.appointments).values({
        jobId: job.id,
        technicianId: tech.id,
        status: "ACTIVE",
        windowStart: plannedStart,
        windowEnd,
        blockStart: plannedStart,
        blockEnd,
        plannedStart,
      });

      for (const s of expectedServices) {
        await tx.insert(schema.jobLineItems).values({
          jobId: job.id,
          catalogItemId: s.id,
          label: s.customerNameHe,
          kind: "EXPECTED",
          price: a.priceLow != null && expectedServices.length === 1 ? a.priceLow : s.basePrice,
          priceHigh: a.priceHigh,
        });
      }

      const guard = canTransitionJob({
        from: "DRAFT",
        to: "SCHEDULED",
        actor: "customer",
        ctx: { ...emptyJobContext(), hasActiveAppointment: true },
      });
      if (!guard.ok) throw new Error(guard.error);
      await tx
        .update(schema.serviceJobs)
        .set({ status: "SCHEDULED", updatedAt: new Date() })
        .where(eq(schema.serviceJobs.id, job.id));

      const reqGuard = canTransitionRequest({
        from: "READY_TO_BOOK",
        to: "CONVERTED_TO_JOB",
        actor: "customer",
      });
      if (!reqGuard.ok) throw new Error(reqGuard.error);
      // conditional conversion: a double-submit loses here and rolls back —
      // one request can never yield two jobs
      const converted = await tx
        .update(schema.serviceRequests)
        .set({ status: "CONVERTED_TO_JOB", updatedAt: new Date() })
        .where(
          and(
            eq(schema.serviceRequests.id, request.id),
            eq(schema.serviceRequests.status, "READY_TO_BOOK"),
          ),
        )
        .returning();
      if (converted.length === 0) {
        throw new Error("ALREADY_CONVERTED");
      }

      return job;
    });

    await logEvent(d, "service_job", result.id, "status:SCHEDULED", "customer", {
      plannedStart: plannedStart.toISOString(),
    });
    return { ok: true, jobToken };
  } catch (e) {
    const msg = `${String(e)} ${String((e as Error).cause ?? "")}`;
    if (/ALREADY_CONVERTED/.test(msg)) {
      return { ok: false, error: "הבקשה כבר תואמה" };
    }
    if (/appointments_no_overlap|exclusion|conflict/i.test(msg)) {
      return { ok: false, stale: true }; // lost the race — honest alternatives
    }
    console.error("bookSlotAction failed", e);
    return { ok: false, error: "משהו השתבש, נסו שוב" };
  }
}

/** No eligible slot anywhere — drop to operator review (never a dead end). */
export async function noSlotFallbackAction(
  requestToken: string,
): Promise<{ ok: boolean }> {
  const d = await db();
  const requests = await d
    .select()
    .from(schema.serviceRequests)
    .where(eq(schema.serviceRequests.publicToken, requestToken));
  const request = requests[0];
  if (!request || request.status !== "READY_TO_BOOK") return { ok: false };
  const guard = canTransitionRequest({
    from: "READY_TO_BOOK",
    to: "NEEDS_REVIEW",
    actor: "system",
    reason: "NO_SLOT",
  });
  if (!guard.ok) return { ok: false };
  await d
    .update(schema.serviceRequests)
    .set({ status: "NEEDS_REVIEW", statusReason: "NO_SLOT", updatedAt: new Date() })
    .where(eq(schema.serviceRequests.id, request.id));
  await logEvent(d, "service_request", request.id, "status:NEEDS_REVIEW", "system", {
    reason: "NO_SLOT",
  });
  return { ok: true };
}

/** Slots for the picker page (server-rendered). */
export async function getSlotsForToken(requestToken: string) {
  const d = await db();
  const requests = await d
    .select()
    .from(schema.serviceRequests)
    .where(eq(schema.serviceRequests.publicToken, requestToken));
  const request = requests[0];
  if (!request || request.status !== "READY_TO_BOOK") return null;
  const schedReq = requestForScheduling(d, request);
  if (!schedReq) return null;
  const config = await loadSchedulingConfig(d);
  let res = await computeSlots(d, schedReq);
  if (res.slots.length === 0) {
    res = await computeSlots(d, schedReq, { days: config.fallbackSearchDays });
  }
  return {
    display: res.display.map(slotView),
    all: res.slots.slice(0, 60).map(slotView),
  };
}

function slotView(s: {
  plannedStart: Date;
  windowStart: Date;
  windowEnd: Date;
  dateKey: string;
}) {
  return {
    plannedStartISO: s.plannedStart.toISOString(),
    windowStartISO: s.windowStart.toISOString(),
    windowEndISO: s.windowEnd.toISOString(),
    dateKey: s.dateKey,
  };
}
