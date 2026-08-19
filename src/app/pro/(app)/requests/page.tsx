import { desc, inArray } from "drizzle-orm";
import { requireStaff } from "@/server/auth";
import { db } from "@/server/db";
import * as schema from "@/db/schema";
import { Card } from "@/components/ui/card";
import { RequestReviewCard } from "@/components/pro/request-review";
import { SYMPTOM_LABELS } from "@/domain/intake";

export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  await requireStaff();
  const d = await db();
  const requests = await d
    .select()
    .from(schema.serviceRequests)
    .where(
      inArray(schema.serviceRequests.status, [
        "NEW",
        "NEEDS_REVIEW",
        "NEEDS_CUSTOMER_INFO",
        "READY_TO_BOOK",
      ]),
    )
    .orderBy(desc(schema.serviceRequests.updatedAt));

  const customerIds = requests
    .map((r) => r.customerId)
    .filter((x): x is string => !!x);
  const customers = customerIds.length
    ? await d.select().from(schema.customers).where(inArray(schema.customers.id, customerIds))
    : [];
  const customerBy = new Map(customers.map((c) => [c.id, c]));

  const requestIds = requests.map((r) => r.id);
  const media = requestIds.length
    ? await d.select().from(schema.media).where(inArray(schema.media.requestId, requestIds))
    : [];

  const leads = await d
    .select()
    .from(schema.leads)
    .where(inArray(schema.leads.status, ["NEW"]))
    .orderBy(desc(schema.leads.createdAt));

  return (
    <div className="p-4 flex flex-col gap-3">
      <h1 className="text-xl font-bold">בקשות · {requests.length}</h1>
      {requests.length === 0 && (
        <Card><p className="text-ink-muted">אין בקשות שממתינות לטיפול.</p></Card>
      )}
      {requests.map((r) => {
        const customer = r.customerId ? customerBy.get(r.customerId) : null;
        return (
          <RequestReviewCard
            key={r.id}
            request={{
              id: r.id,
              publicToken: r.publicToken,
              status: r.status,
              statusReason: r.statusReason,
              symptomHe:
                SYMPTOM_LABELS[r.symptomCategory as keyof typeof SYMPTOM_LABELS] ??
                r.symptomCategory,
              answers: r.intakeAnswers,
              assessment: r.assessment,
              customerName: customer?.name ?? "אורח (טרם השאיר פרטים)",
              customerPhone: customer?.phone ?? null,
              photoIds: media.filter((m) => m.requestId === r.id).map((m) => m.id),
              updatedAt: r.updatedAt.toISOString(),
            }}
          />
        );
      })}
      {leads.length > 0 && (
        <>
          <h2 className="text-lg font-bold mt-4">לידים · {leads.length}</h2>
          {leads.map((l) => (
            <Card key={l.id} className="text-sm flex flex-col gap-1">
              <p className="font-medium" dir="ltr">{l.phone}</p>
              <p className="text-ink-muted">
                {l.reason === "OUT_OF_ZONE"
                  ? `מחוץ לאזור: ${l.area ?? ""}`
                  : l.reason === "OUT_OF_SCOPE"
                    ? `מחוץ לתחום: ${l.area ?? ""}`
                    : "לא נמצא זמן פנוי"}
              </p>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
