"use client";

import { useState } from "react";
import {
  addFindingAction,
  attachJobMediaAction,
  leftSiteAction,
  recordPaymentAction,
  requestApprovalAction,
  resolveFindingAction,
  saveCompletionDetailsAction,
  saveOpeningAction,
  saveSafetyCheckAction,
  setActualItemsAction,
  transitionJobAction,
} from "@/server/actions/jobs";
import { Card } from "@/components/ui/card";
import { shekel, fmtTime } from "@/lib/format";

/* eslint-disable @typescript-eslint/no-explicit-any -- serialized DB rows */

const CHECKS: { type: string; labelHe: string }[] = [
  { type: "CRANK", labelHe: "קראנק" },
  { type: "STEM_HANDLEBAR", labelHe: "סטם וכידון" },
  { type: "WHEELS_AXLES", labelHe: "גלגלים וצירים" },
  { type: "BRAKES", labelHe: "בלמים" },
  { type: "GEARS", labelHe: "הילוכים" },
];

const RESULT_OPTIONS = [
  { value: "OK", labelHe: "תקין", cls: "border-safety-ok text-safety-ok" },
  { value: "ATTENTION_RECOMMENDED", labelHe: "מומלץ לטפל", cls: "border-safety-attention text-safety-attention" },
  { value: "UNSAFE", labelHe: "לא בטוח", cls: "border-safety-unsafe text-safety-unsafe" },
];

export function JobRunner(props: {
  job: any;
  customer: any;
  bike: any;
  location: any;
  findings: any[];
  approvals: any[];
  checkItems: Record<string, { checkType: string; result: string; note: string | null }[]>;
  lineItems: any[];
  appointment: any;
  catalog: any[];
  photos: { id: string; kind: string }[];
}) {
  const { job, customer, bike, location, findings, approvals, appointment } = props;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function go(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) setError(res.error ?? "שגיאה");
  }

  const status: string = job.status;
  const approvedTotal =
    (job.expectedTotal ?? 0) +
    (job.travelCharge ?? 0) +
    approvals.filter((a) => a.decision === "APPROVED").reduce((s, a) => s + a.price, 0);

  return (
    <div className="p-4 flex flex-col gap-3 pb-28">
      {/* sticky context header */}
      <Card className="flex flex-col gap-1">
        <div className="flex justify-between items-start">
          <p className="font-bold text-lg">
            {customer?.name} · {bike?.nickname ?? bike?.category}
          </p>
          {appointment && (
            <p className="text-sm text-ink-muted" dir="ltr">
              {fmtTime(new Date(appointment.windowStart))}
            </p>
          )}
        </div>
        <p className="text-sm text-ink-muted">{location?.formattedAddress}</p>
        {location?.accessNotes && (
          <p className="text-sm text-ink-muted">{location.accessNotes}</p>
        )}
        <p className="text-sm">
          דווח: <strong>{symptomHe(job.reportedSymptoms)}</strong> · סוכם עד כה:{" "}
          <strong>{shekel(approvedTotal)}</strong>
        </p>
        {props.photos.length > 0 && (
          <div className="flex gap-2 overflow-x-auto py-1">
            {props.photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.id}
                src={`/api/media/${p.id}`}
                alt={p.kind}
                className="h-16 w-16 object-cover rounded-(--radius-control) shrink-0"
              />
            ))}
          </div>
        )}
      </Card>

      {error && (
        <p role="alert" className="text-safety-unsafe text-sm font-bold">{error}</p>
      )}

      {/* stage content by status */}
      {status === "SCHEDULED" && (
        <Stage title="לפני יציאה">
          <BigButton disabled={busy} onClick={() => go(() => transitionJobAction(job.id, "EN_ROUTE"))}>
            יצאתי
          </BigButton>
        </Stage>
      )}

      {status === "EN_ROUTE" && (
        <Stage title="בדרך">
          <BigButton disabled={busy} onClick={() => go(() => transitionJobAction(job.id, "ARRIVED"))}>
            הגעתי
          </BigButton>
        </Stage>
      )}

      {status === "ARRIVED" && (
        <Stage title="פתיחה">
          <OpeningToggles job={job} onSave={(v) => go(() => saveOpeningAction(job.id, v))} />
          <BigButton disabled={busy} onClick={() => go(() => transitionJobAction(job.id, "INSPECTION"))}>
            מתחיל בדיקה
          </BigButton>
        </Stage>
      )}

      {status === "INSPECTION" && (
        <>
          <SafetyCheckStage
            phase="INSPECTION"
            existing={props.checkItems["INSPECTION"] ?? []}
            hasGears={bike?.hasGears}
            busy={busy}
            onSave={(items) => go(() => saveSafetyCheckAction(job.id, { phase: "INSPECTION", items: items as never }))}
          />
          <FindingsStage {...props} busy={busy} go={go} />
          <Stage title="המשך">
            <BigButton disabled={busy} onClick={() => go(() => transitionJobAction(job.id, "IN_SERVICE"))}>
              הכל סגור — מתחיל לעבוד
            </BigButton>
            {findings.some((f) => f.proposedWorkHe && f.resolution === "OPEN") && (
              <BigButton
                variant="secondary"
                disabled={busy}
                onClick={() => go(() => transitionJobAction(job.id, "AWAITING_APPROVAL"))}
              >
                ממתין לאישור לקוח
              </BigButton>
            )}
          </Stage>
        </>
      )}

      {status === "AWAITING_APPROVAL" && (
        <>
          <FindingsStage {...props} busy={busy} go={go} />
          <Stage title="המשך">
            <BigButton disabled={busy} onClick={() => go(() => transitionJobAction(job.id, "IN_SERVICE"))}>
              אושר — ממשיך לעבודה
            </BigButton>
            <BigButton
              variant="secondary"
              disabled={busy}
              onClick={() => go(() => transitionJobAction(job.id, "PAYMENT_PENDING"))}
            >
              הכל נדחה — סיום בדמי ביקור
            </BigButton>
          </Stage>
        </>
      )}

      {status === "IN_SERVICE" && (
        <>
          <ActualWorkStage {...props} busy={busy} go={go} />
          <FindingsStage {...props} busy={busy} go={go} compact />
          <Stage title="סיום עבודה">
            <BigButton disabled={busy} onClick={() => go(() => transitionJobAction(job.id, "FINAL_SAFETY_CHECK"))}>
              לבדיקת סיום
            </BigButton>
          </Stage>
        </>
      )}

      {status === "FINAL_SAFETY_CHECK" && (
        <>
          <SafetyCheckStage
            phase="FINAL"
            existing={props.checkItems["FINAL"] ?? props.checkItems["INSPECTION"] ?? []}
            hasGears={bike?.hasGears}
            busy={busy}
            onSave={(items) => go(() => saveSafetyCheckAction(job.id, { phase: "FINAL", items: items as never }))}
          />
          <PhotoAttach jobId={job.id} kind="AFTER" label="תמונת אחרי" onDone={() => go(async () => ({ ok: true }))} />
          <Stage title="המשך">
            <BigButton disabled={busy} onClick={() => go(() => transitionJobAction(job.id, "PAYMENT_PENDING"))}>
              לתשלום
            </BigButton>
          </Stage>
        </>
      )}

      {status === "PAYMENT_PENDING" && (
        <PaymentStage {...props} approvedTotal={approvedTotal} busy={busy} go={go} />
      )}

      {status === "COMPLETED" && (
        <Stage title="הושלם">
          <p className="text-sm text-ink-muted">
            העבודה נסגרה. הסיכום זמין ללקוח בקישור הסטטוס.
          </p>
          <CopyStatusLink token={job.publicToken} phone={customer?.phone} />
          {!job.leftSiteAt && (
            <BigButton variant="secondary" disabled={busy} onClick={() => go(() => leftSiteAction(job.id))}>
              עזבתי
            </BigButton>
          )}
        </Stage>
      )}

      {["UNRESOLVED", "CANCELLED"].includes(status) && (
        <Stage title={status === "CANCELLED" ? "בוטל" : "הסתיים ללא פתרון"}>
          <p className="text-sm text-ink-muted">
            {job.unresolvedReason ?? job.cancelReason ?? ""}
          </p>
        </Stage>
      )}

      {/* exceptional endings, always reachable mid-visit */}
      {["ARRIVED", "INSPECTION", "AWAITING_APPROVAL", "IN_SERVICE"].includes(status) && (
        <ExceptionalEnd jobId={job.id} busy={busy} go={go} />
      )}
      {["SCHEDULED", "EN_ROUTE"].includes(status) && (
        <CancelJob jobId={job.id} busy={busy} go={go} />
      )}
    </div>
  );
}

/* ------------------------------ building blocks ---------------------------- */

function symptomHe(s: string): string {
  const map: Record<string, string> = {
    puncture: "פנצ'ר",
    brakes: "בלמים",
    gears: "הילוכים",
    chain_drops: "שרשרת נופלת",
    loose_or_noise: "רופף/מרעיש",
    tune_up: "טיפול",
    unknown: "לא ידוע",
  };
  return map[s] ?? s;
}

function Stage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-3">
      <p className="font-bold">{title}</p>
      {children}
    </Card>
  );
}

function BigButton({
  variant = "primary",
  className = "",
  ...props
}: React.ComponentPropsWithoutRef<"button"> & { variant?: "primary" | "secondary" }) {
  return (
    <button
      {...props}
      className={
        "min-h-14 rounded-(--radius-control) text-lg font-bold disabled:opacity-40 " +
        (variant === "primary"
          ? "bg-brand text-on-brand "
          : "border border-border ") +
        className
      }
    />
  );
}

function OpeningToggles({
  job,
  onSave,
}: {
  job: any;
  onSave: (v: { initialRideDone: boolean | null; cleaned: boolean | null }) => void;
}) {
  const [ride, setRide] = useState<boolean | null>(job.initialRideDone);
  const [cleaned, setCleaned] = useState<boolean | null>(job.cleaned);
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 min-h-11">
        <input
          type="checkbox"
          checked={ride === true}
          onChange={(e) => {
            setRide(e.target.checked);
            onSave({ initialRideDone: e.target.checked, cleaned });
          }}
        />
        סיבוב ראשוני בוצע (אם רלוונטי)
      </label>
      <label className="flex items-center gap-2 min-h-11">
        <input
          type="checkbox"
          checked={cleaned === true}
          onChange={(e) => {
            setCleaned(e.target.checked);
            onSave({ initialRideDone: ride, cleaned: e.target.checked });
          }}
        />
        ניקוי אבק
      </label>
    </div>
  );
}

function SafetyCheckStage({
  phase,
  existing,
  hasGears,
  busy,
  onSave,
}: {
  phase: "INSPECTION" | "FINAL";
  existing: { checkType: string; result: string; note: string | null }[];
  hasGears: boolean | null;
  busy: boolean;
  onSave: (items: { checkType: string; result: string }[]) => void;
}) {
  const [results, setResults] = useState<Record<string, string>>(
    Object.fromEntries(existing.map((e) => [e.checkType, e.result])),
  );
  const allSet = CHECKS.every((c) => results[c.type]);

  return (
    <Stage title={phase === "INSPECTION" ? "בדיקת בטיחות — חובה בכל ביקור" : "בדיקת סיום"}>
      {CHECKS.map((c) => (
        <div key={c.type} className="flex flex-col gap-1.5">
          <p className="font-medium">{c.labelHe}</p>
          <div className="flex flex-wrap gap-2">
            {RESULT_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setResults((r) => ({ ...r, [c.type]: o.value }))}
                className={`min-h-11 px-4 rounded-full border text-sm font-medium ${
                  results[c.type] === o.value ? `${o.cls} bg-brand-soft` : "border-border text-ink-muted"
                }`}
              >
                {o.labelHe}
              </button>
            ))}
            {c.type === "GEARS" && hasGears !== true && (
              <button
                onClick={() => setResults((r) => ({ ...r, GEARS: "NOT_APPLICABLE" }))}
                className={`min-h-11 px-4 rounded-full border text-sm font-medium ${
                  results.GEARS === "NOT_APPLICABLE" ? "border-brand text-brand bg-brand-soft" : "border-border text-ink-muted"
                }`}
              >
                אין הילוכים
              </button>
            )}
          </div>
        </div>
      ))}
      <BigButton
        variant="secondary"
        disabled={!allSet || busy}
        onClick={() =>
          onSave(CHECKS.map((c) => ({ checkType: c.type, result: results[c.type] })))
        }
      >
        שמור בדיקה
      </BigButton>
    </Stage>
  );
}

function FindingsStage({
  job,
  findings,
  approvals,
  catalog,
  busy,
  go,
  compact = false,
}: any) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [work, setWork] = useState("");
  const [price, setPrice] = useState("");
  const [severity, setSeverity] = useState("ATTENTION_RECOMMENDED");
  const [approverName, setApproverName] = useState("");

  const pendingByFinding = new Map(
    approvals.filter((a: any) => a.decision === "PENDING").map((a: any) => [a.findingId, a]),
  );
  const approvedByFinding = new Map(
    approvals.filter((a: any) => a.decision === "APPROVED").map((a: any) => [a.findingId, a]),
  );

  return (
    <Stage title="ממצאים">
      {findings.length === 0 && !showAdd && (
        <p className="text-sm text-ink-muted">אין ממצאים נוספים.</p>
      )}
      {findings.map((f: any) => (
        <div key={f.id} className="border border-border rounded-(--radius-control) p-3 flex flex-col gap-2">
          <div className="flex justify-between items-start gap-2">
            <p className="font-medium">
              {f.severity === "UNSAFE" && ""}
              {f.titleHe}
            </p>
            <span className="text-xs text-ink-muted whitespace-nowrap">{resolutionHe(f.resolution)}</span>
          </div>
          {f.proposedWorkHe && (
            <p className="text-sm">
              {f.proposedWorkHe} · {shekel(f.proposedPrice)}
            </p>
          )}
          {f.resolution === "OPEN" && !f.proposedWorkHe && !compact && (
            <ProposeWork
              finding={f}
              jobId={job.id}
              catalog={catalog}
              busy={busy}
              go={go}
              approverName={approverName}
              setApproverName={setApproverName}
            />
          )}
          {f.resolution === "OPEN" && f.proposedWorkHe && pendingByFinding.has(f.id) && (
            <p className="text-xs text-safety-attention">ממתין להחלטת לקוח בקישור הסטטוס…</p>
          )}
          {f.resolution === "OPEN" && approvedByFinding.has(f.id) && (
            <button
              disabled={busy}
              onClick={() => go(() => resolveFindingAction(job.id, { findingId: f.id, resolution: "REPAIRED" }))}
              className="min-h-11 rounded-(--radius-control) border border-safety-ok text-safety-ok text-sm font-medium self-start px-4"
            >
              תוקן
            </button>
          )}
          {f.severity === "UNSAFE" && f.resolution === "OPEN" && (
            <button
              disabled={busy}
              onClick={() =>
                go(() => resolveFindingAction(job.id, { findingId: f.id, resolution: "ACKNOWLEDGED_UNREPAIRED" }))
              }
              className="min-h-11 rounded-(--radius-control) border border-safety-attention text-safety-attention text-xs font-medium self-start px-3"
            >
              הלקוח מודע ובחר לא לתקן (יתועד)
            </button>
          )}
        </div>
      ))}
      {!compact && (
        showAdd ? (
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="מה מצאת? (למשל: כבל בלם שחוק)"
              className="min-h-11 rounded-(--radius-control) border border-border bg-bg px-3 text-sm"
            />
            <div className="flex gap-2">
              {["INFO", "ATTENTION_RECOMMENDED", "UNSAFE"].map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverity(s)}
                  className={`min-h-10 px-3 rounded-full border text-xs ${severity === s ? "border-brand text-brand" : "border-border text-ink-muted"}`}
                >
                  {s === "INFO" ? "מידע" : s === "ATTENTION_RECOMMENDED" ? "מומלץ לטפל" : "לא בטוח"}
                </button>
              ))}
            </div>
            <input
              value={work}
              onChange={(e) => setWork(e.target.value)}
              placeholder="הצעת תיקון (אופציונלי בשלב זה)"
              className="min-h-11 rounded-(--radius-control) border border-border bg-bg px-3 text-sm"
            />
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="מחיר ₪"
              inputMode="numeric"
              dir="ltr"
              className="min-h-11 rounded-(--radius-control) border border-border bg-bg px-3 text-sm text-left"
            />
            <BigButton
              variant="secondary"
              disabled={busy || title.length < 2}
              onClick={() => {
                go(() =>
                  addFindingAction(job.id, {
                    titleHe: title,
                    severity: severity as never,
                    proposedWorkHe: work || undefined,
                    proposedPriceShekels: price ? Number(price) : undefined,
                  }),
                );
                setShowAdd(false);
                setTitle(""); setWork(""); setPrice("");
              }}
            >
              הוסף ממצא
            </BigButton>
          </div>
        ) : (
          <button onClick={() => setShowAdd(true)} className="text-sm underline self-start min-h-10">
            + ממצא חדש
          </button>
        )
      )}
    </Stage>
  );
}

function resolutionHe(r: string): string {
  const map: Record<string, string> = {
    OPEN: "פתוח",
    REPAIRED: "תוקן",
    DECLINED: "נדחה",
    DEFERRED: "לפעם הבאה",
    REFUSED_UNSAFE_PART: "סירבנו (חלק לא בטוח)",
    ACKNOWLEDGED_UNREPAIRED: "הלקוח מודע",
  };
  return map[r] ?? r;
}

function ProposeWork({ finding, jobId, catalog, busy, go, approverName, setApproverName }: any) {
  const [work, setWork] = useState(finding.proposedWorkHe ?? "");
  const [price, setPrice] = useState(
    finding.proposedPrice != null ? String(finding.proposedPrice / 100) : "",
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {catalog.slice(0, 8).map((c: any) => (
          <button
            key={c.id}
            onClick={() => {
              setWork(c.customerNameHe);
              if (c.basePrice != null) setPrice(String(c.basePrice / 100));
            }}
            className="text-xs border border-border rounded-full px-2 py-1 min-h-8"
          >
            {c.customerNameHe}
          </button>
        ))}
      </div>
      <input
        value={work}
        onChange={(e) => setWork(e.target.value)}
        placeholder="הצעת תיקון"
        className="min-h-11 rounded-(--radius-control) border border-border bg-bg px-3 text-sm"
      />
      <input
        value={price}
        onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))}
        placeholder="מחיר ₪"
        inputMode="numeric"
        dir="ltr"
        className="min-h-11 rounded-(--radius-control) border border-border bg-bg px-3 text-sm text-left"
      />
      <input
        value={approverName}
        onChange={(e) => setApproverName(e.target.value)}
        placeholder="שם המאשר/ת (לאישור במקום)"
        className="min-h-11 rounded-(--radius-control) border border-border bg-bg px-3 text-sm"
      />
      <div className="flex gap-2 flex-wrap">
        <button
          disabled={busy || !work || !price || approverName.trim().length < 2}
          onClick={() =>
            go(() =>
              requestApprovalAction(jobId, {
                findingId: finding.id,
                proposedWorkHe: work,
                priceShekels: Number(price),
                channel: "IN_PERSON",
                inPersonDecision: "APPROVED",
                approverName,
              }),
            )
          }
          className="min-h-11 px-4 rounded-(--radius-control) bg-brand text-on-brand text-sm font-medium disabled:opacity-40"
        >
          אושר במקום
        </button>
        <button
          disabled={busy || !work || !price || approverName.trim().length < 2}
          onClick={() =>
            go(() =>
              requestApprovalAction(jobId, {
                findingId: finding.id,
                proposedWorkHe: work,
                priceShekels: Number(price),
                channel: "IN_PERSON",
                inPersonDecision: "DECLINED",
                approverName,
              }),
            )
          }
          className="min-h-11 px-4 rounded-(--radius-control) border border-border text-sm font-medium disabled:opacity-40"
        >
          נדחה במקום
        </button>
        <button
          disabled={busy || !work || !price}
          onClick={() =>
            go(() =>
              requestApprovalAction(jobId, {
                findingId: finding.id,
                proposedWorkHe: work,
                priceShekels: Number(price),
                channel: "LINK",
              }),
            )
          }
          className="min-h-11 px-4 rounded-(--radius-control) border border-brand text-brand text-sm font-medium disabled:opacity-40"
        >
          שלח לאישור בקישור
        </button>
      </div>
    </div>
  );
}

function ActualWorkStage({ job, lineItems, approvals, busy, go }: any) {
  const expected = lineItems.filter((li: any) => li.kind === "EXPECTED");
  const actual = lineItems.filter((li: any) => li.kind === "ACTUAL");
  const approved = approvals.filter((a: any) => a.decision === "APPROVED");

  const [items, setItems] = useState<
    { label: string; priceShekels: number; approvalId: string | null }[]
  >(
    actual.length > 0
      ? actual.map((li: any) => ({
          label: li.label,
          priceShekels: (li.price ?? 0) / 100,
          approvalId: li.approvalId,
        }))
      : [
          ...expected.map((li: any) => ({
            label: li.label,
            priceShekels: (li.price ?? 0) / 100,
            approvalId: null,
          })),
          ...approved.map((a: any) => ({
            label: a.proposedWorkHe,
            priceShekels: a.price / 100,
            approvalId: a.id,
          })),
        ],
  );

  return (
    <Stage title="עבודה בפועל">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="flex-1">{item.label}</span>
          <span dir="ltr">{item.priceShekels} ₪</span>
          <button
            onClick={() => setItems(items.filter((_, j) => j !== i))}
            className="min-h-9 px-2 text-ink-muted underline text-xs"
          >
            הסר
          </button>
        </div>
      ))}
      <BigButton
        variant="secondary"
        disabled={busy}
        onClick={() => go(() => setActualItemsAction(job.id, items as never))}
      >
        שמור רשימת עבודה
      </BigButton>
      <p className="text-xs text-ink-muted">
        עבודה מעבר למה שסוכם דורשת אישור לקוח — הוסיפו ממצא ובקשו אישור.
      </p>
    </Stage>
  );
}

function PaymentStage({ job, approvedTotal, busy, go, findings }: any) {
  const declinedAll =
    findings.filter((f: any) => f.proposedWorkHe).length > 0 &&
    findings
      .filter((f: any) => f.proposedWorkHe)
      .every((f: any) => ["DECLINED", "DEFERRED"].includes(f.resolution));
  const suggested = declinedAll ? job.visitFee + (job.travelCharge ?? 0) : approvedTotal;

  const [amount, setAmount] = useState(String(suggested / 100));
  const [method, setMethod] = useState("PAID_CASH");
  const [reason, setReason] = useState("");
  const [tip, setTip] = useState("");

  return (
    <Stage title="תשלום וסגירה">
      {declinedAll && (
        <p className="text-sm text-safety-attention">ביקור אבחון — דמי ביקור {shekel(job.visitFee)}</p>
      )}
      <p className="text-sm">
        סה&quot;כ מאושר: <strong>{shekel(declinedAll ? job.visitFee + (job.travelCharge ?? 0) : approvedTotal)}</strong>
      </p>
      <label className="flex flex-col gap-1 text-sm font-medium">
        סכום לחיוב (₪)
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
          inputMode="numeric"
          dir="ltr"
          className="min-h-12 rounded-(--radius-control) border border-border bg-bg px-3 text-left"
        />
      </label>
      {Number(amount) * 100 < suggested && (
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="סיבת הפחתה (חובה)"
          className="min-h-11 rounded-(--radius-control) border border-safety-attention bg-bg px-3 text-sm"
        />
      )}
      <div className="flex flex-wrap gap-2">
        {[
          ["PAID_CASH", "מזומן"],
          ["PAID_BIT", "ביט"],
          ["PAID_TRANSFER", "העברה"],
          ["PAID_EXTERNAL", "אחר"],
          ["WAIVED", "ויתור"],
        ].map(([v, l]) => (
          <button
            key={v}
            onClick={() => setMethod(v)}
            className={`min-h-11 px-4 rounded-full border text-sm font-medium ${method === v ? "border-brand text-brand bg-brand-soft" : "border-border"}`}
          >
            {l}
          </button>
        ))}
      </div>
      <input
        value={tip}
        onChange={(e) => setTip(e.target.value)}
        placeholder="טיפ תחזוקה ללקוח (אופציונלי)"
        className="min-h-11 rounded-(--radius-control) border border-border bg-bg px-3 text-sm"
      />
      <BigButton
        disabled={busy || !amount}
        onClick={() =>
          go(async () => {
            const pay = await recordPaymentAction(job.id, {
              method: method as never,
              amountShekels: Number(amount),
              adjustReason: reason || undefined,
            });
            if (!pay.ok) return pay;
            if (tip) {
              await saveCompletionDetailsAction(job.id, { maintenanceTipHe: tip });
            }
            return transitionJobAction(job.id, "COMPLETED");
          })
        }
      >
        סגור עבודה
      </BigButton>
      <SkipAfterPhoto jobId={job.id} hasAfter={!!job.afterMediaId} busy={busy} go={go} />
    </Stage>
  );
}

function SkipAfterPhoto({ jobId, hasAfter, busy, go }: any) {
  const [reason, setReason] = useState("");
  if (hasAfter) return null;
  return (
    <div className="flex gap-2 items-center">
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="אין תמונת אחרי? סיבה…"
        className="min-h-10 flex-1 rounded-(--radius-control) border border-border bg-bg px-3 text-xs"
      />
      <button
        disabled={busy || reason.length < 2}
        onClick={() => go(() => saveCompletionDetailsAction(jobId, { afterPhotoSkipReason: reason }))}
        className="text-xs underline min-h-10 disabled:opacity-40"
      >
        דלג עם סיבה
      </button>
    </div>
  );
}

function PhotoAttach({
  jobId,
  kind,
  label,
  onDone,
}: {
  jobId: string;
  kind: "BEFORE" | "AFTER" | "FINDING";
  label: string;
  onDone: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <Card className="flex items-center gap-3">
      <label className="min-h-12 px-4 rounded-(--radius-control) border border-border flex items-center gap-2 cursor-pointer font-medium">
        {uploading ? "מעלה…" : done ? "הועלתה" : label}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={uploading}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setUploading(true);
            try {
              const form = new FormData();
              form.append("file", f);
              const res = await fetch("/api/upload", { method: "POST", body: form });
              const body = await res.json();
              if (res.ok) {
                await attachJobMediaAction(jobId, body.mediaId, kind);
                setDone(true);
                onDone();
              }
            } finally {
              setUploading(false);
              e.target.value = "";
            }
          }}
        />
      </label>
    </Card>
  );
}

function ExceptionalEnd({ jobId, busy, go }: any) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm underline text-ink-muted min-h-10">
        סיום חריג (אין לקוח / אין חלק / עצירת בטיחות)
      </button>
    );
  }
  const reasons: [string, string][] = [
    ["NO_SHOW", "הלקוח לא זמין / לא פתח"],
    ["PART_UNAVAILABLE", "חסר חלק"],
    ["SAFETY_STOP", "עצירת בטיחות"],
    ["CUSTOMER_ABORTED", "הלקוח ביטל במקום"],
    ["OTHER", "אחר"],
  ];
  return (
    <Card className="flex flex-col gap-2 border-safety-attention">
      <p className="font-bold text-sm">סיום חריג — בחר סיבה (יתועד וישחרר את היומן)</p>
      {reasons.map(([v, l]) => (
        <button
          key={v}
          disabled={busy}
          onClick={() => go(() => transitionJobAction(jobId, "UNRESOLVED", { unresolvedReason: v as never }))}
          className="min-h-11 rounded-(--radius-control) border border-border text-sm text-start px-3"
        >
          {l}
        </button>
      ))}
      <button onClick={() => setOpen(false)} className="text-xs underline min-h-9">בטל</button>
    </Card>
  );
}

function CancelJob({ jobId, busy, go }: any) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm underline text-ink-muted min-h-10">
        ביטול ביקור
      </button>
    );
  }
  return (
    <Card className="flex flex-col gap-2 border-safety-attention">
      <p className="font-bold text-sm">ביטול — בחר סיבה</p>
      {[["CUSTOMER_REQUEST", "בקשת לקוח"], ["OPERATOR", "החלטת רנצ'ו"], ["OTHER", "אחר"]].map(([v, l]) => (
        <button
          key={v}
          disabled={busy}
          onClick={() => go(() => transitionJobAction(jobId, "CANCELLED", { cancelReason: v as never }))}
          className="min-h-11 rounded-(--radius-control) border border-border text-sm text-start px-3"
        >
          {l}
        </button>
      ))}
      <button onClick={() => setOpen(false)} className="text-xs underline min-h-9">חזרה</button>
    </Card>
  );
}

function CopyStatusLink({ token, phone }: { token: string; phone?: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/s/${token}` : `/s/${token}`;
  const message = encodeURIComponent(`סיימנו! כל הסיכום כאן: ${url}\nרנצ'ו — תיקוני אופניים עד הבית`);
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
        }}
        className="min-h-11 px-4 rounded-(--radius-control) border border-border text-sm font-medium"
      >
        {copied ? "הועתק" : "העתק קישור סטטוס"}
      </button>
      {phone && (
        <a
          href={`https://wa.me/972${phone.replace("+972", "").replace(/^0/, "")}?text=${message}`}
          target="_blank"
          rel="noreferrer"
          className="min-h-11 px-4 rounded-(--radius-control) border border-brand text-brand text-sm font-medium flex items-center"
        >
          שלח בוואטסאפ
        </a>
      )}
    </div>
  );
}
