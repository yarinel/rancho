"use client";

import { useState } from "react";
import Link from "next/link";
import { transitionJobAction } from "@/server/actions/jobs";

export function TodayActions({
  jobId,
  status,
  phone,
  address,
  lat,
  lng,
}: {
  jobId: string;
  status: string;
  phone: string;
  address: string;
  lat?: string | null;
  lng?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const waze = lat && lng
    ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
  const localPhone = phone.replace("+972", "0");

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <a
        href={waze}
        target="_blank"
        rel="noreferrer"
        className="min-h-11 px-4 rounded-(--radius-control) border border-border flex items-center text-sm font-medium"
      >
        ניווט
      </a>
      <a
        href={`https://wa.me/972${localPhone.slice(1)}`}
        target="_blank"
        rel="noreferrer"
        className="min-h-11 px-4 rounded-(--radius-control) border border-border flex items-center text-sm font-medium"
      >
        וואטסאפ
      </a>
      <a
        href={`tel:${localPhone}`}
        className="min-h-11 px-4 rounded-(--radius-control) border border-border flex items-center text-sm font-medium"
      >
        חיוג
      </a>
      {status === "SCHEDULED" && (
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const res = await transitionJobAction(jobId, "EN_ROUTE");
            setBusy(false);
            if (!res.ok) setError(res.error ?? "שגיאה");
          }}
          className="min-h-11 px-4 rounded-(--radius-control) bg-brand text-on-brand text-sm font-medium disabled:opacity-50"
        >
          יצאתי 🚗
        </button>
      )}
      <Link
        href={`/pro/jobs/${jobId}`}
        className="min-h-11 px-4 rounded-(--radius-control) bg-surface border border-brand text-sm font-medium flex items-center"
      >
        {status === "SCHEDULED" || status === "EN_ROUTE" ? "פתח עבודה" : "המשך עבודה"}
      </Link>
      {error && <p className="text-safety-unsafe text-xs w-full">{error}</p>}
    </div>
  );
}
