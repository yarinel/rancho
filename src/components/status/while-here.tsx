"use client";

import { useState } from "react";
import { addWhileHereAction } from "@/server/actions/while-here";
import { Card } from "@/components/ui/card";

export function WhileHerePrompt({
  jobToken,
  bikes,
}: {
  jobToken: string;
  bikes: { id: string; labelHe: string; requested: boolean }[];
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Set<string>>(
    new Set(bikes.filter((b) => b.requested).map((b) => b.id)),
  );
  const [error, setError] = useState<string | null>(null);

  if (bikes.length === 0) return null;

  return (
    <Card className="flex flex-col gap-2">
      <p className="font-bold">אנחנו כבר מגיעים אליכם</p>
      <p className="text-sm text-ink-muted">
        רוצים שרן יעיף מבט גם על אופניים נוספים באותו ביקור? בלי התחייבות — אם
        יימצא משהו, נציע ונתמחר לפני שנעבוד.
      </p>
      {error && <p className="text-safety-unsafe text-sm">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {bikes.map((bike) =>
          done.has(bike.id) ? (
            <span
              key={bike.id}
              className="min-h-11 px-4 rounded-full border border-safety-ok text-safety-ok text-sm font-medium inline-flex items-center"
            >
              {bike.labelHe} — סגור, נציץ
            </span>
          ) : (
            <button
              key={bike.id}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  const res = await addWhileHereAction(jobToken, bike.id);
                  if (res.ok) setDone(new Set([...done, bike.id]));
                  else setError(res.error ?? "משהו השתבש");
                } catch {
                  setError("בעיית תקשורת — נסו שוב");
                } finally {
                  setBusy(false);
                }
              }}
              className="min-h-11 px-4 rounded-full border border-brand text-brand-strong text-sm font-medium disabled:opacity-40"
            >
              גם על {bike.labelHe}
            </button>
          ),
        )}
      </div>
    </Card>
  );
}
