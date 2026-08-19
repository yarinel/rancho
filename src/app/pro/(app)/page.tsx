import Link from "next/link";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { requireStaff } from "@/server/auth";
import { db } from "@/server/db";
import * as schema from "@/db/schema";
import { Card } from "@/components/ui/card";
import { fmtTime, shekel } from "@/lib/format";
import { TodayActions } from "@/components/pro/today-actions";

export const dynamic = "force-dynamic";

const RUNNING = [
  "ARRIVED",
  "INSPECTION",
  "AWAITING_APPROVAL",
  "IN_SERVICE",
  "FINAL_SAFETY_CHECK",
  "PAYMENT_PENDING",
];

export default async function ProTodayPage() {
  await requireStaff();
  const d = await db();

  const now = new Date();
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const appts = await d
    .select()
    .from(schema.appointments)
    .where(
      and(
        eq(schema.appointments.status, "ACTIVE"),
        gte(schema.appointments.blockEnd, dayStart),
        lt(schema.appointments.blockStart, dayEnd),
      ),
    );
  const jobIds = appts.map((a) => a.jobId);
  const jobs = jobIds.length
    ? await d.select().from(schema.serviceJobs).where(inArray(schema.serviceJobs.id, jobIds))
    : [];
  const activeJobs = jobs.filter(
    (j) => !["COMPLETED", "CANCELLED", "UNRESOLVED"].includes(j.status),
  );

  const [customers, bikes, locations, riders] = await Promise.all([
    activeJobs.length
      ? d.select().from(schema.customers).where(inArray(schema.customers.id, activeJobs.map((j) => j.customerId)))
      : [],
    activeJobs.length
      ? d.select().from(schema.bicycles).where(inArray(schema.bicycles.id, activeJobs.map((j) => j.bicycleId)))
      : [],
    activeJobs.length
      ? d.select().from(schema.locations).where(inArray(schema.locations.id, activeJobs.map((j) => j.locationId)))
      : [],
    d.select().from(schema.riders),
  ]);
  const by = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
  const customerBy = by(customers);
  const bikeBy = by(bikes);
  const locationBy = by(locations);
  const riderBy = by(riders);

  const ordered = activeJobs
    .map((job) => ({
      job,
      appt: appts.find((a) => a.jobId === job.id)!,
    }))
    .sort((a, b) => a.appt.blockStart.getTime() - b.appt.blockStart.getTime());

  // at-risk projection: a running job whose block already overran pushes later windows
  const runningOverrun = ordered.some(
    ({ job, appt }) => RUNNING.includes(job.status) && appt.blockEnd < now,
  );

  const CATEGORY_HE: Record<string, string> = {
    kids: "ילדים", bmx: "BMX", mtb: "הרים", cruiser: "קרוזר", city: "עיר", road: "כביש", other: "אחר",
  };
  const WHEEL_HE: Record<string, string> = {
    w12: '12"', w14: '14"', w16: '16"', w18: '18"', w20: '20"', w24: '24"', w26: '26"', w275: '27.5"', w29: '29"', unknown: "",
  };

  return (
    <div className="p-4 flex flex-col gap-3">
      <h1 className="text-xl font-bold">היום · {ordered.length} עבודות</h1>
      {ordered.length === 0 && (
        <Card><p className="text-ink-muted">אין עבודות מתוכננות להיום. 🚲</p></Card>
      )}
      {ordered.map(({ job, appt }, i) => {
        const customer = customerBy.get(job.customerId);
        const bike = bikeBy.get(job.bicycleId);
        const location = locationBy.get(job.locationId);
        const rider = bike?.riderId ? riderBy.get(bike.riderId) : null;
        const atRisk =
          runningOverrun && !RUNNING.includes(job.status) && appt.blockStart > now;
        return (
          <Card key={job.id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="font-bold text-lg" dir="ltr">
                {fmtTime(appt.windowStart)}–{fmtTime(appt.windowEnd)}
              </p>
              {atRisk && (
                <span className="text-xs bg-brand-soft text-safety-attention font-bold px-2 py-1 rounded-full">
                  צפי איחור
                </span>
              )}
              {i === 0 && !atRisk && (
                <span className="text-xs text-ink-muted">הבא בתור</span>
              )}
            </div>
            <p>
              {rider?.displayName ?? customer?.name}
              {bike && (
                <>
                  {" · "}
                  {bike.nickname ?? CATEGORY_HE[bike.category]} {WHEEL_HE[bike.wheelSize]}
                </>
              )}
            </p>
            <p className="text-sm text-ink-muted">{location?.formattedAddress}</p>
            <p className="text-sm">
              {job.reportedSymptoms === "puncture" ? "פנצ'ר" : job.reportedSymptoms}
              {job.expectedTotal != null && (
                <>
                  {" · צפי "}
                  <strong>
                    {job.expectedTotalHigh != null && job.expectedTotalHigh !== job.expectedTotal
                      ? `${job.expectedTotal / 100}–${job.expectedTotalHigh / 100} ₪`
                      : shekel(job.expectedTotal)}
                  </strong>
                </>
              )}
            </p>
            <TodayActions
              jobId={job.id}
              status={job.status}
              phone={customer?.phone ?? ""}
              address={location?.formattedAddress ?? ""}
              lat={location?.lat}
              lng={location?.lng}
            />
          </Card>
        );
      })}
      <Link href="/pro/requests" className="text-sm underline text-ink-muted">
        לבקשות שממתינות לבדיקה ←
      </Link>
    </div>
  );
}
