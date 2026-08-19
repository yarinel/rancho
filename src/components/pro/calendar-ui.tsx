"use client";

import { useState } from "react";
import Link from "next/link";
import {
  createBlockAction,
  deleteBlockAction,
  manualBookingAction,
  moveAppointmentAction,
} from "@/server/actions/calendar";
import { transitionJobAction } from "@/server/actions/jobs";
import { Card } from "@/components/ui/card";

const TZ = "Asia/Jerusalem";
const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(
    new Date(iso),
  );

function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) setError(res.error ?? "שגיאה");
    return res.ok;
  };
  return { busy, error, run };
}

/* --------------------------------- toolbar --------------------------------- */

export function CalendarToolbar({
  zones,
}: {
  zones: { id: string; nameHe: string }[];
}) {
  const [mode, setMode] = useState<"none" | "block" | "booking">("none");
  const { busy, error, run } = useAction();

  const [date, setDate] = useState("");
  const [from, setFrom] = useState("15:00");
  const [to, setTo] = useState("20:00");
  const [zoneId, setZoneId] = useState("");
  const [reason, setReason] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [time, setTime] = useState("16:00");
  const [duration, setDuration] = useState("40");
  const [note, setNote] = useState("");

  const inputCls =
    "min-h-11 rounded-(--radius-control) border border-border bg-surface px-3 text-sm";

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          onClick={() => setMode(mode === "block" ? "none" : "block")}
          className={`min-h-11 px-4 rounded-(--radius-control) border text-sm font-medium ${mode === "block" ? "border-brand text-brand" : "border-border"}`}
        >
          חסימת זמן / אזור
        </button>
        <button
          onClick={() => setMode(mode === "booking" ? "none" : "booking")}
          className={`min-h-11 px-4 rounded-(--radius-control) border text-sm font-medium ${mode === "booking" ? "border-brand text-brand" : "border-border"}`}
        >
          הזמנה ידנית
        </button>
      </div>
      {error && <p className="text-safety-unsafe text-sm">{error}</p>}

      {mode === "block" && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" className={inputCls} aria-label="תאריך" />
            <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} dir="ltr" className={inputCls} aria-label="משעה" />
            <input type="time" value={to} onChange={(e) => setTo(e.target.value)} dir="ltr" className={inputCls} aria-label="עד שעה" />
            <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className={inputCls} aria-label="אזור">
              <option value="">כל האזורים (חסימה מלאה)</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>רק {z.nameHe}</option>
              ))}
            </select>
          </div>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="סיבה (אופציונלי)" className={inputCls} />
          <button
            disabled={busy || !date}
            onClick={async () => {
              const ok = await run(() =>
                createBlockAction({
                  startsAtISO: new Date(`${date}T${from}:00`).toISOString(),
                  endsAtISO: new Date(`${date}T${to}:00`).toISOString(),
                  zoneId: zoneId || null,
                  reason: reason || undefined,
                }),
              );
              if (ok) setMode("none");
            }}
            className="min-h-11 px-4 rounded-(--radius-control) bg-brand text-on-brand text-sm font-medium self-start disabled:opacity-40"
          >
            חסום
          </button>
        </div>
      )}

      {mode === "booking" && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם לקוח" className={inputCls} />
            <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))} placeholder="טלפון" inputMode="tel" dir="ltr" className={`${inputCls} text-left`} />
          </div>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="כתובת" className={inputCls} />
          <div className="flex flex-wrap gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" className={inputCls} aria-label="תאריך" />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} dir="ltr" className={inputCls} aria-label="שעה" />
            <input value={duration} onChange={(e) => setDuration(e.target.value.replace(/[^0-9]/g, ""))} placeholder="דקות" inputMode="numeric" dir="ltr" className={`${inputCls} w-20 text-left`} aria-label="משך בדקות" />
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="מה הבעיה? (הערה)" className={inputCls} />
          <p className="text-xs text-ink-muted">
            הזמנה ידנית עוקפת את מנוע השיבוץ (נרשם ביומן הפעולות) — אבל לא יכולה
            לדרוס עבודה קיימת.
          </p>
          <button
            disabled={busy || !name || !/^0\d{8,9}$/.test(phone) || !address || !date}
            onClick={async () => {
              const ok = await run(() =>
                manualBookingAction({
                  customerName: name,
                  phone,
                  address,
                  note: note || undefined,
                  startISO: new Date(`${date}T${time}:00`).toISOString(),
                  durationMin: Number(duration) || 40,
                }),
              );
              if (ok) setMode("none");
            }}
            className="min-h-11 px-4 rounded-(--radius-control) bg-brand text-on-brand text-sm font-medium self-start disabled:opacity-40"
          >
            קבע
          </button>
        </div>
      )}
    </Card>
  );
}

/* ---------------------------------- day row -------------------------------- */

export function CalendarDay({
  day,
}: {
  day: {
    dateKey: string;
    label: string;
    items: {
      kind: "job" | "block";
      id: string;
      jobId?: string;
      startISO: string;
      endISO: string;
      title: string;
      sub?: string;
      status?: string;
    }[];
  };
}) {
  const { busy, error, run } = useAction();
  const [moving, setMoving] = useState<string | null>(null);
  const [newDate, setNewDate] = useState(day.dateKey);
  const [newTime, setNewTime] = useState("16:00");

  return (
    <div className="flex flex-col gap-2">
      <p className="font-bold">{day.label}</p>
      {error && <p className="text-safety-unsafe text-sm">{error}</p>}
      {day.items.length === 0 && (
        <p className="text-sm text-ink-muted">פנוי</p>
      )}
      {day.items.map((item) => (
        <Card
          key={item.id}
          className={`flex flex-col gap-2 ${item.kind === "block" ? "border-dashed" : ""}`}
        >
          <div className="flex justify-between items-center gap-2 text-sm">
            <span dir="ltr" className="font-bold">
              {fmtTime(item.startISO)}–{fmtTime(item.endISO)}
            </span>
            {item.kind === "job" ? (
              <Link href={`/pro/jobs/${item.jobId}`} className="font-medium underline">
                {item.title}
              </Link>
            ) : (
              <span className="font-medium text-ink-muted">{item.title}</span>
            )}
          </div>
          {item.sub && <p className="text-xs text-ink-muted">{item.sub}</p>}
          <div className="flex flex-wrap gap-2">
            {item.kind === "block" && (
              <button
                disabled={busy}
                onClick={() => run(() => deleteBlockAction(item.id))}
                className="min-h-10 px-3 rounded-(--radius-control) border border-border text-xs font-medium"
              >
                הסר חסימה
              </button>
            )}
            {item.kind === "job" && item.status === "SCHEDULED" && (
              <>
                <button
                  disabled={busy}
                  onClick={() => setMoving(moving === item.id ? null : item.id)}
                  className="min-h-10 px-3 rounded-(--radius-control) border border-border text-xs font-medium"
                >
                  הזז / הארך
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (confirm("לבטל את הביקור? הלקוח לא יקבל הודעה אוטומטית — עדכנו אותו.")) {
                      run(() =>
                        transitionJobAction(item.jobId!, "CANCELLED", {
                          cancelReason: "OPERATOR",
                        }),
                      );
                    }
                  }}
                  className="min-h-10 px-3 rounded-(--radius-control) border border-safety-unsafe text-safety-unsafe text-xs font-medium"
                >
                  בטל ביקור
                </button>
              </>
            )}
          </div>
          {moving === item.id && item.jobId && (
            <div className="flex flex-wrap gap-2 items-center border-t border-border pt-2">
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                dir="ltr"
                className="min-h-10 rounded-(--radius-control) border border-border bg-surface px-2 text-sm"
                aria-label="תאריך חדש"
              />
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                dir="ltr"
                className="min-h-10 rounded-(--radius-control) border border-border bg-surface px-2 text-sm"
                aria-label="שעה חדשה"
              />
              <button
                disabled={busy}
                onClick={async () => {
                  const ok = await run(() =>
                    moveAppointmentAction({
                      jobId: item.jobId!,
                      newStartISO: new Date(`${newDate}T${newTime}:00`).toISOString(),
                    }),
                  );
                  if (ok) setMoving(null);
                }}
                className="min-h-10 px-3 rounded-(--radius-control) bg-brand text-on-brand text-xs font-medium"
              >
                אשר הזזה
              </button>
              <p className="text-xs text-safety-attention w-full">
                זכרו לעדכן את הלקוח על השינוי (וואטסאפ מהעבודה עצמה).
              </p>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
