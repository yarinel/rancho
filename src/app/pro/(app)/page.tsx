import { requireStaff } from "@/server/auth";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/** Today view — fully built in M7; shell exists from M2. */
export default async function ProTodayPage() {
  const staff = await requireStaff();
  return (
    <div className="p-4 flex flex-col gap-3">
      <h1 className="text-xl font-bold">היום</h1>
      <Card>
        <p className="text-ink-muted">
          שלום {staff.name} — רשימת העבודות של היום תופיע כאן.
        </p>
      </Card>
    </div>
  );
}
