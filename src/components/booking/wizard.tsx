"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  createDraftAction,
  createLeadAction,
  saveAnswersAction,
  saveLocationAction,
  submitContactAction,
  type SubmitResult,
} from "@/server/actions/booking";
import { INTAKE_QUESTIONS, SYMPTOM_LABELS } from "@/domain/intake";
import type { BicycleCategory, SymptomCategory, WheelSize } from "@/domain/types";
import { Chip } from "@/components/ui/chip";
import { Card } from "@/components/ui/card";

/**
 * Conversational booking wizard — one question per screen, chips over typing,
 * back always works, draft resumes after refresh (localStorage + server draft).
 */

type Step =
  | "problem"
  | "bike"
  | "intake"
  | "photos"
  | "location"
  | "contact"
  | "result"
  | "out_of_scope"
  | "out_of_zone";

interface WizardState {
  step: Step;
  symptom?: SymptomCategory;
  bikeCategory?: BicycleCategory;
  wheelSize?: WheelSize;
  brand?: string;
  riderName?: string;
  requestToken?: string;
  answers: Record<string, string>;
  photoUrls: string[];
  address?: string;
  accessNotes?: string;
  zoneNameHe?: string | null;
  result?: SubmitResult;
}

const STORAGE_KEY = "rancho_booking_draft_v1";

const BIKE_CATEGORIES: { value: BicycleCategory; labelHe: string }[] = [
  { value: "kids", labelHe: "אופני ילדים" },
  { value: "bmx", labelHe: "BMX" },
  { value: "mtb", labelHe: "אופני הרים" },
  { value: "city", labelHe: "אופני עיר" },
  { value: "road", labelHe: "אופני כביש" },
  { value: "other", labelHe: "משהו אחר" },
];

const WHEEL_OPTIONS: { value: WheelSize; labelHe: string }[] = [
  { value: "w12", labelHe: '12"' },
  { value: "w14", labelHe: '14"' },
  { value: "w16", labelHe: '16"' },
  { value: "w18", labelHe: '18"' },
  { value: "w20", labelHe: '20"' },
  { value: "w24", labelHe: '24"' },
  { value: "w26", labelHe: '26"' },
  { value: "w275", labelHe: '27.5"' },
  { value: "w29", labelHe: '29"' },
  { value: "unknown", labelHe: "לא יודע" },
];

const STEP_ORDER: Step[] = [
  "problem",
  "bike",
  "intake",
  "photos",
  "location",
  "contact",
  "result",
];

export function BookingWizard() {
  const [state, setState] = useState<WizardState>({
    step: "problem",
    answers: {},
    photoUrls: [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time draft restore on mount
      if (saved) setState(JSON.parse(saved));
    } catch {
      /* fresh start on parse failure */
    }
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full/blocked — flow still works server-side */
    }
  }, [state]);

  const update = (patch: Partial<WizardState>) =>
    setState((s) => ({ ...s, ...patch }));

  const back = () => {
    const idx = STEP_ORDER.indexOf(state.step);
    if (idx > 0) update({ step: STEP_ORDER[idx - 1] });
  };

  const progress = STEP_ORDER.indexOf(state.step);

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6 flex flex-col gap-5">
      {STEP_ORDER.includes(state.step) && (
        <div className="flex items-center gap-2" aria-hidden>
          {STEP_ORDER.slice(0, 6).map((s, i) => (
            <span
              key={s}
              className={`h-1.5 flex-1 rounded-full ${i <= progress ? "bg-brand" : "bg-border"}`}
            />
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="text-safety-unsafe text-sm">
          {error}
        </p>
      )}

      {state.step === "problem" && (
        <StepShell title="מה קרה לאופניים?">
          <div className="flex flex-col gap-2">
            {(Object.keys(SYMPTOM_LABELS) as SymptomCategory[]).map((s) => (
              <Chip
                key={s}
                className="justify-start"
                onClick={() => update({ symptom: s, step: "bike" })}
              >
                {SYMPTOM_LABELS[s]}
              </Chip>
            ))}
          </div>
        </StepShell>
      )}

      {state.step === "bike" && (
        <StepShell title="ספרו לנו על האופניים" onBack={back}>
          <p className="font-medium">איזה סוג אופניים?</p>
          <div className="flex flex-wrap gap-2">
            {BIKE_CATEGORIES.map((c) => (
              <Chip
                key={c.value}
                selected={state.bikeCategory === c.value}
                onClick={() => update({ bikeCategory: c.value })}
              >
                {c.labelHe}
              </Chip>
            ))}
          </div>
          <Chip
            selected={state.answers._ebike === "yes"}
            onClick={() => update({ step: "out_of_scope" })}
            className="border-dashed"
          >
            אופניים חשמליים ⚡
          </Chip>
          <p className="font-medium mt-2">מה גודל הגלגל?</p>
          <p className="text-sm text-ink-muted">מופיע על הצמיג עצמו, למשל 20×2.125</p>
          <div className="flex flex-wrap gap-2">
            {WHEEL_OPTIONS.map((w) => (
              <Chip
                key={w.value}
                selected={state.wheelSize === w.value}
                onClick={() => update({ wheelSize: w.value })}
              >
                {w.labelHe}
              </Chip>
            ))}
          </div>
          <label className="flex flex-col gap-1.5 mt-2 text-sm font-medium">
            מותג (אם יודעים)
            <input
              value={state.brand ?? ""}
              onChange={(e) => update({ brand: e.target.value })}
              className="min-h-12 rounded-(--radius-control) border border-border bg-surface px-4"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            מי רוכב עליהם? (לא חובה)
            <input
              value={state.riderName ?? ""}
              onChange={(e) => update({ riderName: e.target.value })}
              className="min-h-12 rounded-(--radius-control) border border-border bg-surface px-4"
            />
          </label>
          <PrimaryButton
            disabled={!state.bikeCategory || !state.wheelSize || busy}
            onClick={async () => {
              if (state.bikeCategory === "road") {
                update({ step: "out_of_scope" });
                return;
              }
              setBusy(true);
              setError(null);
              const res = await createDraftAction({
                symptom: state.symptom!,
                bikeCategory: state.bikeCategory!,
                wheelSize: state.wheelSize!,
                brand: state.brand || undefined,
                riderName: state.riderName || undefined,
              });
              setBusy(false);
              if (res.outOfScope) update({ step: "out_of_scope" });
              else if (res.ok && res.requestToken) {
                update({ requestToken: res.requestToken, step: "intake" });
              } else setError(res.error ?? "משהו השתבש, נסו שוב");
            }}
          >
            המשך
          </PrimaryButton>
        </StepShell>
      )}

      {state.step === "intake" && state.symptom && (
        <IntakeStep
          symptom={state.symptom}
          answers={state.answers}
          onBack={back}
          busy={busy}
          onDone={async (answers) => {
            setBusy(true);
            setError(null);
            update({ answers });
            await saveAnswersAction(state.requestToken!, answers);
            setBusy(false);
            update({ step: "photos" });
          }}
        />
      )}

      {state.step === "photos" && (
        <PhotosStep
          requestToken={state.requestToken!}
          photoUrls={state.photoUrls}
          onBack={back}
          onChange={(urls) => update({ photoUrls: urls })}
          onDone={() => update({ step: "location" })}
        />
      )}

      {state.step === "location" && (
        <StepShell title="איפה אנחנו פוגשים אתכם?" onBack={back}>
          <label className="flex flex-col gap-1.5 font-medium">
            כתובת מלאה
            <input
              value={state.address ?? ""}
              onChange={(e) => update({ address: e.target.value })}
              placeholder="רחוב, מספר, עיר"
              className="min-h-12 rounded-(--radius-control) border border-border bg-surface px-4"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            הערות גישה (קומה? שער? חניה?)
            <input
              value={state.accessNotes ?? ""}
              onChange={(e) => update({ accessNotes: e.target.value })}
              className="min-h-12 rounded-(--radius-control) border border-border bg-surface px-4"
            />
          </label>
          <PrimaryButton
            disabled={!state.address || state.address.length < 3 || busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const res = await saveLocationAction({
                requestToken: state.requestToken!,
                address: state.address!,
                accessNotes: state.accessNotes,
              });
              setBusy(false);
              if (!res.ok) {
                setError(res.error ?? "משהו השתבש");
              } else if (!res.inZone) {
                update({ step: "out_of_zone" });
              } else {
                update({ zoneNameHe: res.zoneNameHe, step: "contact" });
              }
            }}
          >
            המשך
          </PrimaryButton>
        </StepShell>
      )}

      {state.step === "contact" && (
        <ContactStep
          busy={busy}
          onBack={back}
          onSubmit={async (name, phone) => {
            setBusy(true);
            setError(null);
            const res = await submitContactAction({
              requestToken: state.requestToken!,
              name,
              phone,
              timePreference: "NONE",
              photosProvided: state.photoUrls.length > 0,
            });
            setBusy(false);
            if (!res.ok) setError(res.error ?? "משהו השתבש, נסו שוב");
            else update({ result: res, step: "result" });
          }}
        />
      )}

      {state.step === "result" && state.result && (
        <ResultStep result={state.result} onRestart={() => {
          localStorage.removeItem(STORAGE_KEY);
        }} />
      )}

      {state.step === "out_of_scope" && (
        <LeadCapture
          title="כאן אנחנו עוד לא"
          body="כרגע אנחנו לא מטפלים בסוג הזה (חשמליים / כביש) — מבטיחים לעדכן כשזה ישתנה. השאירו טלפון ונחזור אליכם כשנגיע לשם."
          reason="OUT_OF_SCOPE"
          area={state.bikeCategory}
        />
      )}

      {state.step === "out_of_zone" && (
        <LeadCapture
          title="עוד לא הגענו לאזור שלכם"
          body="אנחנו כרגע בבאר שבע והסביבה (אופקים, חצרים, עומר, מיתר, כרמית). השאירו טלפון ונעדכן כשנגיע אליכם."
          reason="OUT_OF_ZONE"
          area={state.address}
        />
      )}
    </div>
  );
}

/* ------------------------------- sub-steps --------------------------------- */

function StepShell({
  title,
  children,
  onBack,
}: {
  title: string;
  children: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="חזרה"
            className="min-h-10 min-w-10 rounded-full border border-border"
          >
            →
          </button>
        )}
        <h1 className="text-2xl font-bold">{title}</h1>
      </div>
      {children}
    </div>
  );
}

function PrimaryButton(props: React.ComponentPropsWithoutRef<"button">) {
  return (
    <button
      {...props}
      className="min-h-(--tap-min) rounded-(--radius-control) bg-brand text-on-brand text-lg font-medium disabled:opacity-40 mt-2"
    />
  );
}

function IntakeStep({
  symptom,
  answers,
  onDone,
  onBack,
  busy,
}: {
  symptom: SymptomCategory;
  answers: Record<string, string>;
  onDone: (answers: Record<string, string>) => void;
  onBack: () => void;
  busy: boolean;
}) {
  const questions = INTAKE_QUESTIONS[symptom];
  const [local, setLocal] = useState(answers);

  if (questions.length === 0) {
    return (
      <StepShell title="נסתכל על זה יחד" onBack={onBack}>
        <p className="text-ink-muted">
          אין בעיה שלא יודעים להגדיר — התמונות בשלב הבא יעזרו לנו להבין.
        </p>
        <PrimaryButton disabled={busy} onClick={() => onDone(local)}>
          המשך
        </PrimaryButton>
      </StepShell>
    );
  }

  const allAnswered = questions.every((q) => local[q.key]);

  return (
    <StepShell title="כמה שאלות קצרות" onBack={onBack}>
      {questions.map((q) => (
        <div key={q.key} className="flex flex-col gap-2">
          <p className="font-medium">{q.labelHe}</p>
          <div className="flex flex-wrap gap-2">
            {q.options.map((o) => (
              <Chip
                key={o.value}
                selected={local[q.key] === o.value}
                onClick={() => setLocal((l) => ({ ...l, [q.key]: o.value }))}
              >
                {o.labelHe}
              </Chip>
            ))}
          </div>
        </div>
      ))}
      <PrimaryButton disabled={!allAnswered || busy} onClick={() => onDone(local)}>
        המשך
      </PrimaryButton>
    </StepShell>
  );
}

function PhotosStep({
  requestToken,
  photoUrls,
  onChange,
  onDone,
  onBack,
}: {
  requestToken: string;
  photoUrls: string[];
  onChange: (urls: string[]) => void;
  onDone: () => void;
  onBack: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);

  async function compress(file: File): Promise<Blob> {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.8),
      );
    } catch {
      return file; // HEIC or bitmap failure — upload original
    }
  }

  async function upload(file: File) {
    setUploading(true);
    setUploadError(null);
    setLastFile(file);
    try {
      const blob = await compress(file);
      const form = new FormData();
      form.append("file", new File([blob], "photo.jpg", { type: blob.type || "image/jpeg" }));
      form.append("requestToken", requestToken);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "ההעלאה נכשלה");
      }
      const body = (await res.json()) as { url: string };
      onChange([...photoUrls, body.url]);
      setLastFile(null);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "ההעלאה נכשלה");
    } finally {
      setUploading(false);
    }
  }

  return (
    <StepShell title="תראו לנו רגע" onBack={onBack}>
      <p className="text-ink-muted">
        שתי תמונות עוזרות לנו להגיע מוכנים: אחת של כל האופניים מהצד, ואחת קרובה
        של הבעיה.
      </p>
      <div className="flex flex-wrap gap-3">
        {photoUrls.map((url) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={url}
            src={url}
            alt="תמונה שהועלתה"
            className="w-24 h-24 object-cover rounded-(--radius-control) border border-border"
          />
        ))}
        <label className="w-24 h-24 rounded-(--radius-control) border-2 border-dashed border-border flex items-center justify-center text-3xl text-ink-muted cursor-pointer">
          {uploading ? "…" : "+"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {uploadError && (
        <div className="flex items-center gap-3">
          <p role="alert" className="text-safety-unsafe text-sm">{uploadError}</p>
          {lastFile && (
            <button
              className="text-sm underline min-h-10"
              onClick={() => upload(lastFile)}
            >
              נסו שוב
            </button>
          )}
        </div>
      )}
      <PrimaryButton disabled={uploading} onClick={onDone}>
        {photoUrls.length > 0 ? "המשך" : "אפשר גם בלי, נסתדר — המשך"}
      </PrimaryButton>
    </StepShell>
  );
}

function ContactStep({
  onSubmit,
  onBack,
  busy,
}: {
  onSubmit: (name: string, phone: string) => void;
  onBack: () => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const valid = name.trim().length >= 2 && /^0\d{8,9}$/.test(phone);

  return (
    <StepShell title="איך נהיה בקשר?" onBack={onBack}>
      <p className="text-ink-muted text-sm">
        בלי סיסמאות ובלי הרשמות — רק שם וטלפון לעדכונים על הביקור.
      </p>
      <label className="flex flex-col gap-1.5 font-medium">
        שם
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          className="min-h-12 rounded-(--radius-control) border border-border bg-surface px-4"
        />
      </label>
      <label className="flex flex-col gap-1.5 font-medium">
        טלפון נייד
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          placeholder="05X-XXXXXXX"
          className="min-h-12 rounded-(--radius-control) border border-border bg-surface px-4 text-left"
        />
      </label>
      <PrimaryButton disabled={!valid || busy} onClick={() => onSubmit(name.trim(), phone)}>
        {busy ? "רגע…" : "המשך"}
      </PrimaryButton>
    </StepShell>
  );
}

function ResultStep({
  result,
  onRestart,
}: {
  result: SubmitResult;
  onRestart: () => void;
}) {
  const a = result.assessment!;
  const price =
    a.priceType === "QUOTE" || a.priceLow == null
      ? null
      : a.priceType === "RANGE" && a.priceHigh != null && a.priceHigh !== a.priceLow
        ? `${a.priceLow / 100}–${a.priceHigh / 100} ₪`
        : `${a.priceLow / 100} ₪`;

  if (result.path === "SERVICE_REQUEST") {
    return (
      <div className="flex flex-col gap-4 text-center items-center py-6">
        <p className="font-display text-5xl text-brand">קיבלנו! 🤙</p>
        <h1 className="text-2xl font-bold">אנחנו בודקים את זה בשבילכם</h1>
        <p className="text-ink-muted max-w-sm">
          רן עובר על הפרטים והתמונות וחוזר אליכם עם מחיר וזמן — בדרך כלל תוך כמה
          שעות. העדכון יגיע בהודעה לטלפון שהשארתם.
        </p>
        <Link href="/" className="underline text-sm" onClick={onRestart}>
          חזרה לדף הבית
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      <h1 className="text-2xl font-bold">הנה מה שנראה לנו</h1>
      <Card className="flex flex-col gap-2">
        {a.serviceNamesHe.length > 0 && (
          <p className="font-bold text-lg">{a.serviceNamesHe.join(" + ")}</p>
        )}
        {price ? (
          <p>
            מחיר: <strong>{price}</strong>
            {a.confidence === "MEDIUM" && " · נדע בדיוק אחרי שנראה"}
          </p>
        ) : (
          <p>צריך לראות לפני שמתמחרים</p>
        )}
        <p className="text-sm text-ink-muted">
          בערך {a.durationEstMin} דקות אצלכם בבית
        </p>
        {a.travelCharge != null && a.travelCharge > 0 && (
          <p className="text-sm">+ תוספת הגעה {a.travelCharge / 100} ₪</p>
        )}
        {!a.travelChargeKnown && (
          <p className="text-sm text-ink-muted">כולל הגעה — נאשר סופית בתיאום</p>
        )}
      </Card>
      <Link
        href={`/book/slots?token=${result.requestToken}`}
        className="min-h-(--tap-min) rounded-(--radius-control) bg-brand text-on-brand text-lg font-medium flex items-center justify-center"
        onClick={onRestart}
      >
        מתי נוח לכם? בחרו זמן
      </Link>
      <p className="text-xs text-ink-muted text-center">
        אם נגלה משהו נוסף — נסביר, נתמחר, ולא נעבוד בלי אישור שלכם.
      </p>
    </div>
  );
}

function LeadCapture({
  title,
  body,
  reason,
  area,
}: {
  title: string;
  body: string;
  reason: "OUT_OF_ZONE" | "OUT_OF_SCOPE" | "NO_SLOT";
  area?: string;
}) {
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const valid = /^0\d{8,9}$/.test(phone);

  return (
    <div className="flex flex-col gap-4 text-center items-center py-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-ink-muted max-w-sm">{body}</p>
      {sent ? (
        <p className="font-bold text-brand">קיבלנו — נעדכן אתכם! 🤙</p>
      ) : (
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="tel"
            dir="ltr"
            placeholder="05X-XXXXXXX"
            aria-label="טלפון נייד"
            className="min-h-12 rounded-(--radius-control) border border-border bg-surface px-4 text-left"
          />
          <button
            disabled={!valid}
            onClick={async () => {
              await createLeadAction({ phone, reason, area });
              setSent(true);
            }}
            className="min-h-12 rounded-(--radius-control) bg-brand text-on-brand font-medium disabled:opacity-40"
          >
            עדכנו אותי
          </button>
        </div>
      )}
      <Link href="/" className="underline text-sm">
        חזרה לדף הבית
      </Link>
    </div>
  );
}
