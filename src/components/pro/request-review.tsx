"use client";

import { useState } from "react";
import {
  rejectRequestAction,
  requestInfoAction,
  reviewRequestAction,
} from "@/server/actions/requests";
import { Card } from "@/components/ui/card";

const ANSWER_LABELS: Record<string, string> = {
  _bike_category: "סוג",
  _wheel_size: "גלגל",
  _brand: "מותג",
  _rider_name: "רוכב",
  _address: "כתובת",
  _zone_name: "אזור",
  _access_notes: "גישה",
};

export function RequestReviewCard({
  request,
}: {
  request: {
    id: string;
    publicToken: string;
    status: string;
    statusReason: string | null;
    symptomHe: string;
    answers: Record<string, string>;
    assessment: { priceLow: number | null; priceHigh: number | null; rationale: string } | null;
    customerName: string;
    customerPhone: string | null;
    photoIds: string[];
    updatedAt: string;
  };
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceLow, setPriceLow] = useState("");
  const [priceHigh, setPriceHigh] = useState("");
  const [label, setLabel] = useState("");
  const [duration, setDuration] = useState("30");
  const [copied, setCopied] = useState(false);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) setError(res.error ?? "שגיאה");
  }

  const bookingUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/book/slots?token=${request.publicToken}`
      : "";
  const statusHe: Record<string, string> = {
    NEW: "חדשה",
    NEEDS_REVIEW: "ממתינה לבדיקה",
    NEEDS_CUSTOMER_INFO: "ממתינה ללקוח",
    READY_TO_BOOK: "מוכנה לתיאום",
  };

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex justify-between items-start gap-2">
        <p className="font-bold">
          {request.customerName} · {request.symptomHe}
        </p>
        <span className="text-xs bg-brand-soft text-brand-strong font-medium px-2 py-1 rounded-full whitespace-nowrap">
          {statusHe[request.status] ?? request.status}
          {request.statusReason === "NO_SLOT" && " · לא נמצא זמן"}
          {request.statusReason === "WHILE_YOU_ARE_HERE" && " · באותו ביקור"}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
        {Object.entries(request.answers)
          .filter(([k, v]) => v && (ANSWER_LABELS[k] || !k.startsWith("_")))
          .map(([k, v]) => (
            <span key={k}>
              {ANSWER_LABELS[k] ?? k}: {v}
            </span>
          ))}
      </div>
      {request.photoIds.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {request.photoIds.map((id) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={id}
              src={`/api/media/${id}`}
              alt="תמונה מהלקוח"
              className="h-24 w-24 object-cover rounded-(--radius-control) shrink-0"
            />
          ))}
        </div>
      )}
      {request.assessment?.rationale && (
        <p className="text-xs text-ink-muted">אבחון: {request.assessment.rationale}</p>
      )}
      {error && <p className="text-safety-unsafe text-sm">{error}</p>}

      {request.status === "READY_TO_BOOK" ? (
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(bookingUrl);
              setCopied(true);
            }}
            className="min-h-11 px-4 rounded-(--radius-control) border border-border text-sm font-medium"
          >
            {copied ? "הועתק" : "העתק קישור תיאום"}
          </button>
          {request.customerPhone && (
            <a
              href={`https://wa.me/972${request.customerPhone.replace("+972", "")}?text=${encodeURIComponent(
                `היי! עברנו על הפרטים — אפשר לקבוע זמן כאן: ${bookingUrl}`,
              )}`}
              target="_blank"
              rel="noreferrer"
              className="min-h-11 px-4 rounded-(--radius-control) border border-brand text-brand text-sm font-medium flex items-center"
            >
              שלח בוואטסאפ
            </a>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2 border-t border-border pt-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="שירות (למשל: החלפת צמיג)"
              className="col-span-2 min-h-11 rounded-(--radius-control) border border-border bg-surface px-3 text-sm"
            />
            <input
              value={priceLow}
              onChange={(e) => setPriceLow(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="מחיר ₪"
              inputMode="numeric"
              dir="ltr"
              className="min-h-11 rounded-(--radius-control) border border-border bg-surface px-3 text-sm text-left"
            />
            <input
              value={priceHigh}
              onChange={(e) => setPriceHigh(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="עד ₪ (לטווח)"
              inputMode="numeric"
              dir="ltr"
              className="min-h-11 rounded-(--radius-control) border border-border bg-surface px-3 text-sm text-left"
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <label className="text-sm flex items-center gap-1">
              משך (דק&apos;):
              <input
                value={duration}
                onChange={(e) => setDuration(e.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
                dir="ltr"
                className="w-16 min-h-10 rounded-(--radius-control) border border-border bg-surface px-2 text-sm text-left"
              />
            </label>
            <button
              disabled={busy || !label || !priceLow}
              onClick={() =>
                run(() =>
                  reviewRequestAction({
                    requestId: request.id,
                    serviceLabelHe: label,
                    priceLowShekels: Number(priceLow),
                    priceHighShekels: priceHigh ? Number(priceHigh) : undefined,
                    durationMin: Number(duration) || 30,
                  }),
                )
              }
              className="min-h-11 px-4 rounded-(--radius-control) bg-brand text-on-brand text-sm font-medium disabled:opacity-40"
            >
              מוכן לתיאום
            </button>
            {request.status !== "NEEDS_CUSTOMER_INFO" && (
              <button
                disabled={busy}
                onClick={() => run(() => requestInfoAction(request.id))}
                className="min-h-11 px-4 rounded-(--radius-control) border border-border text-sm font-medium disabled:opacity-40"
              >
                חסר מידע מהלקוח
              </button>
            )}
            <button
              disabled={busy}
              onClick={() =>
                run(() =>
                  rejectRequestAction({
                    requestId: request.id,
                    kind: "WORKSHOP_REQUIRED",
                    reason: "WORKSHOP_CLASS",
                  }),
                )
              }
              className="min-h-11 px-4 rounded-(--radius-control) border border-safety-attention text-safety-attention text-sm font-medium disabled:opacity-40"
            >
              עבודת סדנה
            </button>
            <button
              disabled={busy}
              onClick={() =>
                run(() =>
                  rejectRequestAction({
                    requestId: request.id,
                    kind: "OUT_OF_SCOPE",
                    reason: "OTHER",
                  }),
                )
              }
              className="min-h-11 px-4 rounded-(--radius-control) border border-border text-ink-muted text-sm font-medium disabled:opacity-40"
            >
              מחוץ לתחום
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
