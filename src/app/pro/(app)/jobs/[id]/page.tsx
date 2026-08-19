import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireStaff } from "@/server/auth";
import { db } from "@/server/db";
import * as schema from "@/db/schema";
import { JobRunner } from "@/components/pro/job-runner";

export const dynamic = "force-dynamic";

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) notFound();

  const d = await db();
  const jobs = await d.select().from(schema.serviceJobs).where(eq(schema.serviceJobs.id, id));
  const job = jobs[0];
  if (!job) notFound();

  const [customerR, bikeR, locationR, findings, approvals, checks, lineItems, appts, catalog, media] =
    await Promise.all([
      d.select().from(schema.customers).where(eq(schema.customers.id, job.customerId)),
      d.select().from(schema.bicycles).where(eq(schema.bicycles.id, job.bicycleId)),
      d.select().from(schema.locations).where(eq(schema.locations.id, job.locationId)),
      d.select().from(schema.findings).where(eq(schema.findings.jobId, id)),
      d.select().from(schema.approvalRecords).where(eq(schema.approvalRecords.jobId, id)),
      d.select().from(schema.safetyChecks).where(eq(schema.safetyChecks.jobId, id)),
      d.select().from(schema.jobLineItems).where(eq(schema.jobLineItems.jobId, id)),
      d.select().from(schema.appointments).where(eq(schema.appointments.jobId, id)),
      d.select().from(schema.serviceCatalogItems).where(eq(schema.serviceCatalogItems.active, true)),
      d.select().from(schema.media).where(eq(schema.media.jobId, id)),
    ]);

  const checkItems: Record<string, { checkType: string; result: string; note: string | null }[]> = {};
  for (const check of checks) {
    const rows = await d
      .select()
      .from(schema.safetyCheckItems)
      .where(eq(schema.safetyCheckItems.safetyCheckId, check.id));
    checkItems[check.phase] = rows;
  }

  // intake photos live on the request
  const intakeMedia = job.serviceRequestId
    ? await d.select().from(schema.media).where(eq(schema.media.requestId, job.serviceRequestId))
    : [];

  const appointment = appts.find((a) => a.status === "ACTIVE") ?? appts[0] ?? null;

  return (
    <JobRunner
      job={JSON.parse(JSON.stringify(job))}
      customer={JSON.parse(JSON.stringify(customerR[0] ?? null))}
      bike={JSON.parse(JSON.stringify(bikeR[0] ?? null))}
      location={JSON.parse(JSON.stringify(locationR[0] ?? null))}
      findings={JSON.parse(JSON.stringify(findings))}
      approvals={JSON.parse(JSON.stringify(approvals))}
      checkItems={checkItems}
      lineItems={JSON.parse(JSON.stringify(lineItems))}
      appointment={JSON.parse(JSON.stringify(appointment))}
      catalog={JSON.parse(JSON.stringify(catalog))}
      photos={[...intakeMedia, ...media].map((m) => ({ id: m.id, kind: m.kind }))}
    />
  );
}
