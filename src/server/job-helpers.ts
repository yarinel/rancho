import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import type { JobContext } from "@/domain/job-machine";
import type { RequestForScheduling } from "@/server/scheduling";

export function emptyJobContext(): JobContext {
  return {
    bikeHasGears: null,
    findings: [],
    approvals: [],
    safetyChecks: [],
    lineItems: [],
    paymentState: "PENDING",
    finalAmount: null,
    amountAdjustReason: null,
    expectedTotal: null,
    travelCharge: 0,
    visitFee: 6000,
    hasAfterPhoto: false,
    afterPhotoSkipReason: null,
    hasActiveAppointment: true,
    retroactive: false,
  };
}

export function requestForScheduling(
  _d: Db,
  request: typeof schema.serviceRequests.$inferSelect,
): RequestForScheduling | null {
  const a = request.assessment;
  const answers = request.intakeAnswers;
  if (!a || !answers._zone_id || !answers._lat || !answers._lng) return null;
  return {
    id: request.id,
    zoneId: answers._zone_id,
    lat: Number(answers._lat),
    lng: Number(answers._lng),
    blockDurationMin: a.blockDurationMin,
    urgency: request.urgency === "URGENT" ? "URGENT" : "NORMAL",
    timePreference: request.timePreference as never,
  };
}
