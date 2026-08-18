import { asc } from "drizzle-orm";
import { requireStaff } from "@/server/auth";
import { db } from "@/server/db";
import * as schema from "@/db/schema";
import { updateAvailabilityAction } from "@/server/actions/settings";
import { Card } from "@/components/ui/card";
import { minutesToTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export default async function AvailabilitySettingsPage() {
  await requireStaff();
  const d = await db();
  const techs = await d.select().from(schema.technicians);
  const tech = techs[0];
  const hours = await d
    .select()
    .from(schema.technicianHours)
    .orderBy(asc(schema.technicianHours.dayOfWeek));
  const byDay = new Map(hours.map((h) => [h.dayOfWeek, h]));

  return (
    <div className="p-4 flex flex-col gap-3">
      <h1 className="text-xl font-bold">זמינות ונקודת התחלה</h1>
      <Card>
        <form action={updateAvailabilityAction} className="flex flex-col gap-3">
          <input type="hidden" name="technicianId" value={tech.id} />
          <div className="grid grid-cols-2 gap-2 text-sm">
            <label className="flex flex-col gap-1">
              נקודת יציאה — קו רוחב
              <input
                name="startLat"
                dir="ltr"
                defaultValue={tech.startLat}
                className="min-h-10 rounded-(--radius-control) border border-border bg-bg px-2 text-left"
              />
            </label>
            <label className="flex flex-col gap-1">
              נקודת יציאה — קו אורך
              <input
                name="startLng"
                dir="ltr"
                defaultValue={tech.startLng}
                className="min-h-10 rounded-(--radius-control) border border-border bg-bg px-2 text-left"
              />
            </label>
          </div>
          <p className="text-xs text-ink-muted">
            נקודת היציאה משמשת את מנוע השיבוץ לחישוב נסיעה לעבודה הראשונה ביום.
          </p>
          <div className="flex flex-col gap-2">
            {DAY_NAMES.map((name, day) => {
              const h = byDay.get(day);
              return (
                <div key={day} className="flex items-center gap-3 text-sm">
                  <label className="flex items-center gap-2 w-24">
                    <input type="checkbox" name={`enabled_${day}`} defaultChecked={!!h} />
                    {name}
                  </label>
                  <input
                    type="time"
                    name={`start_${day}`}
                    dir="ltr"
                    defaultValue={h ? minutesToTime(h.startMinute) : "15:00"}
                    className="min-h-10 rounded-(--radius-control) border border-border bg-bg px-2"
                    aria-label={`שעת התחלה ${name}`}
                  />
                  <span>עד</span>
                  <input
                    type="time"
                    name={`end_${day}`}
                    dir="ltr"
                    defaultValue={h ? minutesToTime(h.endMinute) : "20:30"}
                    className="min-h-10 rounded-(--radius-control) border border-border bg-bg px-2"
                    aria-label={`שעת סיום ${name}`}
                  />
                </div>
              );
            })}
          </div>
          <button
            type="submit"
            className="self-start min-h-10 rounded-(--radius-control) bg-brand text-on-brand px-4 font-medium"
          >
            שמירה
          </button>
        </form>
      </Card>
    </div>
  );
}
