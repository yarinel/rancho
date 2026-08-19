"use server";

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import * as schema from "@/db/schema";
import { resolveZone } from "@/server/geo";
import { assess } from "@/domain/assessment";
import {
  BICYCLE_CATEGORIES,
  OUT_OF_SCOPE_CATEGORIES,
  SYMPTOM_CATEGORIES,
  WHEEL_SIZES,
} from "@/domain/types";
import { INTAKE_SCHEMA_VERSION } from "@/domain/intake";
import { canTransitionRequest } from "@/domain/request-machine";
import { logEvent } from "@/server/log";
import { clientKeyFromHeaders, rateLimit } from "@/server/rate-limit";
import { headers } from "next/headers";

const token = () => randomBytes(16).toString("hex"); // 128-bit unguessable

async function limited(bucket: string, limit = 30): Promise<boolean> {
  const h = await headers();
  const ip = clientKeyFromHeaders(h);
  return rateLimit(`${bucket}:${ip}`, limit, 10 * 60 * 1000);
}

/* ------------------------------ draft creation ----------------------------- */

const draftSchema = z.object({
  symptom: z.enum(SYMPTOM_CATEGORIES),
  bikeCategory: z.enum(BICYCLE_CATEGORIES),
  wheelSize: z.enum(WHEEL_SIZES),
  brand: z.string().max(80).optional(),
  riderName: z.string().max(80).optional(),
  hasGears: z.enum(["yes", "no", "unknown"]).optional(),
});

export interface DraftResult {
  ok: boolean;
  requestToken?: string;
  outOfScope?: boolean;
  error?: string;
}

/** Anonymous draft persisted from the bike step (household attaches at contact). */
export async function createDraftAction(
  input: z.infer<typeof draftSchema>,
): Promise<DraftResult> {
  if (!(await limited("draft"))) return { ok: false, error: "יותר מדי בקשות" };
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "קלט לא תקין" };
  const data = parsed.data;

  // out-of-scope categories exit before any booking (never silently booked)
  if (OUT_OF_SCOPE_CATEGORIES.includes(data.bikeCategory)) {
    return { ok: true, outOfScope: true };
  }

  const d = await db();
  const publicToken = token();
  await d.insert(schema.serviceRequests).values({
    publicToken,
    symptomCategory: data.symptom,
    intakeSchemaVersion: INTAKE_SCHEMA_VERSION,
    intakeAnswers: {
      _bike_category: data.bikeCategory,
      _wheel_size: data.wheelSize,
      ...(data.brand ? { _brand: data.brand } : {}),
      ...(data.riderName ? { _rider_name: data.riderName } : {}),
      ...(data.hasGears ? { _has_gears: data.hasGears } : {}),
    },
  });
  return { ok: true, requestToken: publicToken };
}

/* ------------------------------ draft updates ------------------------------ */

async function loadDraft(d: Awaited<ReturnType<typeof db>>, requestToken: string) {
  const rows = await d
    .select()
    .from(schema.serviceRequests)
    .where(eq(schema.serviceRequests.publicToken, requestToken));
  return rows[0] ?? null;
}

export async function saveAnswersAction(
  requestToken: string,
  answers: Record<string, string>,
): Promise<{ ok: boolean }> {
  if (!(await limited("answers", 60))) return { ok: false };
  const d = await db();
  const draft = await loadDraft(d, requestToken);
  if (!draft || draft.status !== "NEW") return { ok: false };
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(answers)) {
    if (/^[a-z_]{1,40}$/.test(k) && typeof v === "string" && v.length <= 80) {
      clean[k] = v;
    }
  }
  await d
    .update(schema.serviceRequests)
    .set({
      intakeAnswers: { ...draft.intakeAnswers, ...clean },
      updatedAt: new Date(),
    })
    .where(eq(schema.serviceRequests.id, draft.id));
  return { ok: true };
}

/* -------------------------------- location -------------------------------- */

const locationSchema = z.object({
  requestToken: z.string().min(10),
  address: z.string().min(3).max(200),
  accessNotes: z.string().max(300).optional(),
});

export interface LocationResult {
  ok: boolean;
  inZone?: boolean;
  zoneNameHe?: string | null;
  error?: string;
}

export async function saveLocationAction(
  input: z.infer<typeof locationSchema>,
): Promise<LocationResult> {
  if (!(await limited("location", 60))) return { ok: false, error: "יותר מדי בקשות" };
  const parsed = locationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "כתובת לא תקינה" };

  const d = await db();
  const draft = await loadDraft(d, parsed.data.requestToken);
  if (!draft) return { ok: false, error: "הבקשה לא נמצאה" };
  if (draft.status !== "NEW") {
    return { ok: false, error: "הבקשה כבר נשלחה — אי אפשר לעדכן כתובת" };
  }

  let geo;
  try {
    geo = await resolveZone(d, parsed.data.address);
  } catch (e) {
    console.error("resolveZone failed", e);
    return { ok: false, error: "לא הצלחנו לזהות את הכתובת — נסו שוב" };
  }
  await d
    .update(schema.serviceRequests)
    .set({
      intakeAnswers: {
        ...draft.intakeAnswers,
        _address: parsed.data.address,
        _access_notes: parsed.data.accessNotes ?? "",
        _zone_id: geo.zoneId ?? "",
        _zone_name: geo.zoneNameHe ?? "",
        _lat: geo.lat ?? "",
        _lng: geo.lng ?? "",
      },
      updatedAt: new Date(),
    })
    .where(eq(schema.serviceRequests.id, draft.id));

  return { ok: true, inZone: !!geo.zoneId, zoneNameHe: geo.zoneNameHe };
}

/* --------------------------------- leads ----------------------------------- */

const leadSchema = z.object({
  phone: z.string().min(9).max(20),
  area: z.string().max(120).optional(),
  reason: z.enum(["OUT_OF_ZONE", "OUT_OF_SCOPE", "NO_SLOT"]),
  note: z.string().max(300).optional(),
});

export async function createLeadAction(
  input: z.infer<typeof leadSchema>,
): Promise<{ ok: boolean }> {
  if (!(await limited("lead", 10))) return { ok: false };
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const d = await db();
  await d.insert(schema.leads).values(parsed.data);
  return { ok: true };
}

/* ------------------------- contact + assessment ---------------------------- */

const contactSchema = z.object({
  requestToken: z.string().min(10),
  name: z.string().min(2).max(80),
  phone: z
    .string()
    .regex(/^0\d{8,9}$/, "מספר טלפון ישראלי")
    .transform((p) => `+972${p.slice(1)}`),
  timePreference: z.enum(["MORNING", "AFTERNOON", "NONE"]).default("NONE"),
  photosProvided: z.boolean(),
});

export interface SubmitResult {
  ok: boolean;
  path?: "INSTANT_BOOK" | "SERVICE_REQUEST";
  requestToken?: string;
  assessment?: {
    serviceNamesHe: string[];
    priceType: string;
    priceLow: number | null;
    priceHigh: number | null;
    confidence: string;
    durationEstMin: number;
    travelCharge: number | null;
    travelChargeKnown: boolean;
  };
  error?: string;
}

/**
 * The contact step bootstraps the Household (guest booking — no password),
 * runs the deterministic assessment, and routes to instant-book or review.
 */
export async function submitContactAction(
  input: z.infer<typeof contactSchema>,
): Promise<SubmitResult> {
  if (!(await limited("contact", 15))) return { ok: false, error: "יותר מדי בקשות" };
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  }
  const data = parsed.data;

  const d = await db();
  const draft = await loadDraft(d, data.requestToken);
  if (!draft) return { ok: false, error: "הבקשה לא נמצאה" };
  if (draft.status !== "NEW") {
    return { ok: false, error: "הבקשה כבר נשלחה — בדקו את קישור הסטטוס שלכם" };
  }
  const answers = draft.intakeAnswers;

  // reuse an existing household by phone (returning guest). A name mismatch
  // gets its OWN household — a typo'd phone must never attach one family's
  // address to another family's record.
  const existingCustomer = await d
    .select()
    .from(schema.customers)
    .where(eq(schema.customers.phone, data.phone));
  const normalized = (n: string) => n.trim().replace(/\s+/g, " ");
  const matched = existingCustomer.find(
    (c) => normalized(c.name) === normalized(data.name),
  );
  let householdId: string;
  let customerId: string;
  if (matched) {
    householdId = matched.householdId;
    customerId = matched.id;
  } else {
    const [hh] = await d
      .insert(schema.households)
      .values({ label: data.name })
      .returning();
    householdId = hh.id;
    const [cust] = await d
      .insert(schema.customers)
      .values({ householdId, name: data.name, phone: data.phone })
      .returning();
    customerId = cust.id;
  }

  // reuse household entities when they match — the bicycle owns its history
  let riderId: string | null = null;
  if (answers._rider_name) {
    const existingRiders = await d
      .select()
      .from(schema.riders)
      .where(eq(schema.riders.householdId, householdId));
    const rmatch = existingRiders.find(
      (r) => normalized(r.displayName) === normalized(answers._rider_name),
    );
    if (rmatch) {
      riderId = rmatch.id;
    } else {
      const [rider] = await d
        .insert(schema.riders)
        .values({ householdId, displayName: answers._rider_name })
        .returning();
      riderId = rider.id;
    }
  }

  const householdBikes = await d
    .select()
    .from(schema.bicycles)
    .where(eq(schema.bicycles.householdId, householdId));
  const bikeMatch = householdBikes.find(
    (b) =>
      b.category === (answers._bike_category ?? "other") &&
      b.wheelSize === (answers._wheel_size ?? "unknown") &&
      (b.brand ?? "") === (answers._brand ?? ""),
  );
  const bike =
    bikeMatch ??
    (
      await d
        .insert(schema.bicycles)
        .values({
          householdId,
          riderId,
          category: answers._bike_category ?? "other",
          wheelSize: answers._wheel_size ?? "unknown",
          hasGears:
            answers._has_gears === "yes"
              ? true
              : answers._has_gears === "no"
                ? false
                : null,
          brand: answers._brand || null,
        })
        .returning()
    )[0];

  const householdLocations = await d
    .select()
    .from(schema.locations)
    .where(eq(schema.locations.householdId, householdId));
  const locMatch = householdLocations.find(
    (l) => normalized(l.formattedAddress) === normalized(answers._address ?? ""),
  );
  const location =
    locMatch ??
    (
      await d
        .insert(schema.locations)
        .values({
          householdId,
          formattedAddress: answers._address ?? "",
          zoneId: answers._zone_id || null,
          lat: answers._lat || null,
          lng: answers._lng || null,
          accessNotes: answers._access_notes || null,
        })
        .returning()
    )[0];

  // never trust the client's photo claim — count what was actually uploaded
  const uploaded = await d
    .select()
    .from(schema.media)
    .where(eq(schema.media.requestId, draft.id));
  const photosProvided = uploaded.length > 0;

  const catalog = await d.select().from(schema.serviceCatalogItems);
  const zone = answers._zone_id
    ? (
        await d
          .select()
          .from(schema.serviceZones)
          .where(eq(schema.serviceZones.id, answers._zone_id))
      )[0]
    : null;

  const result = assess({
    symptom: draft.symptomCategory as never,
    answers,
    bike: { category: bike.category as never, wheelSize: bike.wheelSize as never },
    photosProvided,
    zoneTravelChargeKnown: zone ? zone.travelCharge != null : false,
    catalog: catalog.map((c) => ({
      id: c.id,
      internalName: c.internalName,
      customerNameHe: c.customerNameHe,
      priceType: c.priceType,
      basePrice: c.basePrice,
      priceHigh: c.priceHigh,
      estDurationMin: c.estDurationMin,
      blockDurationMin: c.blockDurationMin,
      instantBookEligible: c.instantBookEligible,
      active: c.active,
      wheelSizeConstraints: c.wheelSizeConstraints,
    })),
  });

  const zoneInstantOk = zone ? zone.instantBookEnabled && zone.active : false;
  const nextStatus =
    result.instantBookable && zoneInstantOk ? "READY_TO_BOOK" : "NEEDS_REVIEW";
  const guard = canTransitionRequest({
    from: "NEW",
    to: nextStatus,
    actor: "system",
  });
  if (!guard.ok) return { ok: false, error: guard.error };

  await d
    .update(schema.serviceRequests)
    .set({
      householdId,
      customerId,
      bicycleId: bike.id,
      locationId: location.id,
      timePreference: data.timePreference,
      status: nextStatus,
      assessment: {
        expectedServiceIds: result.expectedServiceIds,
        durationEstMin: result.durationEstMin,
        blockDurationMin: result.blockDurationMin,
        priceType: result.priceType,
        priceLow: result.priceLow,
        priceHigh: result.priceHigh,
        confidence: result.confidence,
        rationale: result.rationale,
      },
      updatedAt: new Date(),
    })
    .where(eq(schema.serviceRequests.id, draft.id));

  // link intake media uploaded against this request to the bicycle
  await d
    .update(schema.media)
    .set({ bicycleId: bike.id })
    .where(eq(schema.media.requestId, draft.id));

  await logEvent(
    d,
    "service_request",
    draft.id,
    `status:${nextStatus}`,
    `customer:${data.requestToken.slice(0, 6)}`,
    { confidence: result.confidence },
  );

  return {
    ok: true,
    path: nextStatus === "READY_TO_BOOK" ? "INSTANT_BOOK" : "SERVICE_REQUEST",
    requestToken: draft.publicToken,
    assessment: {
      serviceNamesHe: result.expectedServiceNamesHe,
      priceType: result.priceType,
      priceLow: result.priceLow,
      priceHigh: result.priceHigh,
      confidence: result.confidence,
      durationEstMin: result.durationEstMin,
      travelCharge: zone?.travelCharge ?? null,
      travelChargeKnown: zone ? zone.travelCharge != null : false,
    },
  };
}

/* ------------------------------ returning path ----------------------------- */

export interface RebookContext {
  bikeCategory: string;
  wheelSize: string;
  brand: string | null;
  riderName: string | null;
  address: string | null;
  accessNotes: string | null;
}

/** Prefill for "קבעו תיקון נוסף" from a completed job's status token (Scenario E). */
export async function getRebookContextAction(
  jobToken: string,
): Promise<RebookContext | null> {
  if (!(await limited("rebook", 30))) return null;
  if (!/^[a-f0-9]{24,64}$/.test(jobToken)) return null;
  const d = await db();
  const jobs = await d
    .select()
    .from(schema.serviceJobs)
    .where(eq(schema.serviceJobs.publicToken, jobToken));
  const job = jobs[0];
  if (!job) return null;
  const [bikes, locations] = await Promise.all([
    d.select().from(schema.bicycles).where(eq(schema.bicycles.id, job.bicycleId)),
    d.select().from(schema.locations).where(eq(schema.locations.id, job.locationId)),
  ]);
  const bike = bikes[0];
  const riders = bike?.riderId
    ? await d.select().from(schema.riders).where(eq(schema.riders.id, bike.riderId))
    : [];
  return {
    bikeCategory: bike?.category ?? "other",
    wheelSize: bike?.wheelSize ?? "unknown",
    brand: bike?.brand ?? null,
    riderName: riders[0]?.displayName ?? null,
    address: locations[0]?.formattedAddress ?? null,
    accessNotes: locations[0]?.accessNotes ?? null,
  };
}
