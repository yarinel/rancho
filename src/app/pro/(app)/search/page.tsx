import Link from "next/link";
import { ilike, or } from "drizzle-orm";
import { requireStaff } from "@/server/auth";
import { db } from "@/server/db";
import * as schema from "@/db/schema";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/** Household lookup — the returning-customer loop starts here (Scenario E). */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireStaff();
  const { q } = await searchParams;
  const d = await db();

  const results =
    q && q.trim().length >= 2
      ? await d
          .select()
          .from(schema.customers)
          .where(
            or(
              ilike(schema.customers.name, `%${q.trim()}%`),
              ilike(schema.customers.phone, `%${q.trim().replace(/^0/, "")}%`),
            ),
          )
          .limit(20)
      : [];

  return (
    <div className="p-4 flex flex-col gap-3">
      <h1 className="text-xl font-bold">חיפוש לקוח</h1>
      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="שם או טלפון"
          className="flex-1 min-h-12 rounded-(--radius-control) border border-border bg-surface px-4"
        />
        <button
          type="submit"
          className="min-h-12 px-5 rounded-(--radius-control) bg-brand text-on-brand font-medium"
        >
          חפש
        </button>
      </form>
      {q && results.length === 0 && (
        <Card><p className="text-ink-muted">לא נמצאו לקוחות עבור ״{q}״.</p></Card>
      )}
      {results.map((c) => (
        <Link key={c.id} href={`/pro/customers/${c.householdId}`}>
          <Card className="hover:border-brand flex justify-between">
            <span className="font-medium">{c.name}</span>
            <span dir="ltr" className="text-ink-muted">{c.phone.replace("+972", "0")}</span>
          </Card>
        </Link>
      ))}
    </div>
  );
}
