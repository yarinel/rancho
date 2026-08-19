"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { decideApprovalAction } from "@/server/actions/approval";
import { Card } from "@/components/ui/card";

export function ApprovalPrompt({
  jobToken,
  approval,
}: {
  jobToken: string;
  approval: {
    id: string;
    proposedWorkHe: string;
    explanationHe: string | null;
    priceShekels: number;
  };
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "APPROVED" | "DECLINED") {
    setBusy(true);
    setError(null);
    const res = await decideApprovalAction(jobToken, approval.id, decision, name);
    setBusy(false);
    if (!res.ok) setError(res.error ?? "משהו השתבש");
    else router.refresh();
  }

  return (
    <Card className="flex flex-col gap-3 border-brand">
      <p className="font-display text-2xl text-brand">מצאנו משהו נוסף</p>
      <p className="font-bold">{approval.proposedWorkHe}</p>
      {approval.explanationHe && (
        <p className="text-sm text-ink-muted">{approval.explanationHe}</p>
      )}
      <p className="text-xl font-bold">{approval.priceShekels} ₪</p>
      <label className="flex flex-col gap-1 text-sm font-medium">
        שם המאשר/ת
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-h-12 rounded-(--radius-control) border border-border bg-surface px-4"
        />
      </label>
      {error && (
        <p role="alert" className="text-safety-unsafe text-sm">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          disabled={busy || name.trim().length < 2}
          onClick={() => decide("APPROVED")}
          className="flex-1 min-h-12 rounded-(--radius-control) bg-brand text-on-brand font-medium disabled:opacity-40"
        >
          תתקנו
        </button>
        <button
          disabled={busy || name.trim().length < 2}
          onClick={() => decide("DECLINED")}
          className="flex-1 min-h-12 rounded-(--radius-control) border border-border font-medium disabled:opacity-40"
        >
          נשאיר לפעם הבאה
        </button>
      </div>
      <p className="text-xs text-ink-muted">
        האישור נרשם עם שם, שעה ומחיר — ולא נעבוד בלי הסכמה שלכם.
      </p>
    </Card>
  );
}
