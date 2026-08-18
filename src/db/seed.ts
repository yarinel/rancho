import { eq } from "drizzle-orm";
import type { Db } from "./client";
import * as schema from "./schema";
import { ILS } from "@/domain/types";
import { hashPassword } from "@/server/password";

/**
 * Idempotent seeds (docs/ROADMAP.md M1, decisions D1–D5):
 * ✅ price-list rows seeded active; ⚠️ rows QUOTE-typed or flagged TBD.
 * Every value here is admin-editable at runtime — these are starting points.
 */

interface CatalogSeed {
  internalName: string;
  customerNameHe: string;
  descriptionHe?: string;
  priceType: "FIXED" | "RANGE" | "QUOTE";
  basePrice?: number;
  priceHigh?: number;
  estDurationMin: number;
  blockDurationMin: number;
  supportedCategories: string[];
  wheelSizeConstraints?: string[];
  partIncludedTbd?: boolean;
  instantBookEligible: boolean;
  active: boolean;
}

const ALL_CATEGORIES = ["kids", "bmx", "mtb", "cruiser", "city", "other"];

const CATALOG: CatalogSeed[] = [
  {
    internalName: "tube_regular",
    customerNameHe: "החלפת פנימית רגילה",
    priceType: "FIXED",
    basePrice: ILS(80),
    estDurationMin: 30,
    blockDurationMin: 40,
    supportedCategories: ALL_CATEGORIES,
    wheelSizeConstraints: ["w20", "w24", "w26"], // D2: printed range only
    instantBookEligible: true,
    active: true,
  },
  {
    internalName: "tube_sealant",
    customerNameHe: "החלפת פנימית עם חומר",
    descriptionHe: "TBD: לאשר מול רנצ'ו את משמעות ״עם חומר״ והניסוח ללקוח",
    priceType: "FIXED",
    basePrice: ILS(110),
    estDurationMin: 30,
    blockDurationMin: 40,
    supportedCategories: ALL_CATEGORIES,
    wheelSizeConstraints: ["w20", "w24", "w26"],
    instantBookEligible: false, // pending wording confirmation (K#2)
    active: false,
  },
  {
    internalName: "tire_replacement",
    customerNameHe: "החלפת צמיג",
    descriptionHe: "TBD D1: 120₪ כולל צמיג או עבודה בלבד — עד אז הצעת מחיר",
    priceType: "QUOTE", // C3 unresolved — never instant-booked
    estDurationMin: 30,
    blockDurationMin: 40,
    supportedCategories: ALL_CATEGORIES,
    instantBookEligible: false,
    active: true,
  },
  {
    internalName: "brake_adjust",
    customerNameHe: "כיוון בלמים",
    priceType: "FIXED",
    basePrice: ILS(80),
    estDurationMin: 30,
    blockDurationMin: 40,
    supportedCategories: ALL_CATEGORIES,
    instantBookEligible: true,
    active: true,
  },
  {
    internalName: "gear_adjust",
    customerNameHe: "כיוון הילוכים",
    priceType: "FIXED",
    basePrice: ILS(80),
    estDurationMin: 30,
    blockDurationMin: 40,
    supportedCategories: ALL_CATEGORIES,
    instantBookEligible: true,
    active: true,
  },
  {
    internalName: "brake_gear_combo",
    customerNameHe: "כיוון בלמים + הילוכים",
    priceType: "FIXED",
    basePrice: ILS(150),
    estDurationMin: 40,
    blockDurationMin: 50,
    supportedCategories: ALL_CATEGORIES,
    instantBookEligible: true,
    active: true,
  },
  {
    internalName: "brake_cable",
    customerNameHe: "החלפת כבל מעצור",
    priceType: "FIXED",
    basePrice: ILS(80),
    estDurationMin: 30,
    blockDurationMin: 40,
    supportedCategories: ALL_CATEGORIES,
    partIncludedTbd: true, // D3
    instantBookEligible: true,
    active: true,
  },
  {
    internalName: "gear_cable",
    customerNameHe: "החלפת כבל הילוכים",
    priceType: "FIXED",
    basePrice: ILS(80),
    estDurationMin: 30,
    blockDurationMin: 40,
    supportedCategories: ALL_CATEGORIES,
    partIncludedTbd: true,
    instantBookEligible: true,
    active: true,
  },
  {
    internalName: "pedals_kids",
    customerNameHe: "החלפת פדלים – ילדים",
    priceType: "FIXED",
    basePrice: ILS(80),
    estDurationMin: 20,
    blockDurationMin: 30,
    supportedCategories: ["kids", "bmx"],
    partIncludedTbd: true,
    instantBookEligible: true,
    active: true,
  },
  {
    internalName: "pedals_adult",
    customerNameHe: "החלפת פדלים – בוגרים",
    priceType: "FIXED",
    basePrice: ILS(90),
    estDurationMin: 20,
    blockDurationMin: 30,
    supportedCategories: ["mtb", "cruiser", "city", "other"],
    partIncludedTbd: true,
    instantBookEligible: true,
    active: true,
  },
  {
    internalName: "tune_up_small",
    customerNameHe: "טיפול בקטנה",
    descriptionHe:
      "בדיקה כללית, כיוון בלמים, כיוון הילוכים, חיזוק ברגים, לחץ אוויר — ללא ניקוי ושימון שרשרת",
    priceType: "FIXED",
    basePrice: ILS(100),
    estDurationMin: 40,
    blockDurationMin: 50,
    supportedCategories: ALL_CATEGORIES,
    instantBookEligible: true,
    active: true,
  },
  {
    internalName: "tune_up_full",
    customerNameHe: "טיפול על מלא",
    descriptionHe:
      "בדיקה כללית, כיוון בלמים, כיוון הילוכים, חיזוק ברגים, לחץ אוויר, ניקוי ושימון שרשרת",
    priceType: "FIXED",
    basePrice: ILS(200),
    estDurationMin: 60,
    blockDurationMin: 75,
    supportedCategories: ALL_CATEGORIES,
    instantBookEligible: true,
    active: true,
  },
  {
    internalName: "diagnosis_only",
    customerNameHe: "אבחון ובדיקת בטיחות",
    descriptionHe: "TBD D4: דמי ביקור 50–60₪ — ערך סופי מול רנצ'ו",
    priceType: "FIXED",
    basePrice: ILS(60),
    estDurationMin: 20,
    blockDurationMin: 30,
    supportedCategories: ALL_CATEGORIES,
    instantBookEligible: false,
    active: true,
  },
];

/** zone name → address-match strings (dev geocode fallback matches on these). */
const ZONES: Array<{
  nameHe: string;
  cityMatch: string[];
  travelCharge: number | null; // agorot; null = TBD (D5)
}> = [
  { nameHe: "באר שבע", cityMatch: ["באר שבע", "באר-שבע", "b7", "beer sheva"], travelCharge: 0 },
  { nameHe: "אופקים", cityMatch: ["אופקים"], travelCharge: null },
  { nameHe: "חצרים", cityMatch: ["חצרים"], travelCharge: null },
  { nameHe: "עומר", cityMatch: ["עומר"], travelCharge: null },
  { nameHe: "מיתר", cityMatch: ["מיתר"], travelCharge: null },
  { nameHe: "כרמית", cityMatch: ["כרמית"], travelCharge: null },
];

/** Sun–Thu, 15:00–20:00 (spec: "mainly afternoons"; fully editable). */
const DEFAULT_WINDOWS = [0, 1, 2, 3, 4].map((day) => ({
  dayOfWeek: day,
  startMinute: 15 * 60,
  endMinute: 20 * 60,
}));

export const SCHEDULING_CONFIG_KEY = "scheduling_config";
export const DEFAULT_SCHEDULING_CONFIG = {
  timezone: "Asia/Jerusalem",
  windowMinutes: 30,
  gridMinutes: 10,
  sameDayCutoffMinutes: 90,
  searchDays: 7,
  fallbackSearchDays: 14,
  travelKmh: 30,
  roadFactor: 1.4,
  serviceBufferMin: 5,
  weights: {
    earliness: 5,
    routeContinuity: 3,
    dayDensity: 2,
    bufferHealth: 1,
    customerPreference: 2,
    urgencyEarlinessBoost: 2, // multiplies earliness for URGENT requests
  },
};

export async function seed(d: Db): Promise<void> {

  for (const item of CATALOG) {
    const existing = await d
      .select()
      .from(schema.serviceCatalogItems)
      .where(eq(schema.serviceCatalogItems.internalName, item.internalName));
    if (existing.length === 0) {
      await d.insert(schema.serviceCatalogItems).values({
        internalName: item.internalName,
        customerNameHe: item.customerNameHe,
        descriptionHe: item.descriptionHe,
        priceType: item.priceType,
        basePrice: item.basePrice ?? null,
        priceHigh: item.priceHigh ?? null,
        estDurationMin: item.estDurationMin,
        blockDurationMin: item.blockDurationMin,
        supportedCategories: item.supportedCategories,
        wheelSizeConstraints: item.wheelSizeConstraints ?? null,
        partIncludedTbd: item.partIncludedTbd ?? false,
        instantBookEligible: item.instantBookEligible,
        active: item.active,
      });
    }
  }

  for (const zone of ZONES) {
    const existing = await d
      .select()
      .from(schema.serviceZones)
      .where(eq(schema.serviceZones.nameHe, zone.nameHe));
    let zoneId: string;
    if (existing.length === 0) {
      const [row] = await d
        .insert(schema.serviceZones)
        .values({
          nameHe: zone.nameHe,
          cityMatch: zone.cityMatch,
          travelCharge: zone.travelCharge,
        })
        .returning();
      zoneId = row.id;
      await d
        .insert(schema.zoneWindows)
        .values(DEFAULT_WINDOWS.map((w) => ({ ...w, zoneId })));
    }
  }

  const techs = await d.select().from(schema.technicians);
  let techId: string;
  if (techs.length === 0) {
    const [ran] = await d
      .insert(schema.technicians)
      .values({
        name: "רן",
        startLat: "31.2518", // Be'er Sheva center — editable in settings
        startLng: "34.7913",
      })
      .returning();
    techId = ran.id;
    await d
      .insert(schema.technicianHours)
      .values(
        [0, 1, 2, 3, 4].map((day) => ({
          technicianId: techId,
          dayOfWeek: day,
          startMinute: 15 * 60,
          endMinute: 20 * 60 + 30,
        })),
      );
  } else {
    techId = techs[0].id;
  }

  const staffEmail = process.env.SEED_STAFF_EMAIL ?? "ran@rancho.local";
  const existingStaff = await d
    .select()
    .from(schema.staffUsers)
    .where(eq(schema.staffUsers.email, staffEmail));
  if (existingStaff.length === 0) {
    // Dev-only default credential; production seeding must set both env vars.
    const password = process.env.SEED_STAFF_PASSWORD ?? "rancho-dev";
    await d.insert(schema.staffUsers).values({
      email: staffEmail,
      name: "רן",
      passwordHash: hashPassword(password),
      role: "OWNER",
      technicianId: techId,
    });
  }

  const cfg = await d
    .select()
    .from(schema.appMeta)
    .where(eq(schema.appMeta.key, SCHEDULING_CONFIG_KEY));
  if (cfg.length === 0) {
    await d.insert(schema.appMeta).values({
      key: SCHEDULING_CONFIG_KEY,
      value: JSON.stringify(DEFAULT_SCHEDULING_CONFIG),
    });
  }
}

/* Invoked via `npm run db:seed` */
if (process.argv[1]?.endsWith("seed.ts")) {
  import("./client").then(async ({ createDb }) => {
    const { db, driver } = createDb();
    const { runMigrations } = await import("./migrate");
    await runMigrations(db, driver);
    await seed(db);
    console.log(`seeded (driver: ${driver})`);
    process.exit(0);
  });
}
