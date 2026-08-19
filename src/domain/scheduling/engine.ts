/**
 * Scheduling engine P0 (docs/SCHEDULING.md).
 * Pure module: receives prepared calendar truth, returns eligible ranked slots.
 * Stage 1 (hard constraints) is strictly separated from Stage 2 (ranking) —
 * a failed constraint yields a machine-readable reason and can never be
 * compensated by score.
 */

export interface SchedulingWeights {
  earliness: number;
  routeContinuity: number;
  dayDensity: number;
  bufferHealth: number;
  customerPreference: number;
  urgencyEarlinessBoost: number;
}

export interface SchedulingConfig {
  timezone: string;
  windowMinutes: number;
  gridMinutes: number;
  sameDayCutoffMinutes: number;
  searchDays: number;
  fallbackSearchDays: number;
  travelKmh: number;
  roadFactor: number;
  serviceBufferMin: number;
  weights: SchedulingWeights;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Commitment {
  blockStart: Date;
  blockEnd: Date;
  point: GeoPoint | null; // null for calendar blocks without location
  isHardBlock: boolean; // manual block / zone-day closure
}

export interface DayPlan {
  /** local date key YYYY-MM-DD in the scheduling timezone */
  dateKey: string;
  /** minutes-from-midnight windows, already intersected upstream is NOT assumed */
  techWindows: Array<{ startMinute: number; endMinute: number }>;
  zoneWindows: Array<{ startMinute: number; endMinute: number }>;
  commitments: Commitment[];
}

export interface SlotRequest {
  blockDurationMin: number;
  point: GeoPoint;
  travelBufferMin: number;
  urgency: "NORMAL" | "URGENT";
  timePreference: "MORNING" | "AFTERNOON" | "NONE";
}

export type IneligibilityReason =
  | "OUTSIDE_TECH_HOURS"
  | "OUTSIDE_ZONE_WINDOW"
  | "OVERLAPS_COMMITMENT"
  | "TRAVEL_INFEASIBLE_BEFORE"
  | "TRAVEL_INFEASIBLE_AFTER"
  | "SAME_DAY_CUTOFF";

export interface RankedSlot {
  plannedStart: Date;
  blockStart: Date;
  blockEnd: Date;
  windowStart: Date;
  windowEnd: Date;
  score: number;
  travelInMin: number;
  dateKey: string;
}

export interface EngineInput {
  now: Date;
  config: SchedulingConfig;
  technicianStart: GeoPoint;
  days: DayPlan[];
  request: SlotRequest;
}

export interface EngineResult {
  slots: RankedSlot[];
  rejected: Array<{ start: Date; reason: IneligibilityReason }>;
}

/* ------------------------------ time helpers ------------------------------- */

function tzOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(date).map((p) => [p.type, p.value]),
  );
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUTC - date.getTime();
}

/** Date for local (tz) dateKey + minutes-from-midnight, DST-safe enough for IL. */
export function zonedDate(dateKey: string, minutes: number, tz: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  let ts = Date.UTC(y, m - 1, d, 0, minutes);
  ts = Date.UTC(y, m - 1, d, 0, minutes) - tzOffsetMs(new Date(ts), tz);
  return new Date(ts);
}

export function dateKeyOf(date: Date, tz: string): string {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return dtf.format(date);
}

export function localDow(dateKey: string, tz: string): number {
  const noon = zonedDate(dateKey, 12 * 60, tz);
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(noon);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

/* ----------------------------- travel estimate ----------------------------- */

function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** TravelEstimator (adapter point — a routing provider replaces this in P1). */
export function travelMinutes(
  from: GeoPoint | null,
  to: GeoPoint | null,
  cfg: SchedulingConfig,
  zoneBufferMin: number,
): number {
  if (!from || !to) return zoneBufferMin;
  const km = haversineKm(from, to) * cfg.roadFactor;
  return Math.ceil((km / cfg.travelKmh) * 60) + zoneBufferMin;
}

/* --------------------------------- engine ---------------------------------- */

export function generateSlots(input: EngineInput): EngineResult {
  const { now, config, technicianStart, days, request } = input;
  const slots: RankedSlot[] = [];
  const rejected: EngineResult["rejected"] = [];

  const horizonMs =
    Math.max(1, config.searchDays) * 24 * 60 * 60 * 1000;

  for (const day of days) {
    const sorted = [...day.commitments].sort(
      (a, b) => a.blockStart.getTime() - b.blockStart.getTime(),
    );

    for (const tech of day.techWindows) {
      for (
        let minute = tech.startMinute;
        minute + request.blockDurationMin <= tech.endMinute;
        minute += config.gridMinutes
      ) {
        const blockStart = zonedDate(day.dateKey, minute, config.timezone);
        const blockEnd = new Date(
          blockStart.getTime() + request.blockDurationMin * 60 * 1000,
        );

        // Stage 1 — hard constraints, in order, machine-readable reasons

        // same-day cutoff
        if (
          blockStart.getTime() <
          now.getTime() + config.sameDayCutoffMinutes * 60 * 1000
        ) {
          rejected.push({ start: blockStart, reason: "SAME_DAY_CUTOFF" });
          continue;
        }

        // whole block inside a zone window (start AND end)
        const inZone = day.zoneWindows.some(
          (z) =>
            minute >= z.startMinute &&
            minute + request.blockDurationMin <= z.endMinute,
        );
        if (!inZone) {
          rejected.push({ start: blockStart, reason: "OUTSIDE_ZONE_WINDOW" });
          continue;
        }

        // no overlap with any commitment (appointments + manual blocks)
        const overlapping = sorted.some(
          (c) => c.blockStart < blockEnd && blockStart < c.blockEnd,
        );
        if (overlapping) {
          rejected.push({ start: blockStart, reason: "OVERLAPS_COMMITMENT" });
          continue;
        }

        // travel feasibility incl. day edges
        const prev = [...sorted]
          .filter((c) => c.blockEnd <= blockStart && !c.isHardBlock)
          .pop();
        const next = sorted.find(
          (c) => c.blockStart >= blockEnd && !c.isHardBlock,
        );

        const dayStart = zonedDate(day.dateKey, tech.startMinute, config.timezone);
        const inTravel = prev
          ? travelMinutes(prev.point, request.point, config, request.travelBufferMin)
          : travelMinutes(technicianStart, request.point, config, request.travelBufferMin);
        const earliestArrival = prev
          ? new Date(prev.blockEnd.getTime() + inTravel * 60 * 1000)
          : new Date(dayStart.getTime() + inTravel * 60 * 1000);
        if (earliestArrival > blockStart) {
          rejected.push({
            start: blockStart,
            reason: "TRAVEL_INFEASIBLE_BEFORE",
          });
          continue;
        }

        if (next) {
          const outTravel = travelMinutes(
            request.point,
            next.point,
            config,
            request.travelBufferMin,
          );
          if (
            blockEnd.getTime() + outTravel * 60 * 1000 >
            next.blockStart.getTime()
          ) {
            rejected.push({
              start: blockStart,
              reason: "TRAVEL_INFEASIBLE_AFTER",
            });
            continue;
          }
        }

        // Stage 2 — deterministic ranking (eligible only)
        const w = config.weights;
        const earlinessNorm =
          1 -
          Math.min(1, (blockStart.getTime() - now.getTime()) / horizonMs);
        const urgencyFactor =
          request.urgency === "URGENT" ? w.urgencyEarlinessBoost : 1;

        const jobsThatDay = sorted.filter((c) => !c.isHardBlock).length;
        const density = Math.min(1, jobsThatDay / 4);

        const routePenalty = Math.min(1, inTravel / 60);

        const slackBefore =
          (blockStart.getTime() - earliestArrival.getTime()) / 60000;
        const bufferHealth = Math.min(1, slackBefore / 30);

        const hour = minute / 60;
        const prefMatch =
          request.timePreference === "NONE"
            ? 0.5
            : request.timePreference === "MORNING"
              ? hour < 14
                ? 1
                : 0
              : hour >= 14
                ? 1
                : 0;

        const score =
          w.earliness * urgencyFactor * earlinessNorm +
          w.routeContinuity * (1 - routePenalty) +
          w.dayDensity * density +
          w.bufferHealth * bufferHealth +
          w.customerPreference * prefMatch;

        const windowStart = blockStart;
        const windowEnd = new Date(
          blockStart.getTime() + config.windowMinutes * 60 * 1000,
        );

        slots.push({
          plannedStart: blockStart,
          blockStart,
          blockEnd,
          windowStart,
          windowEnd,
          score,
          travelInMin: inTravel,
          dateKey: day.dateKey,
        });
      }
    }
  }

  // stable, deterministic: score desc, then earliest start
  slots.sort(
    (a, b) =>
      b.score - a.score || a.blockStart.getTime() - b.blockStart.getTime(),
  );

  return { slots, rejected };
}

/** Diverse top-N for display: at most two per day, keep ranking order. */
export function pickDisplaySlots(slots: RankedSlot[], n = 5): RankedSlot[] {
  const byDay = new Map<string, number>();
  const out: RankedSlot[] = [];
  for (const s of slots) {
    const c = byDay.get(s.dateKey) ?? 0;
    if (c >= 2) continue;
    byDay.set(s.dateKey, c + 1);
    out.push(s);
    if (out.length >= n) break;
  }
  return out;
}
