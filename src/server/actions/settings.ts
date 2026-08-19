"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import * as schema from "@/db/schema";
import { requireStaff } from "@/server/auth";
import { logAudit } from "@/server/log";
import { ILS } from "@/domain/types";

/** All operational config is data — editable here, hardcoded nowhere. */

const serviceSchema = z.object({
  id: z.string().uuid(),
  customerNameHe: z.string().min(1),
  priceType: z.enum(["FIXED", "RANGE", "QUOTE"]),
  basePriceShekels: z.coerce.number().min(0).optional(),
  priceHighShekels: z.coerce.number().min(0).optional(),
  estDurationMin: z.coerce.number().int().min(5).max(240),
  blockDurationMin: z.coerce.number().int().min(5).max(300),
  instantBookEligible: z.coerce.boolean(),
  active: z.coerce.boolean(),
}).refine(
  (v) =>
    v.priceType !== "RANGE" ||
    v.priceHighShekels == null ||
    v.basePriceShekels == null ||
    v.priceHighShekels >= v.basePriceShekels,
  { message: "בטווח מחירים, 'עד' חייב להיות גבוה מהמחיר הבסיסי" },
);

export async function updateServiceAction(formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const parsed = serviceSchema.parse({
    id: formData.get("id"),
    customerNameHe: formData.get("customerNameHe"),
    priceType: formData.get("priceType"),
    basePriceShekels: formData.get("basePriceShekels") || undefined,
    priceHighShekels: formData.get("priceHighShekels") || undefined,
    estDurationMin: formData.get("estDurationMin"),
    blockDurationMin: formData.get("blockDurationMin"),
    instantBookEligible: formData.get("instantBookEligible") === "on",
    active: formData.get("active") === "on",
  });

  const d = await db();
  await d
    .update(schema.serviceCatalogItems)
    .set({
      customerNameHe: parsed.customerNameHe,
      priceType: parsed.priceType,
      basePrice:
        parsed.basePriceShekels != null ? ILS(parsed.basePriceShekels) : null,
      priceHigh:
        parsed.priceHighShekels != null ? ILS(parsed.priceHighShekels) : null,
      estDurationMin: parsed.estDurationMin,
      blockDurationMin: parsed.blockDurationMin,
      instantBookEligible: parsed.instantBookEligible,
      active: parsed.active,
    })
    .where(eq(schema.serviceCatalogItems.id, parsed.id));
  await logAudit(d, staff.id, "service.update", "service_catalog_item", parsed.id, {
    ...parsed,
  });
  revalidatePath("/pro/settings/services");
}

const money = z
  .string()
  .refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0), "מחיר לא תקין");
const zoneSchema = z.object({
  id: z.string().uuid(),
  travelChargeShekels: money, // "" = TBD (null)
  minOrderShekels: money,
  travelBufferMin: z.coerce.number().int().min(0).max(120),
  instantBookEnabled: z.coerce.boolean(),
  active: z.coerce.boolean(),
});

export async function updateZoneAction(formData: FormData): Promise<void> {
  const staff = await requireStaff();
  const parsed = zoneSchema.parse({
    id: formData.get("id"),
    travelChargeShekels: String(formData.get("travelChargeShekels") ?? ""),
    minOrderShekels: String(formData.get("minOrderShekels") ?? ""),
    travelBufferMin: formData.get("travelBufferMin"),
    instantBookEnabled: formData.get("instantBookEnabled") === "on",
    active: formData.get("active") === "on",
  });

  const d = await db();
  await d
    .update(schema.serviceZones)
    .set({
      travelCharge:
        parsed.travelChargeShekels === ""
          ? null
          : ILS(Number(parsed.travelChargeShekels)),
      minOrder:
        parsed.minOrderShekels === ""
          ? null
          : ILS(Number(parsed.minOrderShekels)),
      travelBufferMin: parsed.travelBufferMin,
      instantBookEnabled: parsed.instantBookEnabled,
      active: parsed.active,
    })
    .where(eq(schema.serviceZones.id, parsed.id));
  await logAudit(d, staff.id, "zone.update", "service_zone", parsed.id, {
    ...parsed,
  });
  revalidatePath("/pro/settings/zones");
}

const hoursSchema = z.object({
  technicianId: z.string().uuid(),
  startLat: z.string().refine((v) => Number.isFinite(Number(v)) && Math.abs(Number(v)) <= 90, "קו רוחב לא תקין"),
  startLng: z.string().refine((v) => Number.isFinite(Number(v)) && Math.abs(Number(v)) <= 180, "קו אורך לא תקין"),
  days: z.array(
    z
      .object({
        dayOfWeek: z.number().int().min(0).max(6),
        enabled: z.boolean(),
        startMinute: z.number().int().min(0).max(1439),
        endMinute: z.number().int().min(1).max(1440),
      })
      .refine((d) => !d.enabled || d.endMinute > d.startMinute, {
        message: "שעת סיום חייבת להיות אחרי שעת התחלה",
      }),
  ),
});

export async function updateAvailabilityAction(
  formData: FormData,
): Promise<void> {
  const staff = await requireStaff();
  const days = [0, 1, 2, 3, 4, 5, 6].map((day) => {
    const start = String(formData.get(`start_${day}`) ?? "");
    const end = String(formData.get(`end_${day}`) ?? "");
    const enabled = formData.get(`enabled_${day}`) === "on" && !!start && !!end;
    const toMin = (v: string) => {
      const [h, m] = v.split(":").map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    return {
      dayOfWeek: day,
      enabled,
      startMinute: enabled ? toMin(start) : 0,
      endMinute: enabled ? toMin(end) : 1,
    };
  });
  const parsed = hoursSchema.parse({
    technicianId: formData.get("technicianId"),
    startLat: formData.get("startLat"),
    startLng: formData.get("startLng"),
    days,
  });

  const d = await db();
  await d
    .update(schema.technicians)
    .set({ startLat: parsed.startLat, startLng: parsed.startLng })
    .where(eq(schema.technicians.id, parsed.technicianId));
  await d
    .delete(schema.technicianHours)
    .where(eq(schema.technicianHours.technicianId, parsed.technicianId));
  const enabled = parsed.days.filter((x) => x.enabled);
  if (enabled.length > 0) {
    await d.insert(schema.technicianHours).values(
      enabled.map((x) => ({
        technicianId: parsed.technicianId,
        dayOfWeek: x.dayOfWeek,
        startMinute: x.startMinute,
        endMinute: x.endMinute,
      })),
    );
  }
  await logAudit(d, staff.id, "availability.update", "technician", parsed.technicianId, {
    days: enabled,
  });
  revalidatePath("/pro/settings/availability");
}
