import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { requireStaff } from "@/server/auth";
import { db } from "@/server/db";
import * as schema from "@/db/schema";
import { Card } from "@/components/ui/card";
import { fmtDate, shekel } from "@/lib/format";
import { jobStatusView } from "@/lib/status-map";

export const dynamic = "force-dynamic";

export default async function HouseholdPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) notFound();
  const d = await db();

  const households = await d
    .select()
    .from(schema.households)
    .where(eq(schema.households.id, id));
  if (!households[0]) notFound();

  const [customers, riders, bikes, locations, jobs] = await Promise.all([
    d.select().from(schema.customers).where(eq(schema.customers.householdId, id)),
    d.select().from(schema.riders).where(eq(schema.riders.householdId, id)),
    d.select().from(schema.bicycles).where(eq(schema.bicycles.householdId, id)),
    d.select().from(schema.locations).where(eq(schema.locations.householdId, id)),
    d
      .select()
      .from(schema.serviceJobs)
      .where(eq(schema.serviceJobs.householdId, id))
      .orderBy(desc(schema.serviceJobs.createdAt)),
  ]);

  const riderBy = new Map(riders.map((r) => [r.id, r]));

  return (
    <div className="p-4 flex flex-col gap-3">
      <h1 className="text-xl font-bold">{households[0].label}</h1>

      <Card className="flex flex-col gap-1">
        <p className="font-bold text-sm">אנשי קשר</p>
        {customers.map((c) => (
          <p key={c.id} className="text-sm flex justify-between">
            <span>{c.name}</span>
            <a dir="ltr" className="underline" href={`tel:${c.phone.replace("+972", "0")}`}>
              {c.phone.replace("+972", "0")}
            </a>
          </p>
        ))}
      </Card>

      <p className="font-bold">האופניים של הבית</p>
      {bikes.map((b) => (
        <Link key={b.id} href={`/pro/bikes/${b.id}`}>
          <Card className="hover:border-brand flex justify-between text-sm">
            <span className="font-medium">
              {b.nickname ?? b.category}
              {b.riderId && riderBy.get(b.riderId) && ` · ${riderBy.get(b.riderId)!.displayName}`}
            </span>
            <span className="text-ink-muted">{b.brand ?? ""}</span>
          </Card>
        </Link>
      ))}

      <p className="font-bold">כתובות</p>
      {locations.map((l) => (
        <Card key={l.id} className="text-sm">
          {l.formattedAddress}
          {l.accessNotes && <span className="text-ink-muted"> · {l.accessNotes}</span>}
        </Card>
      ))}

      <p className="font-bold">היסטוריית ביקורים</p>
      {jobs.length === 0 && <Card><p className="text-sm text-ink-muted">אין עדיין ביקורים.</p></Card>}
      {jobs.map((j) => (
        <Link key={j.id} href={`/pro/jobs/${j.id}`}>
          <Card className="hover:border-brand flex justify-between text-sm">
            <span>
              {fmtDate(j.createdAt)} · {jobStatusView(j.status).title}
            </span>
            <span>{j.finalAmount != null ? shekel(j.finalAmount) : ""}</span>
          </Card>
        </Link>
      ))}
    </div>
  );
}
