import { and, eq, gte, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  dateKeyOf,
  generateSlots,
  localDow,
  pickDisplaySlots,
  zonedDate,
  type DayPlan,
  type EngineResult,
  type RankedSlot,
  type SchedulingConfig,
} from "@/domain/scheduling/engine";
import {
  DEFAULT_SCHEDULING_CONFIG,
  SCHEDULING_CONFIG_KEY,
} from "@/db/seed";

/** Load engine config from app_meta (admin-editable), falling back to defaults. */
export async function loadSchedulingConfig(d: Db): Promise<SchedulingConfig> {
  const rows = await d
    .select()
    .from(schema.appMeta)
    .where(eq(schema.appMeta.key, SCHEDULING_CONFIG_KEY));
  if (rows.length === 0) return DEFAULT_SCHEDULING_CONFIG;
  try {
    return {
      ...DEFAULT_SCHEDULING_CONFIG,
      ...(JSON.parse(rows[0].value) as Partial<SchedulingConfig>),
    };
  } catch {
    return DEFAULT_SCHEDULING_CONFIG;
  }
}

export interface RequestForScheduling {
  id: string;
  zoneId: string;
  lat: number;
  lng: number;
  blockDurationMin: number;
  urgency: "NORMAL" | "URGENT";
  timePreference: "MORNING" | "AFTERNOON" | "NONE";
}

/**
 * Build per-day calendar truth (ACTIVE appointments + manual blocks + zone-day
 * closures) and run the engine. Same-day generation consumes projected end
 * times: a running job's block extends to max(planned end, now + remaining).
 */
export async function computeSlots(
  d: Db,
  req: RequestForScheduling,
  opts: { days?: number; now?: Date } = {},
): Promise<EngineResult & { display: RankedSlot[] }> {
  const config = await loadSchedulingConfig(d);
  const now = opts.now ?? new Date();
  const searchDays = opts.days ?? config.searchDays;

  const techs = await d
    .select()
    .from(schema.technicians)
    .where(eq(schema.technicians.active, true));
  const tech = techs[0];
  if (!tech) return { slots: [], rejected: [], display: [] };

  const zone = (
    await d
      .select()
      .from(schema.serviceZones)
      .where(eq(schema.serviceZones.id, req.zoneId))
  )[0];
  if (!zone || !zone.active) return { slots: [], rejected: [], display: [] };

  const zoneWindows = await d
    .select()
    .from(schema.zoneWindows)
    .where(eq(schema.zoneWindows.zoneId, zone.id));
  const techHours = await d
    .select()
    .from(schema.technicianHours)
    .where(eq(schema.technicianHours.technicianId, tech.id));

  const horizonStart = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const appts = await d
    .select({
      blockStart: schema.appointments.blockStart,
      blockEnd: schema.appointments.blockEnd,
      jobId: schema.appointments.jobId,
    })
    .from(schema.appointments)
    .where(
      and(
        eq(schema.appointments.technicianId, tech.id),
        eq(schema.appointments.status, "ACTIVE"),
        gte(schema.appointments.blockEnd, horizonStart),
      ),
    );
  const jobIds = appts.map((a) => a.jobId);
  const jobs = jobIds.length
    ? await d
        .select({
          id: schema.serviceJobs.id,
          locationId: schema.serviceJobs.locationId,
          status: schema.serviceJobs.status,
          workStartedAt: schema.serviceJobs.workStartedAt,
          arrivedAt: schema.serviceJobs.arrivedAt,
        })
        .from(schema.serviceJobs)
        .where(inArray(schema.serviceJobs.id, jobIds))
    : [];
  const locIds = jobs.map((j) => j.locationId);
  const locs = locIds.length
    ? await d
        .select()
        .from(schema.locations)
        .where(inArray(schema.locations.id, locIds))
    : [];
  const locById = new Map(locs.map((l) => [l.id, l]));
  const jobById = new Map(jobs.map((j) => [j.id, j]));

  const blocks = await d
    .select()
    .from(schema.calendarBlocks)
    .where(
      and(
        eq(schema.calendarBlocks.technicianId, tech.id),
        gte(schema.calendarBlocks.endsAt, horizonStart),
      ),
    );

  const days: DayPlan[] = [];
  for (let i = 0; i < searchDays; i++) {
    const dayDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    const dateKey = dateKeyOf(dayDate, config.timezone);
    const dow = localDow(dateKey, config.timezone);

    const techWindows = techHours
      .filter((h) => h.dayOfWeek === dow)
      .map((h) => ({ startMinute: h.startMinute, endMinute: h.endMinute }));
    const zWindows = zoneWindows
      .filter((w) => w.dayOfWeek === dow)
      .map((w) => ({ startMinute: w.startMinute, endMinute: w.endMinute }));
    if (techWindows.length === 0 || zWindows.length === 0) continue;

    const dayStart = zonedDate(dateKey, 0, config.timezone);
    const dayEnd = zonedDate(dateKey, 24 * 60, config.timezone);

    const commitments = [
      ...appts
        .filter((a) => a.blockStart < dayEnd && a.blockEnd > dayStart)
        .map((a) => {
          const job = jobById.get(a.jobId);
          const loc = job ? locById.get(job.locationId) : null;
          // projected end for a running job: never earlier than "now"
          const running =
            job &&
            ["ARRIVED", "INSPECTION", "AWAITING_APPROVAL", "IN_SERVICE", "FINAL_SAFETY_CHECK", "PAYMENT_PENDING"].includes(
              job.status,
            );
          const blockEnd =
            running && a.blockEnd < now ? now : a.blockEnd;
          return {
            blockStart: a.blockStart,
            blockEnd,
            point:
              loc?.lat && loc?.lng
                ? { lat: Number(loc.lat), lng: Number(loc.lng) }
                : null,
            isHardBlock: false,
          };
        }),
      ...blocks
        .filter(
          (b) =>
            b.startsAt < dayEnd &&
            b.endsAt > dayStart &&
            (!b.zoneId || b.zoneId === zone.id),
        )
        .map((b) => ({
          blockStart: b.startsAt,
          blockEnd: b.endsAt,
          point: null,
          isHardBlock: true,
        })),
    ];

    days.push({ dateKey, techWindows, zoneWindows: zWindows, commitments });
  }

  const result = generateSlots({
    now,
    config,
    technicianStart: { lat: Number(tech.startLat), lng: Number(tech.startLng) },
    days,
    request: {
      blockDurationMin: req.blockDurationMin,
      point: { lat: req.lat, lng: req.lng },
      travelBufferMin: zone.travelBufferMin,
      urgency: req.urgency,
      timePreference: req.timePreference,
    },
  });

  return { ...result, display: pickDisplaySlots(result.slots, 5) };
}

/** Commit-time revalidation: the chosen start must still be eligible NOW. */
export async function isSlotStillEligible(
  d: Db,
  req: RequestForScheduling,
  plannedStart: Date,
): Promise<boolean> {
  const config = await loadSchedulingConfig(d);
  const res = await computeSlots(d, req, { days: config.fallbackSearchDays });
  return res.slots.some(
    (s) => s.plannedStart.getTime() === plannedStart.getTime(),
  );
}
