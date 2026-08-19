"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import * as schema from "@/db/schema";
import { requireStaff } from "@/server/auth";
import { canTransitionRequest } from "@/domain/request-machine";
import { logAudit, logEvent } from "@/server/log";
import { ILS } from "@/domain/types";

type ActionResult = { ok: boolean; error?: string };

const reviewSchema = z.object({
  requestId: z.string().uuid(),
  serviceLabelHe: z.string().min(2).max(120),
  priceLowShekels: z.coerce.number().min(0).max(10000),
  priceHighShekels: z.coerce.number().min(0).max(10000).optional(),
  durationMin: z.coerce.number().int().min(10).max(240),
  reviewNotes: z.string().max(500).optional(),
}).refine(
  (v) => v.priceHighShekels == null || v.priceHighShekels >= v.priceLowShekels,
  { message: "'עד' חייב להיות גבוה מהמחיר ההתחלתי" },
);

/** Operator prices an ambiguous request → READY_TO_BOOK (customer books via link). */
export async function reviewRequestAction(
  input: z.infer<typeof reviewSchema>,
): Promise<ActionResult> {
  const staff = await requireStaff();
  const parsed = reviewSchema.parse(input);
  const d = await db();
  const rows = await d
    .select()
    .from(schema.serviceRequests)
    .where(eq(schema.serviceRequests.id, parsed.requestId));
  const request = rows[0];
  if (!request) return { ok: false, error: "בקשה לא נמצאה" };

  const guard = canTransitionRequest({
    from: request.status as never,
    to: "READY_TO_BOOK",
    actor: "staff",
  });
  if (!guard.ok) return { ok: false, error: guard.error };

  const priceLow = ILS(parsed.priceLowShekels);
  const priceHigh =
    parsed.priceHighShekels != null ? ILS(parsed.priceHighShekels) : null;
  await d
    .update(schema.serviceRequests)
    .set({
      status: "READY_TO_BOOK",
      reviewNotes: parsed.reviewNotes,
      assessment: {
        expectedServiceIds: [],
        durationEstMin: parsed.durationMin,
        blockDurationMin: parsed.durationMin + 10,
        priceType: priceHigh != null && priceHigh !== priceLow ? "RANGE" : "FIXED",
        priceLow,
        priceHigh: priceHigh ?? priceLow,
        confidence: "HIGH",
        rationale: `תומחר ידנית ע"י ${staff.name}: ${parsed.serviceLabelHe}`,
      },
      updatedAt: new Date(),
    })
    .where(eq(schema.serviceRequests.id, request.id));

  await logEvent(d, "service_request", request.id, "status:READY_TO_BOOK", `staff:${staff.id}`, {
    service: parsed.serviceLabelHe,
    priceLow,
  });
  revalidatePath("/pro/requests");
  return { ok: true };
}

export async function requestInfoAction(requestId: string): Promise<ActionResult> {
  const staff = await requireStaff();
  const d = await db();
  const rows = await d
    .select()
    .from(schema.serviceRequests)
    .where(eq(schema.serviceRequests.id, requestId));
  const request = rows[0];
  if (!request) return { ok: false, error: "בקשה לא נמצאה" };
  const guard = canTransitionRequest({
    from: request.status as never,
    to: "NEEDS_CUSTOMER_INFO",
    actor: "staff",
  });
  if (!guard.ok) return { ok: false, error: guard.error };
  await d
    .update(schema.serviceRequests)
    .set({ status: "NEEDS_CUSTOMER_INFO", updatedAt: new Date() })
    .where(eq(schema.serviceRequests.id, requestId));
  await logEvent(d, "service_request", requestId, "status:NEEDS_CUSTOMER_INFO", `staff:${staff.id}`);
  revalidatePath("/pro/requests");
  return { ok: true };
}

const rejectSchema = z.object({
  requestId: z.string().uuid(),
  kind: z.enum(["OUT_OF_SCOPE", "WORKSHOP_REQUIRED"]),
  reason: z.enum([
    "E_BIKE",
    "ROAD_BIKE",
    "SUSPENSION",
    "WHEEL_BUILDING",
    "WORKSHOP_CLASS",
    "OTHER",
  ]),
});

export async function rejectRequestAction(
  input: z.infer<typeof rejectSchema>,
): Promise<ActionResult> {
  const staff = await requireStaff();
  const parsed = rejectSchema.parse(input);
  const d = await db();
  const rows = await d
    .select()
    .from(schema.serviceRequests)
    .where(eq(schema.serviceRequests.id, parsed.requestId));
  const request = rows[0];
  if (!request) return { ok: false, error: "בקשה לא נמצאה" };
  const guard = canTransitionRequest({
    from: request.status as never,
    to: parsed.kind,
    actor: "staff",
    reason: parsed.reason,
  });
  if (!guard.ok) return { ok: false, error: guard.error };
  await d
    .update(schema.serviceRequests)
    .set({ status: parsed.kind, statusReason: parsed.reason, updatedAt: new Date() })
    .where(eq(schema.serviceRequests.id, parsed.requestId));
  await logAudit(d, staff.id, "request.reject", "service_request", parsed.requestId, parsed);
  revalidatePath("/pro/requests");
  return { ok: true };
}
