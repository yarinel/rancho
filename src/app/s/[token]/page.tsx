import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/server/db";
import * as schema from "@/db/schema";
import { rateLimit } from "@/server/rate-limit";
import {
  jobStatusView,
  requestStatusView,
  JOB_TIMELINE,
} from "@/lib/status-map";
import { fmtDate, fmtTime, shekel } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { ApprovalPrompt } from "@/components/status/approval-prompt";

export const dynamic = "force-dynamic";

/**
 * Tokenized status page — the customer's single link for the whole visit.
 * Minimal PII by design: first name + bike category only.
 */
export default async function StatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const h = await headers();
  const ip = h.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`status:${ip}`, 120, 10 * 60 * 1000)) notFound();
  if (!/^[a-f0-9]{24,64}$/.test(token)) notFound();

  const d = await db();

  const jobs = await d
    .select()
    .from(schema.serviceJobs)
    .where(eq(schema.serviceJobs.publicToken, token));
  let job = jobs[0] ?? null;

  if (!job) {
    // request token: pre-conversion status, or redirect target post-conversion
    const requests = await d
      .select()
      .from(schema.serviceRequests)
      .where(eq(schema.serviceRequests.publicToken, token));
    const request = requests[0];
    if (!request) notFound();
    if (request.status === "CONVERTED_TO_JOB") {
      const linked = await d
        .select()
        .from(schema.serviceJobs)
        .where(eq(schema.serviceJobs.serviceRequestId, request.id));
      job = linked[0] ?? null;
    }
    if (!job) {
      const view = requestStatusView(request.status);
      return (
        <StatusShell>
          <h1 className="text-2xl font-bold">{view.title}</h1>
          {view.sub && <p className="text-ink-muted">{view.sub}</p>}
          {request.status === "READY_TO_BOOK" && (
            <Link
              href={`/book/slots?token=${request.publicToken}`}
              className="min-h-12 rounded-(--radius-control) bg-brand text-on-brand font-medium flex items-center justify-center px-6"
            >
              בחרו זמן
            </Link>
          )}
          <ContactRow />
        </StatusShell>
      );
    }
  }

  const [appointmentRows, approvals, findings, lineItems, safetyRows, customer, bike] =
    await Promise.all([
      d.select().from(schema.appointments).where(eq(schema.appointments.jobId, job.id)),
      d.select().from(schema.approvalRecords).where(eq(schema.approvalRecords.jobId, job.id)),
      d.select().from(schema.findings).where(eq(schema.findings.jobId, job.id)),
      d.select().from(schema.jobLineItems).where(eq(schema.jobLineItems.jobId, job.id)),
      d.select().from(schema.safetyChecks).where(eq(schema.safetyChecks.jobId, job.id)),
      d.select().from(schema.customers).where(eq(schema.customers.id, job.customerId)),
      d.select().from(schema.bicycles).where(eq(schema.bicycles.id, job.bicycleId)),
    ]);
  const appointment = appointmentRows.find((a) => a.status === "ACTIVE");
  const view = jobStatusView(job.status);
  const pendingApprovals = approvals.filter((a) => a.decision === "PENDING");
  const firstName = customer[0]?.name.split(" ")[0] ?? "";

  const timelineIdx = JOB_TIMELINE.findIndex((t) =>
    t.statuses.includes(job.status),
  );

  return (
    <StatusShell>
      <p className="text-sm text-ink-muted">
        שלום {firstName} · {bike[0]?.nickname ?? "האופניים שלכם"}
      </p>
      <h1 className="text-2xl font-bold">{view.title}</h1>
      {view.sub && <p className="text-ink-muted">{view.sub}</p>}

      {!["CANCELLED", "UNRESOLVED"].includes(job.status) && (
        <ol className="flex items-center gap-1 my-2" aria-label="שלבי הביקור">
          {JOB_TIMELINE.map((t, i) => (
            <li key={t.label} className="flex-1 flex flex-col items-center gap-1">
              <span
                className={`h-2 w-full rounded-full ${i <= timelineIdx ? "bg-brand" : "bg-border"}`}
              />
              <span className="text-[11px] text-ink-muted">{t.label}</span>
            </li>
          ))}
        </ol>
      )}

      {appointment && ["SCHEDULED", "EN_ROUTE"].includes(job.status) && (
        <Card className="flex flex-col gap-1">
          <p className="font-bold">
            {fmtDate(appointment.windowStart)} · {fmtTime(appointment.windowStart)}–
            {fmtTime(appointment.windowEnd)}
          </p>
          {job.expectedTotal != null && (
            <p className="text-sm">
              צפי מחיר:{" "}
              <strong>
                {job.expectedTotalHigh != null &&
                job.expectedTotalHigh !== job.expectedTotal
                  ? `${job.expectedTotal / 100}–${job.expectedTotalHigh / 100} ₪`
                  : shekel(job.expectedTotal)}
              </strong>
              {job.travelCharge > 0 && ` + הגעה ${job.travelCharge / 100} ₪`}
            </p>
          )}
          {job.priceNoteHe && (
            <p className="text-xs text-ink-muted">{job.priceNoteHe}</p>
          )}
        </Card>
      )}

      {pendingApprovals.length > 0 && job.status === "AWAITING_APPROVAL" && (
        <div className="flex flex-col gap-3">
          {pendingApprovals.map((a) => (
            <ApprovalPrompt
              key={a.id}
              jobToken={job.publicToken}
              approval={{
                id: a.id,
                proposedWorkHe: a.proposedWorkHe,
                explanationHe: a.explanationHe,
                priceShekels: a.price / 100,
              }}
            />
          ))}
        </div>
      )}

      {job.status === "COMPLETED" && (
        <CompletionSummary
          job={job}
          lineItems={lineItems}
          findings={findings}
          safetyDone={safetyRows.some((s) => s.phase === "FINAL" && s.completedAt)}
        />
      )}

      <ContactRow />
    </StatusShell>
  );
}

function StatusShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 mx-auto w-full max-w-md px-4 py-8 flex flex-col gap-4">
      {children}
      <p className="text-xs text-ink-muted text-center mt-4">
        רנצ&apos;ו · תיקוני אופניים עד הבית
      </p>
    </main>
  );
}

function ContactRow() {
  const phone = process.env.NEXT_PUBLIC_RANCHO_PHONE ?? "0500000000";
  return (
    <p className="text-sm text-ink-muted">
      צריכים לשנות או לבטל?{" "}
      <a className="underline" href={`https://wa.me/972${phone.slice(1)}`}>
        דברו איתנו
      </a>{" "}
      ·{" "}
      <a className="underline" href={`tel:${phone}`}>
        חייגו
      </a>
    </p>
  );
}

function CompletionSummary({
  job,
  lineItems,
  findings,
  safetyDone,
}: {
  job: typeof schema.serviceJobs.$inferSelect;
  lineItems: (typeof schema.jobLineItems.$inferSelect)[];
  findings: (typeof schema.findings.$inferSelect)[];
  safetyDone: boolean;
}) {
  const actual = lineItems.filter((li) => li.kind === "ACTUAL");
  const openRecommendations = findings.filter((f) => !f.resolvedInJob);
  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col gap-2">
        <p className="font-bold">מה עשינו</p>
        <ul className="text-sm flex flex-col gap-1">
          {(actual.length > 0 ? actual : lineItems).map((li) => (
            <li key={li.id} className="flex justify-between">
              <span>{li.label}</span>
              <span>{shekel(li.price)}</span>
            </li>
          ))}
        </ul>
        {job.finalAmount != null && (
          <p className="font-bold border-t border-border pt-2 flex justify-between">
            <span>סה&quot;כ</span>
            <span>{shekel(job.finalAmount)}</span>
          </p>
        )}
        {safetyDone && (
          <p className="text-sm text-safety-ok">
            עברו בדיקת בטיחות מלאה: קראנק, כידון, גלגלים, בלמים והילוכים
          </p>
        )}
      </Card>
      {(job.beforeMediaId || job.afterMediaId) && (
        <div className="flex gap-3">
          {job.beforeMediaId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/media/${job.beforeMediaId}`} alt="לפני" className="w-1/2 rounded-(--radius-card)" />
          )}
          {job.afterMediaId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/media/${job.afterMediaId}`} alt="אחרי" className="w-1/2 rounded-(--radius-card)" />
          )}
        </div>
      )}
      {openRecommendations.length > 0 && (
        <Card className="flex flex-col gap-1">
          <p className="font-bold text-safety-attention">נשאר פתוח לפעם הבאה</p>
          {openRecommendations.map((f) => (
            <p key={f.id} className="text-sm">
              {f.titleHe}
              {f.proposedPrice != null && ` · ${shekel(f.proposedPrice)}`}
            </p>
          ))}
        </Card>
      )}
      {job.maintenanceTipHe && (
        <Card>
          <p className="font-bold">טיפ תחזוקה מרן</p>
          <p className="text-sm">{job.maintenanceTipHe}</p>
        </Card>
      )}
      <Link
        href={`/book?rebook=${job.publicToken}`}
        className="min-h-12 rounded-(--radius-control) bg-brand text-on-brand font-medium flex items-center justify-center"
      >
        קבעו תיקון נוסף
      </Link>
    </div>
  );
}
