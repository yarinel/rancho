import { describe, expect, it } from "vitest";
import {
  canTransitionRequest,
  isTerminalRequestStatus,
} from "./request-machine";
import { REQUEST_STATUSES, type RequestStatus } from "./types";

const LEGAL: Array<[RequestStatus, RequestStatus]> = [
  ["NEW", "NEEDS_REVIEW"],
  ["NEW", "READY_TO_BOOK"],
  ["NEW", "OUT_OF_SCOPE"],
  ["NEW", "CANCELLED"],
  ["NEEDS_REVIEW", "NEEDS_CUSTOMER_INFO"],
  ["NEEDS_REVIEW", "READY_TO_BOOK"],
  ["NEEDS_REVIEW", "OUT_OF_SCOPE"],
  ["NEEDS_REVIEW", "WORKSHOP_REQUIRED"],
  ["NEEDS_REVIEW", "CANCELLED"],
  ["NEEDS_CUSTOMER_INFO", "NEEDS_REVIEW"],
  ["NEEDS_CUSTOMER_INFO", "CANCELLED"],
  ["READY_TO_BOOK", "CONVERTED_TO_JOB"],
  ["READY_TO_BOOK", "NEEDS_REVIEW"],
  ["READY_TO_BOOK", "CANCELLED"],
];

describe("request machine", () => {
  it("allows exactly the legal transition set (staff actor, reason given)", () => {
    for (const from of REQUEST_STATUSES) {
      for (const to of REQUEST_STATUSES) {
        if (from === to) continue;
        const expected = LEGAL.some(([f, t]) => f === from && t === to);
        const res = canTransitionRequest({
          from,
          to,
          actor: "staff",
          reason: "OTHER",
        });
        expect(res.ok, `${from} → ${to}`).toBe(expected);
      }
    }
  });

  it("terminal states have no exits", () => {
    for (const s of [
      "CONVERTED_TO_JOB",
      "OUT_OF_SCOPE",
      "WORKSHOP_REQUIRED",
      "CANCELLED",
    ] as const) {
      expect(isTerminalRequestStatus(s)).toBe(true);
    }
  });

  it("scheduling fallback READY_TO_BOOK → NEEDS_REVIEW requires a reason", () => {
    expect(
      canTransitionRequest({
        from: "READY_TO_BOOK",
        to: "NEEDS_REVIEW",
        actor: "system",
      }).ok,
    ).toBe(false);
    expect(
      canTransitionRequest({
        from: "READY_TO_BOOK",
        to: "NEEDS_REVIEW",
        actor: "system",
        reason: "NO_SLOT",
      }).ok,
    ).toBe(true);
  });

  it("customers cannot review or price requests", () => {
    expect(
      canTransitionRequest({
        from: "NEEDS_REVIEW",
        to: "READY_TO_BOOK",
        actor: "customer",
      }).ok,
    ).toBe(false);
    expect(
      canTransitionRequest({
        from: "NEW",
        to: "OUT_OF_SCOPE",
        actor: "customer",
        reason: "E_BIKE",
      }).ok,
    ).toBe(false);
  });

  it("out-of-scope and workshop-required demand a reason", () => {
    expect(
      canTransitionRequest({ from: "NEW", to: "OUT_OF_SCOPE", actor: "staff" })
        .ok,
    ).toBe(false);
    expect(
      canTransitionRequest({
        from: "NEEDS_REVIEW",
        to: "WORKSHOP_REQUIRED",
        actor: "staff",
      }).ok,
    ).toBe(false);
  });
});
