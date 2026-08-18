import Link from "next/link";
import { requireStaff } from "@/server/auth";
import { logoutAction } from "@/server/actions/auth";

const NAV = [
  { href: "/pro", label: "היום" },
  { href: "/pro/requests", label: "בקשות" },
  { href: "/pro/calendar", label: "יומן" },
  { href: "/pro/search", label: "חיפוש" },
  { href: "/pro/settings", label: "הגדרות" },
];

export default async function ProLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaff();

  return (
    <div className="surface-pro bg-bg text-ink min-h-dvh flex flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
        <Link href="/pro" className="font-display text-3xl leading-none text-brand">
          רנצ&apos;ו Pro
        </Link>
        <form action={logoutAction}>
          <button className="text-sm text-ink-muted min-h-10 px-2" type="submit">
            יציאה ({staff.name})
          </button>
        </form>
      </header>
      <main className="flex-1 pb-24">{children}</main>
      <nav
        aria-label="ניווט ראשי"
        className="fixed bottom-0 inset-x-0 bg-surface border-t border-border flex"
      >
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 min-h-14 flex items-center justify-center text-sm font-medium hover:text-brand"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
