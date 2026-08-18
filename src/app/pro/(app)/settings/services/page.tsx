import { asc } from "drizzle-orm";
import { requireStaff } from "@/server/auth";
import { db } from "@/server/db";
import * as schema from "@/db/schema";
import { updateServiceAction } from "@/server/actions/settings";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ServicesSettingsPage() {
  await requireStaff();
  const d = await db();
  const items = await d
    .select()
    .from(schema.serviceCatalogItems)
    .orderBy(asc(schema.serviceCatalogItems.createdAt));

  return (
    <div className="p-4 flex flex-col gap-3">
      <h1 className="text-xl font-bold">שירותים ומחירים</h1>
      <p className="text-sm text-ink-muted">
        המחירים כאן הם מקור האמת — שינוי נשמר מיידית ונרשם ביומן הפעולות.
      </p>
      {items.map((item) => (
        <Card key={item.id}>
          <form action={updateServiceAction} className="flex flex-col gap-2">
            <input type="hidden" name="id" value={item.id} />
            <div className="flex items-center justify-between gap-2">
              <input
                name="customerNameHe"
                defaultValue={item.customerNameHe}
                className="font-bold bg-transparent border-b border-transparent focus:border-border flex-1 min-h-10"
                aria-label="שם ללקוח"
              />
              <span className="text-xs text-ink-muted">{item.internalName}</span>
            </div>
            {item.descriptionHe?.includes("TBD") && (
              <p className="text-xs text-safety-attention">{item.descriptionHe}</p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <label className="flex flex-col gap-1">
                סוג מחיר
                <select
                  name="priceType"
                  defaultValue={item.priceType}
                  className="min-h-10 rounded-(--radius-control) border border-border bg-bg px-2"
                >
                  <option value="FIXED">קבוע</option>
                  <option value="RANGE">טווח</option>
                  <option value="QUOTE">הצעת מחיר</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                מחיר (₪)
                <input
                  name="basePriceShekels"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={item.basePrice != null ? item.basePrice / 100 : ""}
                  className="min-h-10 rounded-(--radius-control) border border-border bg-bg px-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                עד (₪, לטווח)
                <input
                  name="priceHighShekels"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={item.priceHigh != null ? item.priceHigh / 100 : ""}
                  className="min-h-10 rounded-(--radius-control) border border-border bg-bg px-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                משך עבודה (דק&apos;)
                <input
                  name="estDurationMin"
                  type="number"
                  min={5}
                  max={240}
                  defaultValue={item.estDurationMin}
                  className="min-h-10 rounded-(--radius-control) border border-border bg-bg px-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                חסימת יומן (דק&apos;)
                <input
                  name="blockDurationMin"
                  type="number"
                  min={5}
                  max={300}
                  defaultValue={item.blockDurationMin}
                  className="min-h-10 rounded-(--radius-control) border border-border bg-bg px-2"
                />
              </label>
              <label className="flex items-center gap-2 self-end min-h-10">
                <input
                  type="checkbox"
                  name="instantBookEligible"
                  defaultChecked={item.instantBookEligible}
                />
                הזמנה מיידית
              </label>
              <label className="flex items-center gap-2 self-end min-h-10">
                <input type="checkbox" name="active" defaultChecked={item.active} />
                פעיל
              </label>
              <button
                type="submit"
                className="self-end min-h-10 rounded-(--radius-control) bg-brand text-on-brand px-4 font-medium"
              >
                שמירה
              </button>
            </div>
          </form>
        </Card>
      ))}
    </div>
  );
}
