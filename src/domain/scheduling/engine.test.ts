import { describe, expect, it } from "vitest";
import {
  generateSlots,
  pickDisplaySlots,
  zonedDate,
  type EngineInput,
  type SchedulingConfig,
} from "./engine";

const CONFIG: SchedulingConfig = {
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
    urgencyEarlinessBoost: 2,
  },
};

const B7 = { lat: 31.2518, lng: 34.7913 }; // Be'er Sheva
const METAR = { lat: 31.3232, lng: 34.9324 }; // ~20km away

const DAY = "2026-09-01"; // Tuesday
const NOW = zonedDate(DAY, 8 * 60, CONFIG.timezone); // 08:00 local

function input(overrides: Partial<EngineInput> = {}): EngineInput {
  return {
    now: NOW,
    config: CONFIG,
    technicianStart: B7,
    days: [
      {
        dateKey: DAY,
        techWindows: [{ startMinute: 15 * 60, endMinute: 20 * 60 + 30 }],
        zoneWindows: [{ startMinute: 15 * 60, endMinute: 20 * 60 }],
        commitments: [],
      },
    ],
    request: {
      blockDurationMin: 40,
      point: B7,
      travelBufferMin: 10,
      urgency: "NORMAL",
      timePreference: "NONE",
    },
    ...overrides,
  };
}

const at = (min: number) => zonedDate(DAY, min, CONFIG.timezone);

describe("scheduling engine", () => {
  it("generates eligible slots inside zone∩tech windows on the grid", () => {
    const res = generateSlots(input());
    expect(res.slots.length).toBeGreaterThan(0);
    // whole block inside the zone window: last legal start 19:20 (ends 20:00)
    const starts = res.slots.map((s) => s.blockStart.getTime());
    expect(Math.max(...starts)).toBeLessThanOrEqual(at(19 * 60 + 20).getTime());
    expect(Math.min(...starts)).toBeGreaterThanOrEqual(at(15 * 60).getTime());
  });

  it("day boundary: a block straddling the zone-window end is INELIGIBLE", () => {
    const res = generateSlots(input());
    const straddling = res.rejected.filter(
      (r) =>
        r.reason === "OUTSIDE_ZONE_WINDOW" &&
        r.start.getTime() === at(19 * 60 + 30).getTime(),
    );
    expect(straddling.length).toBe(1);
    expect(
      res.slots.some((s) => s.blockStart.getTime() === at(19 * 60 + 30).getTime()),
    ).toBe(false);
  });

  it("Scenario F: calendar-free but travel-infeasible gap is INELIGIBLE, never ranked in", () => {
    // existing job in Metar ends 16:00; next job in Metar starts 17:20.
    // A 40-min candidate in Be'er Sheva at 16:00 requires ~40min travel each way
    // (2×~35–45min) — the gap is free on the calendar but physically impossible.
    const res = generateSlots(
      input({
        days: [
          {
            dateKey: DAY,
            techWindows: [{ startMinute: 15 * 60, endMinute: 20 * 60 + 30 }],
            zoneWindows: [{ startMinute: 15 * 60, endMinute: 20 * 60 }],
            commitments: [
              {
                blockStart: at(15 * 60),
                blockEnd: at(16 * 60),
                point: METAR,
                isHardBlock: false,
              },
              {
                blockStart: at(17 * 60 + 20),
                blockEnd: at(18 * 60),
                point: METAR,
                isHardBlock: false,
              },
            ],
          },
        ],
      }),
    );
    const inGap = res.slots.filter(
      (s) =>
        s.blockStart.getTime() >= at(16 * 60).getTime() &&
        s.blockEnd.getTime() <= at(17 * 60 + 20).getTime(),
    );
    expect(inGap).toEqual([]); // the whole gap is ineligible
    expect(
      res.rejected.some(
        (r) =>
          r.reason === "TRAVEL_INFEASIBLE_BEFORE" ||
          r.reason === "TRAVEL_INFEASIBLE_AFTER",
      ),
    ).toBe(true);
  });

  it("first job of the day: travel from the technician start location constrains the earliest slot", () => {
    // Request in Metar (~20km): ~1h travel with road factor+buffer ⇒ 15:00 start impossible
    const res = generateSlots(
      input({ request: { ...input().request, point: METAR } }),
    );
    expect(
      res.slots.some((s) => s.blockStart.getTime() === at(15 * 60).getTime()),
    ).toBe(false);
    expect(
      res.rejected.some(
        (r) =>
          r.reason === "TRAVEL_INFEASIBLE_BEFORE" &&
          r.start.getTime() === at(15 * 60).getTime(),
      ),
    ).toBe(true);
    // but later slots exist
    expect(res.slots.length).toBeGreaterThan(0);
  });

  it("manual blocks and zone-day closures remove overlapping slots", () => {
    const res = generateSlots(
      input({
        days: [
          {
            dateKey: DAY,
            techWindows: [{ startMinute: 15 * 60, endMinute: 20 * 60 + 30 }],
            zoneWindows: [{ startMinute: 15 * 60, endMinute: 20 * 60 }],
            commitments: [
              {
                blockStart: at(15 * 60),
                blockEnd: at(20 * 60),
                point: null,
                isHardBlock: true,
              },
            ],
          },
        ],
      }),
    );
    expect(res.slots).toEqual([]);
    expect(res.rejected.every((r) =>
      ["OVERLAPS_COMMITMENT", "SAME_DAY_CUTOFF", "OUTSIDE_ZONE_WINDOW"].includes(r.reason),
    )).toBe(true);
  });

  it("same-day cutoff rejects slots inside the lead window", () => {
    const lateNow = zonedDate(DAY, 14 * 60 + 30, CONFIG.timezone); // 14:30
    const res = generateSlots(input({ now: lateNow }));
    // 15:00 and 15:50 are within 90min cutoff; first eligible ≥ 16:00
    expect(
      res.slots.every((s) => s.blockStart.getTime() >= at(16 * 60).getTime()),
    ).toBe(true);
    expect(res.rejected.some((r) => r.reason === "SAME_DAY_CUTOFF")).toBe(true);
  });

  it("no availability ⇒ empty result (fallback handled by caller)", () => {
    const res = generateSlots(input({ days: [] }));
    expect(res.slots).toEqual([]);
  });

  it("ranking is deterministic and breaks score ties by earliest start", () => {
    const a = generateSlots(input());
    const b = generateSlots(input());
    expect(a.slots.map((s) => s.blockStart.getTime())).toEqual(
      b.slots.map((s) => s.blockStart.getTime()),
    );
    for (let i = 1; i < a.slots.length; i++) {
      const prev = a.slots[i - 1];
      const cur = a.slots[i];
      expect(prev.score).toBeGreaterThanOrEqual(cur.score);
      if (prev.score === cur.score) {
        expect(prev.blockStart.getTime()).toBeLessThan(cur.blockStart.getTime());
      }
    }
  });

  it("afternoon preference boosts late slots", () => {
    const dayKey = "2026-09-02";
    const mkInput = (pref: "MORNING" | "AFTERNOON") =>
      input({
        days: [
          {
            dateKey: dayKey,
            techWindows: [{ startMinute: 9 * 60, endMinute: 20 * 60 }],
            zoneWindows: [{ startMinute: 9 * 60, endMinute: 20 * 60 }],
            commitments: [],
          },
        ],
        request: { ...input().request, timePreference: pref },
      });
    const morning = generateSlots(mkInput("MORNING"));
    const afternoon = generateSlots(mkInput("AFTERNOON"));
    const hourOf = (d: Date) =>
      Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone: CONFIG.timezone,
          hour: "numeric",
          hour12: false,
        }).format(d),
      );
    expect(hourOf(morning.slots[0].blockStart)).toBeLessThan(14);
    expect(hourOf(afternoon.slots[0].blockStart)).toBeGreaterThanOrEqual(14);
  });

  it("display picker caps two slots per day", () => {
    const res = generateSlots(
      input({
        days: [0, 1, 2].map((i) => ({
          dateKey: `2026-09-0${i + 1}`,
          techWindows: [{ startMinute: 15 * 60, endMinute: 20 * 60 + 30 }],
          zoneWindows: [{ startMinute: 15 * 60, endMinute: 20 * 60 }],
          commitments: [],
        })),
      }),
    );
    const display = pickDisplaySlots(res.slots, 5);
    const byDay = new Map<string, number>();
    for (const s of display) byDay.set(s.dateKey, (byDay.get(s.dateKey) ?? 0) + 1);
    expect([...byDay.values()].every((c) => c <= 2)).toBe(true);
    expect(display.length).toBeGreaterThanOrEqual(3);
  });
});
