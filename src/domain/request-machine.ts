import type { RequestStatus } from "./types";

/**
 * Service Request state machine (docs/STATE_MACHINES.md).
 * Pure: no IO. Callers persist the result and append a DomainEvent.
 */

export type RequestTransitionReason =
  | "NO_SLOT"
  | "ENGINE_FAILURE"
  | "EXPIRED"
  | "E_BIKE"
  | "ROAD_BIKE"
  | "SUSPENSION"
  | "WHEEL_BUILDING"
  | "WORKSHOP_CLASS"
  | "OTHER";

export type RequestActor = "customer" | "staff" | "system";

interface Rule {
  to: RequestStatus;
  actors: RequestActor[];
  requiresReason?: boolean;
}

const RULES: Record<RequestStatus, Rule[]> = {
  NEW: [
    { to: "NEEDS_REVIEW", actors: ["system", "staff"] },
    { to: "READY_TO_BOOK", actors: ["system", "staff"] },
    { to: "OUT_OF_SCOPE", actors: ["system", "staff"], requiresReason: true },
    { to: "CANCELLED", actors: ["customer", "staff"] },
  ],
  NEEDS_REVIEW: [
    { to: "NEEDS_CUSTOMER_INFO", actors: ["staff"] },
    { to: "READY_TO_BOOK", actors: ["staff"] },
    { to: "OUT_OF_SCOPE", actors: ["staff"], requiresReason: true },
    { to: "WORKSHOP_REQUIRED", actors: ["staff"], requiresReason: true },
    { to: "CANCELLED", actors: ["customer", "staff"] },
  ],
  NEEDS_CUSTOMER_INFO: [
    { to: "NEEDS_REVIEW", actors: ["customer", "staff", "system"] },
    { to: "CANCELLED", actors: ["customer", "staff"] },
  ],
  READY_TO_BOOK: [
    { to: "CONVERTED_TO_JOB", actors: ["customer", "staff"] },
    // scheduling fallback: no eligible slot / engine failure / offer expired
    { to: "NEEDS_REVIEW", actors: ["system", "staff"], requiresReason: true },
    { to: "CANCELLED", actors: ["customer", "staff"] },
  ],
  CONVERTED_TO_JOB: [],
  OUT_OF_SCOPE: [],
  WORKSHOP_REQUIRED: [],
  CANCELLED: [],
};

export interface RequestTransitionInput {
  from: RequestStatus;
  to: RequestStatus;
  actor: RequestActor;
  reason?: RequestTransitionReason;
}

export type TransitionResult =
  | { ok: true }
  | { ok: false; error: string };

export function canTransitionRequest(
  input: RequestTransitionInput,
): TransitionResult {
  const rule = RULES[input.from]?.find((r) => r.to === input.to);
  if (!rule) {
    return {
      ok: false,
      error: `illegal transition ${input.from} → ${input.to}`,
    };
  }
  if (!rule.actors.includes(input.actor)) {
    return {
      ok: false,
      error: `actor ${input.actor} may not perform ${input.from} → ${input.to}`,
    };
  }
  if (rule.requiresReason && !input.reason) {
    return {
      ok: false,
      error: `transition ${input.from} → ${input.to} requires a reason`,
    };
  }
  return { ok: true };
}

export function isTerminalRequestStatus(s: RequestStatus): boolean {
  return RULES[s].length === 0;
}
