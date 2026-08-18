import Link from "next/link";
import { requireStaff } from "@/server/auth";
import { Card } from "@/components/ui/card";

const SECTIONS = [
  { href: "/pro/settings/services", title: "שירותים ומחירים", desc: "מחירון, זמני עבודה, זמינות להזמנה מיידית" },
  { href: "/pro/settings/zones", title: "אזורי שירות", desc: "תוספת הגעה, חלונות פעילות, הפעלה וכיבוי" },
  { href: "/pro/settings/availability", title: "זמינות ונקודת התחלה", desc: "שעות עבודה ומיקום יציאה לחישוב מסלול" },
];

export default async function SettingsPage() {
  await requireStaff();
  return (
    <div className="p-4 flex flex-col gap-3">
      <h1 className="text-xl font-bold">הגדרות</h1>
      {SECTIONS.map((s) => (
        <Link key={s.href} href={s.href}>
          <Card className="hover:border-brand">
            <p className="font-bold">{s.title}</p>
            <p className="text-sm text-ink-muted">{s.desc}</p>
          </Card>
        </Link>
      ))}
    </div>
  );
}
