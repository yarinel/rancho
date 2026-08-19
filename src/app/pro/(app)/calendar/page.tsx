import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { requireStaff } from "@/server/auth";
import { db } from "@/server/db";
import * as schema from "@/db/schema";
import { CalendarDay, CalendarToolbar } from "@/components/pro/calendar-ui";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  await requireStaff();
  const d = await db();

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [appts, blocks, zones] = await Promise.all([
    d
      .select()
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.status, "ACTIVE"),
          gte(schema.appointments.blockEnd, start),
          lt(schema.appointments.blockStart, end),
        ),
      ),
    d
      .select()
      .from(schema.calendarBlocks)
      .where(
        and(
          gte(schema.calendarBlocks.endsAt, start),
          lt(schema.calendarBlocks.startsAt, end),
        ),
      ),
    d.select().from(schema.serviceZones),
  ]);

  const jobIds = appts.map((a) => a.jobId);
  const jobs = jobIds.length
    ? await d.select().from(schema.serviceJobs).where(inArray(schema.serviceJobs.id, jobIds))
    : [];
  const customers = jobs.length
    ? await d
        .select()
        .from(schema.customers)
        .where(inArray(schema.customers.id, jobs.map((j) => j.customerId)))
    : [];
  const jobBy = new Map(jobs.map((j) => [j.id, j]));
  const custBy = new Map(customers.map((c) => [c.id, c]));
  const zoneBy = new Map(zones.map((z) => [z.id, z]));

  const days: {
    dateKey: string;
    label: string;
    items: {
      kind: "job" | "block";
      id: string;
      jobId?: string;
      startISO: string;
      endISO: string;
      title: string;
      sub?: string;
      status?: string;
    }[];
  }[] = [];

  const fmtDay = new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    timeZone: "Asia/Jerusalem",
  });
  const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" });

  for (let i = 0; i < 7; i++) {
    const day = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const dayEnd = new Date(day.getTime() + 24 * 60 * 60 * 1000);
    const dateKey = keyFmt.format(day);

    const dayAppts = appts
      .filter((a) => a.blockStart < dayEnd && a.blockEnd > day)
      .map((a) => {
        const job = jobBy.get(a.jobId);
        const cust = job ? custBy.get(job.customerId) : null;
        return {
          kind: "job" as const,
          id: a.id,
          jobId: a.jobId,
          startISO: a.blockStart.toISOString(),
          endISO: a.blockEnd.toISOString(),
          title: cust?.name ?? "עבודה",
          sub: job?.reportedSymptoms,
          status: job?.status,
        };
      });
    const dayBlocks = blocks
      .filter((b) => b.startsAt < dayEnd && b.endsAt > day)
      .map((b) => ({
        kind: "block" as const,
        id: b.id,
        startISO: b.startsAt.toISOString(),
        endISO: b.endsAt.toISOString(),
        title: b.zoneId
          ? `אזור סגור: ${zoneBy.get(b.zoneId)?.nameHe ?? ""}`
          : "חסימה",
        sub: b.reason ?? undefined,
      }));

    days.push({
      dateKey,
      label: fmtDay.format(day),
      items: [...dayAppts, ...dayBlocks].sort(
        (a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime(),
      ),
    });
  }

  return (
    <div className="p-4 flex flex-col gap-4">
      <h1 className="text-xl font-bold">יומן · שבוע קדימה</h1>
      <CalendarToolbar zones={zones.map((z) => ({ id: z.id, nameHe: z.nameHe }))} />
      {days.map((day) => (
        <CalendarDay key={day.dateKey} day={day} />
      ))}
    </div>
  );
}
