"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  bookSlotAction,
  noSlotFallbackAction,
  rescheduleSlotAction,
} from "@/server/actions/schedule";
import { Card } from "@/components/ui/card";

export interface SlotView {
  plannedStartISO: string;
  windowStartISO: string;
  windowEndISO: string;
  dateKey: string;
}

const TZ = "Asia/Jerusalem";

function dayLabel(dateKey: string): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(
    new Date(Date.now() + 24 * 60 * 60 * 1000),
  );
  if (dateKey === today) return "היום";
  if (dateKey === tomorrow) return "מחר";
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    timeZone: TZ,
  }).format(new Date(`${dateKey}T12:00:00`));
}

function timeRange(s: SlotView): string {
  const fmt = new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
  return `${fmt.format(new Date(s.windowStartISO))}–${fmt.format(new Date(s.windowEndISO))}`;
}

export function SlotPicker({
  requestToken,
  display,
  all,
  mode = "book",
}: {
  requestToken: string; // request token (book) or job token (reschedule)
  display: SlotView[];
  all: SlotView[];
  mode?: "book" | "reschedule";
}) {
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(slot: SlotView) {
    setBusy(slot.plannedStartISO);
    setError(null);
    try {
      const res =
        mode === "reschedule"
          ? await rescheduleSlotAction(requestToken, slot.plannedStartISO)
          : await bookSlotAction(requestToken, slot.plannedStartISO);
      if (res.ok && res.jobToken) {
        router.push(`/s/${res.jobToken}${mode === "book" ? "?new=1" : ""}`);
      } else if (res.stale) {
        setStale(true);
        router.refresh(); // fresh alternatives
      } else {
        setError(res.error ?? "משהו השתבש");
      }
    } catch {
      setError("בעיית תקשורת — נסו שוב");
    } finally {
      setBusy(null);
    }
  }

  const shown = showAll ? all : display;
  const byDay = new Map<string, SlotView[]>();
  for (const s of shown) {
    byDay.set(s.dateKey, [...(byDay.get(s.dateKey) ?? []), s]);
  }

  if (all.length === 0) {
    if (mode === "reschedule") {
      return (
        <Card className="flex flex-col gap-3 items-center text-center py-8">
          <h1 className="text-xl font-bold">אין חלון פנוי אחר כרגע</h1>
          <p className="text-ink-muted">דברו איתנו ונמצא פתרון יחד.</p>
          <Link href={`/s/${requestToken}`} className="underline text-sm">
            חזרה לעמוד הסטטוס
          </Link>
        </Card>
      );
    }
    return <NoSlots requestToken={requestToken} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">
        {mode === "reschedule" ? "לאיזה זמן נעביר את הביקור?" : "מתי נוח לכם שנגיע?"}
      </h1>
      {stale && (
        <p role="alert" className="text-safety-attention text-sm">
          הזמן שבחרתם בדיוק נתפס — הנה החלופות הקרובות ביותר.
        </p>
      )}
      {error && (
        <p role="alert" className="text-safety-unsafe text-sm">{error}</p>
      )}
      {[...byDay.entries()].map(([dateKey, slots]) => (
        <div key={dateKey} className="flex flex-col gap-2">
          <p className="font-bold">{dayLabel(dateKey)}</p>
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <button
                key={s.plannedStartISO}
                disabled={busy !== null}
                onClick={() => choose(s)}
                className="min-h-(--tap-min) px-5 rounded-(--radius-control) border border-border bg-surface font-medium hover:border-brand disabled:opacity-50"
                dir="ltr"
              >
                {busy === s.plannedStartISO ? "…" : timeRange(s)}
              </button>
            ))}
          </div>
        </div>
      ))}
      {!showAll && all.length > display.length && (
        <button
          onClick={() => setShowAll(true)}
          className="text-sm underline text-ink-muted min-h-10 self-start"
        >
          מעדיפים זמן אחר?
        </button>
      )}
    </div>
  );
}

function NoSlots({ requestToken }: { requestToken: string }) {
  const [sent, setSent] = useState(false);
  return (
    <Card className="flex flex-col gap-3 items-center text-center py-8">
      <h1 className="text-xl font-bold">אין לנו חלון פנוי קרוב</h1>
      <p className="text-ink-muted">
        לא מצאנו זמן שמתאים בימים הקרובים. השאירו לנו את זה — רן יבדוק את היומן
        ויחזור אליכם עם הצעה אישית.
      </p>
      {sent ? (
        <p className="font-bold text-brand">קיבלנו — נחזור אליכם בהקדם!</p>
      ) : (
        <button
          onClick={async () => {
            await noSlotFallbackAction(requestToken);
            setSent(true);
          }}
          className="min-h-12 px-6 rounded-(--radius-control) bg-brand text-on-brand font-medium"
        >
          תחזרו אליי עם זמן
        </button>
      )}
      <Link href="/" className="underline text-sm">חזרה לדף הבית</Link>
    </Card>
  );
}
