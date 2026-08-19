"use server";

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import * as schema from "@/db/schema";
import { requireStaff } from "@/server/auth";
import { canTransitionJob } from "@/domain/job-machine";
import { emptyJobContext } from "@/server/job-helpers";
import { logAudit, logEvent } from "@/server/log";

type ActionResult = { ok: boolean; error?: string };

const isOverlap = (e: unknown) =>
  /appointments_no_overlap|exclusion|conflict/i.test(
    `${String(e)} ${String((e as Error).cause ?? "")}`,
  );

/**
 * Manual calendar control (docs/SCHEDULING.md): the operator can block time,
 * book manually, move, extend and cancel. Engine eligibility can be overridden
 * with a recorded reason; physical overlap of ACTIVE appointments stays
 * impossible at the schema level — that constraint protects real customers.
 */

const blockSchema = z.object({
  startsAtISO: z.string(),
  endsAtISO: z.string(),
  zoneId: z.string().uuid().nullable(),
  reason: z.string().max(200).optional(),
});

export async function createBlockAction(
  input: z.infer<typeof blockSchema>,
): Promise<ActionResult> {
  const staff = await requireStaff();
  const parsed = blockSchema.parse(input);
  const starts = new Date(parsed.startsAtISO);
  const ends = new Date(parsed.endsAtISO);
  if (!(starts < ends)) return { ok: false, error: "טווח זמן לא תקין" };
  const d = await db();
  const techs = await d.select().from(schema.technicians);
  const [row] = await d
    .insert(schema.calendarBlocks)
    .values({
      technicianId: techs[0].id,
      zoneId: parsed.zoneId,
      startsAt: starts,
      endsAt: ends,
      reason: parsed.reason,
    })
    .returning();
  await logAudit(d, staff.id, "calendar.block", "calendar_block", row.id, parsed);
  revalidatePath("/pro/calendar");
  return { ok: true };
}

export async function deleteBlockAction(blockId: string): Promise<ActionResult> {
  const staff = await requireStaff();
  const d = await db();
  await d.delete(schema.calendarBlocks).where(eq(schema.calendarBlocks.id, blockId));
  await logAudit(d, staff.id, "calendar.unblock", "calendar_block", blockId);
  revalidatePath("/pro/calendar");
  return { ok: true };
}

const manualBookingSchema = z.object({
  customerName: z.string().min(2).max(80),
  phone: z.string().regex(/^0\d{8,9}$/),
  address: z.string().min(3).max(200),
  note: z.string().max(300).optional(),
  startISO: z.string(),
  durationMin: z.coerce.number().int().min(15).max(240),
  overrideReason: z.string().max(200).optional(),
});

/** Minimal manual booking → household chain + SCHEDULED job (operator truth). */
export async function manualBookingAction(
  input: z.infer<typeof manualBookingSchema>,
): Promise<ActionResult> {
  const staff = await requireStaff();
  const parsed = manualBookingSchema.parse(input);
  const start = new Date(parsed.startISO);
  if (Number.isNaN(start.getTime())) return { ok: false, error: "מועד לא תקין" };
  const d = await db();
  const techs = await d.select().from(schema.technicians);
  const phone = `+972${parsed.phone.slice(1)}`;

  const existing = await d
    .select()
    .from(schema.customers)
    .where(eq(schema.customers.phone, phone));
  let householdId: string;
  let customerId: string;
  if (existing.length > 0) {
    householdId = existing[0].householdId;
    customerId = existing[0].id;
  } else {
    const [hh] = await d
      .insert(schema.households)
      .values({ label: parsed.customerName })
      .returning();
    const [cust] = await d
      .insert(schema.customers)
      .values({ householdId: hh.id, name: parsed.customerName, phone })
      .returning();
    householdId = hh.id;
    customerId = cust.id;
  }
  const [bike] = await d
    .insert(schema.bicycles)
    .values({ householdId, category: "other" })
    .returning();
  const [loc] = await d
    .insert(schema.locations)
    .values({ householdId, formattedAddress: parsed.address })
    .returning();

  try {
    const jobToken = randomBytes(16).toString("hex");
    await d.transaction(async (tx) => {
      const [job] = await tx
        .insert(schema.serviceJobs)
        .values({
          publicToken: jobToken,
          householdId,
          customerId,
          bicycleId: bike.id,
          locationId: loc.id,
          technicianId: techs[0].id,
          status: "DRAFT",
          reportedSymptoms: parsed.note ?? "הזמנה ידנית",
          retroactive: false,
        })
        .returning();
      await tx.insert(schema.appointments).values({
        jobId: job.id,
        technicianId: techs[0].id,
        windowStart: start,
        windowEnd: new Date(start.getTime() + 30 * 60 * 1000),
        blockStart: start,
        blockEnd: new Date(start.getTime() + parsed.durationMin * 60 * 1000),
        plannedStart: start,
        overrideReason: parsed.overrideReason ?? "manual booking",
      });
      const guard = canTransitionJob({
        from: "DRAFT",
        to: "SCHEDULED",
        actor: "staff",
        ctx: emptyJobContext(),
      });
      if (!guard.ok) throw new Error(guard.error);
      await tx
        .update(schema.serviceJobs)
        .set({ status: "SCHEDULED", updatedAt: new Date() })
        .where(eq(schema.serviceJobs.id, job.id));
    });
  } catch (e) {
    if (isOverlap(e)) {
      return { ok: false, error: "מתנגש עם עבודה קיימת — בחר זמן אחר" };
    }
    throw e;
  }
  await logAudit(d, staff.id, "calendar.manual_booking", null, null, {
    customer: parsed.customerName,
    start: parsed.startISO,
  });
  revalidatePath("/pro/calendar");
  revalidatePath("/pro");
  return { ok: true };
}

const moveSchema = z.object({
  jobId: z.string().uuid(),
  newStartISO: z.string(),
  durationMin: z.coerce.number().int().min(15).max(300).optional(),
});

/** Move/extend keeps the superseded appointment for history; customer-notify is prompted in UI. */
export async function moveAppointmentAction(
  input: z.infer<typeof moveSchema>,
): Promise<ActionResult> {
  const staff = await requireStaff();
  const parsed = moveSchema.parse(input);
  const newStart = new Date(parsed.newStartISO);
  if (Number.isNaN(newStart.getTime())) return { ok: false, error: "מועד לא תקין" };
  const d = await db();
  const appts = await d
    .select()
    .from(schema.appointments)
    .where(
      and(
        eq(schema.appointments.jobId, parsed.jobId),
        eq(schema.appointments.status, "ACTIVE"),
      ),
    );
  const current = appts[0];
  if (!current) return { ok: false, error: "אין תור פעיל" };
  const durationMin =
    parsed.durationMin ??
    Math.round((current.blockEnd.getTime() - current.blockStart.getTime()) / 60000);

  try {
    await d.transaction(async (tx) => {
      await tx
        .update(schema.appointments)
        .set({ status: "SUPERSEDED" })
        .where(eq(schema.appointments.id, current.id));
      await tx.insert(schema.appointments).values({
        jobId: parsed.jobId,
        technicianId: current.technicianId,
        windowStart: newStart,
        windowEnd: new Date(newStart.getTime() + 30 * 60 * 1000),
        blockStart: newStart,
        blockEnd: new Date(newStart.getTime() + durationMin * 60 * 1000),
        plannedStart: newStart,
        overrideReason: "manual move",
      });
    });
  } catch (e) {
    if (isOverlap(e)) {
      return { ok: false, error: "מתנגש עם עבודה קיימת — בחר זמן אחר" };
    }
    throw e;
  }
  await logEvent(d, "service_job", parsed.jobId, "rescheduled", `staff:${staff.id}`, {
    from: current.blockStart.toISOString(),
    to: parsed.newStartISO,
  });
  revalidatePath("/pro/calendar");
  revalidatePath("/pro");
  return { ok: true };
}
