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

/** The bike card (spec p16): next visit continues from history, never from zero. */
export default async function BikePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) notFound();
  const d = await db();

  const bikes = await d.select().from(schema.bicycles).where(eq(schema.bicycles.id, id));
  const bike = bikes[0];
  if (!bike) notFound();

  const [jobs, openFindings, rider, media] = await Promise.all([
    d
      .select()
      .from(schema.serviceJobs)
      .where(eq(schema.serviceJobs.bicycleId, id))
      .orderBy(desc(schema.serviceJobs.createdAt)),
    d.select().from(schema.findings).where(eq(schema.findings.bicycleId, id)),
    bike.riderId
      ? d.select().from(schema.riders).where(eq(schema.riders.id, bike.riderId))
      : Promise.resolve([]),
    d.select().from(schema.media).where(eq(schema.media.bicycleId, id)),
  ]);
  const unresolved = openFindings.filter((f) => !f.resolvedInJob && f.resolution !== "DECLINED");

  const CATEGORY_HE: Record<string, string> = {
    kids: "אופני ילדים", bmx: "BMX", mtb: "אופני הרים", cruiser: "קרוזר",
    city: "אופני עיר", road: "אופני כביש", other: "אחר",
  };

  return (
    <div className="p-4 flex flex-col gap-3">
      <h1 className="text-xl font-bold">
        {bike.nickname ?? CATEGORY_HE[bike.category]}
        {rider[0] && ` · ${rider[0].displayName}`}
      </h1>

      <Card className="text-sm flex flex-col gap-1">
        <p>
          {CATEGORY_HE[bike.category]}
          {bike.wheelSize !== "unknown" && ` · גלגל ${bike.wheelSize.replace("w", "").replace("275", "27.5")}"`}
          {bike.hasGears != null && (bike.hasGears ? " · עם הילוכים" : " · ללא הילוכים")}
        </p>
        {(bike.brand || bike.model) && (
          <p className="text-ink-muted">{[bike.brand, bike.model].filter(Boolean).join(" ")}</p>
        )}
        {bike.serial && <p className="text-ink-muted" dir="ltr">S/N {bike.serial}</p>}
      </Card>

      {media.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {media.slice(0, 6).map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={m.id}
              src={`/api/media/${m.id}`}
              alt="תמונת אופניים"
              className="h-24 w-24 object-cover rounded-(--radius-control) shrink-0"
            />
          ))}
        </div>
      )}

      {unresolved.length > 0 && (
        <Card className="border-safety-attention flex flex-col gap-1">
          <p className="font-bold text-safety-attention text-sm">המלצות פתוחות</p>
          {unresolved.map((f) => (
            <p key={f.id} className="text-sm">
              {f.titleHe}
              {f.proposedPrice != null && ` · ${shekel(f.proposedPrice)}`}
            </p>
          ))}
        </Card>
      )}

      <p className="font-bold">היסטוריית טיפולים</p>
      {jobs.length === 0 && <Card><p className="text-sm text-ink-muted">אין עדיין טיפולים.</p></Card>}
      {jobs.map((j) => (
        <Link key={j.id} href={`/pro/jobs/${j.id}`}>
          <Card className="hover:border-brand text-sm flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="font-medium">{fmtDate(j.createdAt)}</span>
              <span>{jobStatusView(j.status).title}</span>
            </div>
            {j.summaryHe && <p className="text-ink-muted">{j.summaryHe}</p>}
            <div className="flex justify-between text-ink-muted">
              <span>{j.maintenanceTipHe ? `טיפ: ${j.maintenanceTipHe}` : ""}</span>
              <span>{j.finalAmount != null ? shekel(j.finalAmount) : ""}</span>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
