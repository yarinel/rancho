import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { requireStaff } from "@/server/auth";
import { db } from "@/server/db";
import * as schema from "@/db/schema";
import { Card } from "@/components/ui/card";
import { ilDayRange } from "@/lib/format";

export const dynamic = "force-dynamic";

const WHEEL_HE: Record<string, string> = {
  w12: '12"', w14: '14"', w16: '16"', w18: '18"', w20: '20"',
  w24: '24"', w26: '26"', w275: '27.5"', w29: '29"', unknown: "מידה לא ידועה",
};

/**
 * Daily Loadout (P1): what to put in the Tiida for today + tomorrow, derived
 * from booked expected work — tubes/tires broken down by wheel size.
 */
export default async function LoadoutPage() {
  await requireStaff();
  const d = await db();
  const { start, end } = ilDayRange(new Date(), 2);

  const appts = await d
    .select()
    .from(schema.appointments)
    .where(
      and(
        eq(schema.appointments.status, "ACTIVE"),
        gte(schema.appointments.blockEnd, start),
        lt(schema.appointments.blockStart, end),
      ),
    );
  const jobIds = appts.map((a) => a.jobId);
  const jobs = jobIds.length
    ? await d
        .select()
        .from(schema.serviceJobs)
        .where(inArray(schema.serviceJobs.id, jobIds))
    : [];
  const upcoming = jobs.filter((j) => ["SCHEDULED", "EN_ROUTE"].includes(j.status));
  const upcomingIds = upcoming.map((j) => j.id);

  const [items, bikes] = await Promise.all([
    upcomingIds.length
      ? d
          .select()
          .from(schema.jobLineItems)
          .where(
            and(
              inArray(schema.jobLineItems.jobId, upcomingIds),
              eq(schema.jobLineItems.kind, "EXPECTED"),
            ),
          )
      : [],
    upcoming.length
      ? d
          .select()
          .from(schema.bicycles)
          .where(inArray(schema.bicycles.id, upcoming.map((j) => j.bicycleId)))
      : [],
  ]);
  const bikeByJob = new Map(
    upcoming.map((j) => [j.id, bikes.find((b) => b.id === j.bicycleId)]),
  );

  // aggregate: service label × wheel size (wheel size matters for tubes/tires)
  const counts = new Map<string, number>();
  for (const item of items) {
    const bike = bikeByJob.get(item.jobId);
    const sizeRelevant = /פנימית|צמיג/.test(item.label);
    const key = sizeRelevant
      ? `${item.label} · ${WHEEL_HE[bike?.wheelSize ?? "unknown"]}`
      : item.label;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="p-4 flex flex-col gap-3">
      <h1 className="text-xl font-bold">מה להעמיס · היום ומחר</h1>
      <p className="text-sm text-ink-muted">
        לפי העבודות שנקבעו ({upcoming.length} ביקורים). ממצאים בשטח תמיד יכולים
        להוסיף — זה הבסיס, לא התקרה.
      </p>
      {rows.length === 0 ? (
        <Card>
          <p className="text-ink-muted">אין עבודות קרובות — אין מה להעמיס מעבר לערכה הקבועה.</p>
        </Card>
      ) : (
        <Card className="flex flex-col gap-2">
          {rows.map(([label, count]) => (
            <p key={label} className="flex justify-between text-sm">
              <span>{label}</span>
              <span className="font-bold" dir="ltr">× {count}</span>
            </p>
          ))}
        </Card>
      )}
      <Card className="flex flex-col gap-1">
        <p className="font-bold text-sm">הערכה הקבועה (תזכורת)</p>
        <p className="text-sm text-ink-muted">
          שטיח עבודה, משאבה חשמלית, חומרי ניקוי, שמנים, ראצ&apos;טים, אלנים,
          Torx, כלי קראנק, חולצי צמיג, חותך כבלים, תאורה ניידת.
        </p>
      </Card>
    </div>
  );
}
