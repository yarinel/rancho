import { asc } from "drizzle-orm";
import { requireStaff } from "@/server/auth";
import { db } from "@/server/db";
import * as schema from "@/db/schema";
import { updateZoneAction } from "@/server/actions/settings";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ZonesSettingsPage() {
  await requireStaff();
  const d = await db();
  const zones = await d
    .select()
    .from(schema.serviceZones)
    .orderBy(asc(schema.serviceZones.createdAt));

  return (
    <div className="p-4 flex flex-col gap-3">
      <h1 className="text-xl font-bold">אזורי שירות</h1>
      <p className="text-sm text-safety-attention">
        תוספת הגעה ריקה = טרם נקבעה (TBD) — הלקוח יראה טווח מחיר עם ״נאשר סופית
        בתיאום״ עד שתוזן.
      </p>
      {zones.map((zone) => (
        <Card key={zone.id}>
          <form action={updateZoneAction} className="flex flex-col gap-2">
            <input type="hidden" name="id" value={zone.id} />
            <p className="font-bold">{zone.nameHe}</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
              <label className="flex flex-col gap-1">
                תוספת הגעה (₪)
                <input
                  name="travelChargeShekels"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={zone.travelCharge != null ? zone.travelCharge / 100 : ""}
                  placeholder="TBD"
                  className="min-h-10 rounded-(--radius-control) border border-border bg-bg px-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                מינימום הזמנה (₪)
                <input
                  name="minOrderShekels"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={zone.minOrder != null ? zone.minOrder / 100 : ""}
                  className="min-h-10 rounded-(--radius-control) border border-border bg-bg px-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                באפר נסיעה (דק&apos;)
                <input
                  name="travelBufferMin"
                  type="number"
                  min={0}
                  max={120}
                  defaultValue={zone.travelBufferMin}
                  className="min-h-10 rounded-(--radius-control) border border-border bg-bg px-2"
                />
              </label>
              <label className="flex items-center gap-2 self-end min-h-10">
                <input
                  type="checkbox"
                  name="instantBookEnabled"
                  defaultChecked={zone.instantBookEnabled}
                />
                הזמנה מיידית
              </label>
              <label className="flex items-center gap-2 self-end min-h-10">
                <input type="checkbox" name="active" defaultChecked={zone.active} />
                פעיל
              </label>
            </div>
            <button
              type="submit"
              className="self-start min-h-10 rounded-(--radius-control) bg-brand text-on-brand px-4 font-medium"
            >
              שמירה
            </button>
          </form>
        </Card>
      ))}
    </div>
  );
}
