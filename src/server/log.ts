import type { Db } from "@/db/client";
import * as schema from "@/db/schema";

/** Append-only domain event (powers status page, audit, metrics). */
export async function logEvent(
  d: Db,
  entity: string,
  entityId: string,
  event: string,
  actor: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await d.insert(schema.domainEvents).values({
    entity,
    entityId,
    event,
    actor,
    payload,
  });
}

export async function logAudit(
  d: Db,
  staffUserId: string | null,
  action: string,
  entity: string | null,
  entityId: string | null,
  detail: Record<string, unknown> = {},
): Promise<void> {
  await d.insert(schema.auditLog).values({
    staffUserId,
    action,
    entity,
    entityId,
    detail,
  });
}
