import type { Agorot } from "@/domain/types";
import { dateKeyOf, zonedDate } from "@/domain/scheduling/engine";

export function shekel(a: Agorot | null | undefined): string {
  if (a == null) return "—";
  const v = a / 100;
  return `${Number.isInteger(v) ? v : v.toFixed(2)} ₪`;
}

export function priceLabel(opts: {
  priceType: string;
  basePrice: Agorot | null;
  priceHigh: Agorot | null;
}): string {
  if (opts.priceType === "QUOTE" || opts.basePrice == null) {
    return "צריך לראות לפני שמתמחרים";
  }
  if (opts.priceType === "RANGE" && opts.priceHigh != null) {
    return `${opts.basePrice / 100}–${opts.priceHigh / 100} ₪`;
  }
  return shekel(opts.basePrice);
}

export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const TZ = "Asia/Jerusalem";

export function fmtTime(dt: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(dt);
}

export function fmtDate(dt: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    timeZone: TZ,
  }).format(dt);
}

export function fmtDateTime(dt: Date): string {
  return `${fmtDate(dt)} · ${fmtTime(dt)}`;
}

export const CATEGORY_HE: Record<string, string> = {
  kids: "אופני ילדים",
  bmx: "BMX",
  mtb: "אופני הרים",
  cruiser: "קרוזר",
  city: "אופני עיר",
  road: "אופני כביש",
  other: "אחר",
};

export const SYMPTOM_HE: Record<string, string> = {
  puncture: "פנצ'ר",
  brakes: "בלמים",
  gears: "הילוכים",
  chain_drops: "שרשרת נופלת",
  loose_or_noise: "רופף או מרעיש",
  tune_up: "טיפול",
  unknown: "לא ידוע",
};

export const categoryHe = (c: string) => CATEGORY_HE[c] ?? c;
export const symptomHe = (s: string) => SYMPTOM_HE[s] ?? s;

/** Day range in Asia/Jerusalem — server TZ (UTC in production) must not shift the operator's day. */
export function ilDayRange(now: Date, days = 1): { start: Date; end: Date } {
  const key = dateKeyOf(now, TZ);
  const start = zonedDate(key, 0, TZ);
  return { start, end: new Date(start.getTime() + days * 24 * 60 * 60 * 1000) };
}
