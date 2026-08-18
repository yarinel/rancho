# State Machines — Service Request & Service Job

Source of truth: approved Phase 0 plan, section F (plan approved 2026-08-18 with defaults). Entity fields referenced here are defined in `/docs/DATA_MODEL.md`. These machines are implemented in milestone M1 (M0 — foundation — is in progress; no machine code exists yet).

## Implementation contract

- Pure domain functions: `transition(entity, event, actor, data)` with an allowed-transitions table, actor guards, and required-data guards. Zero framework imports.
- Every transition appends a `DomainEvent` (entity, event, payload, actor, at).
- No UI mutates status directly — all mutations pass through the domain layer.
- M1 acceptance: exhaustive tests for every legal and illegal transition, including the visit-fee path, all UNRESOLVED reasons, READY_TO_BOOK→NEEDS_REVIEW, and every guard below.
- Internal state names never leak to customers; the internal→customer text mapping lives in the status-page spec (plan G-12, built in M6).

## Actors

| Actor | Meaning |
|---|---|
| CUSTOMER | Guest — acts via tokenized status/approval pages (`/s/[token]`, `/s/[token]/approve/[approvalId]`), or in person on the technician's device (approver name recorded). |
| OPERATOR | Authenticated staff performing office actions (requests inbox, calendar, cancellations). |
| TECHNICIAN | Authenticated staff performing on-site actions (job runner). |
| SYSTEM | Assessment engine, scheduling engine/fallback, booking commit. |

P0 note: there is a single authenticated-staff gate (role column dormant), so OPERATOR and TECHNICIAN are the same person in P0. The distinction documents intent for the dormant role model; it is not enforced as separate permissions in P0.

---

## Service Request

```
 NEW --auto--> NEEDS_REVIEW <------> NEEDS_CUSTOMER_INFO
  |               |    ^
  |      operator |    | fallback: NO_SLOT | ENGINE_FAILURE | EXPIRED
  |        prices |    |
  |               v    |
  +----auto----> READY_TO_BOOK --customer books--> CONVERTED_TO_JOB

 Terminals:
   NEW | NEEDS_REVIEW  --> OUT_OF_SCOPE
   NEEDS_REVIEW        --> WORKSHOP_REQUIRED   (P0 terminal; operator handles manually)
   any pre-conversion  --> CANCELLED
```

### Transitions

| From → To | Actor | Trigger / guard |
|---|---|---|
| NEW → READY_TO_BOOK | SYSTEM | Auto, only when ALL hold: assessment confidence HIGH or MEDIUM + service `instant_book_eligible` + active zone. |
| NEW → NEEDS_REVIEW | SYSTEM | Auto when the instant-book conditions do not hold. **LOW confidence always lands here — ambiguity never auto-schedules.** |
| NEEDS_REVIEW → NEEDS_CUSTOMER_INFO | OPERATOR | Ask-for-info (template → copy-to-WhatsApp). |
| NEEDS_CUSTOMER_INFO → NEEDS_REVIEW | OPERATOR | Operator records the customer's answer (WhatsApp is the channel in P0). |
| NEEDS_REVIEW → READY_TO_BOOK | OPERATOR | Operator sets expected service, price, and duration; customer receives the booking link. |
| READY_TO_BOOK → CONVERTED_TO_JOB | CUSTOMER | Customer books a slot (booking commit succeeds). |
| READY_TO_BOOK → NEEDS_REVIEW | SYSTEM | Scheduling fallback — reason required: `NO_SLOT` (7→14-day widening found nothing), `ENGINE_FAILURE`, or `EXPIRED`. Never a dead end for the customer. |
| NEW \| NEEDS_REVIEW → OUT_OF_SCOPE | SYSTEM / OPERATOR | Intake auto-detection (e-bike, road bike) or operator inbox action (e-bike, suspension, wheel building, road bike). Respectful out-of-scope copy; never silently booked. |
| NEEDS_REVIEW → WORKSHOP_REQUIRED | OPERATOR | Workshop-class work (cranks, bleeding, …). P0 terminal with honest copy; operator follows up manually (T5). |
| any pre-conversion state → CANCELLED | OPERATOR | Customer-initiated cancellations arrive via the contact channel and are recorded by the operator. |

---

## Service Job

### Main flow

```
 DRAFT
   |
   v
 SCHEDULED <------> RESCHEDULED      (each move issues a new ACTIVE appointment;
   |                                  superseded appointments are retained)
   | technician: "יצאתי"
   v
 EN_ROUTE
   | technician: "הגעתי"  (arrived_at)
   v
 ARRIVED
   |
   v
 INSPECTION ------------------------+
   |    ^                           |  nothing beyond
   v    |                           |  expected work
 AWAITING_APPROVAL                  |
   ^    |                           |
   |    v                           v
 IN_SERVICE <-----------------------+
   |
   v  [G1: every finding decided]
 FINAL_SAFETY_CHECK
   |
   v  [G2: FINAL safety check complete]
 PAYMENT_PENDING
   |
   v  [G3: payment recorded  G4: after-photo or skip-reason]
 COMPLETED
```

### Decline-after-diagnosis (visit-fee) path — first-class, not an exception

```
 INSPECTION | AWAITING_APPROVAL --(customer declines ALL proposed work)--> PAYMENT_PENDING --> COMPLETED
```

### Other exits

```
 DRAFT | SCHEDULED | EN_ROUTE                            --> CANCELLED
 ARRIVED | INSPECTION | AWAITING_APPROVAL | IN_SERVICE   --> UNRESOLVED
```

### Transitions

| From → To | Actor | Trigger / guard |
|---|---|---|
| DRAFT → SCHEDULED | SYSTEM / OPERATOR | Customer booking commit (full Stage-1 eligibility recheck in the transaction + the Appointment GiST exclusion constraint — see `/docs/SCHEDULING.md`), or operator manual booking from the calendar (minimal form → DRAFT job; override-with-reason for engine-ineligible placements). |
| SCHEDULED ⇄ RESCHEDULED | OPERATOR | Calendar move/extend, or customer request via the status-page contact affordance. New ACTIVE appointment; superseded appointments retained. Moving a confirmed job requires explicit confirm + audit + customer-notify prompt. |
| SCHEDULED → EN_ROUTE | TECHNICIAN | "יצאתי" tap on Today. |
| EN_ROUTE → ARRIVED | TECHNICIAN | "הגעתי" tap; `arrived_at` timestamp. |
| ARRIVED → INSPECTION | TECHNICIAN | Runner opening stages (initial-ride and dust-cleaning toggles), then the 5-item safety check. |
| INSPECTION → IN_SERVICE | TECHNICIAN | Nothing found beyond the expected work. |
| INSPECTION ⇄ AWAITING_APPROVAL | TECHNICIAN out, CUSTOMER back | Technician proposes fix + price per finding ("בקש אישור"); customer decides IN_PERSON (tap on technician's phone, approver name recorded) or via LINK (status-page approval screen). Decision writes an immutable `ApprovalRecord` (APPROVED / DECLINED / DEFERRED). |
| IN_SERVICE ⇄ AWAITING_APPROVAL | TECHNICIAN out, CUSTOMER back | Same mechanics for mid-work findings. |
| IN_SERVICE → FINAL_SAFETY_CHECK | TECHNICIAN | Guard **G1**. |
| FINAL_SAFETY_CHECK → PAYMENT_PENDING | TECHNICIAN | Guard **G2**. |
| PAYMENT_PENDING → COMPLETED | TECHNICIAN | Guards **G3** + **G4**. |
| INSPECTION \| AWAITING_APPROVAL → PAYMENT_PENDING | TECHNICIAN | Visit-fee path ("סיום ביקור — דמי ביקור") when the customer declines all proposed work. Guards **VF1–VF4** below. |
| DRAFT \| SCHEDULED \| EN_ROUTE → CANCELLED | OPERATOR | Operator action, or customer request via contact. Reason required; audited; appointment block released. |
| ARRIVED \| INSPECTION \| AWAITING_APPROVAL \| IN_SERVICE → UNRESOLVED | TECHNICIAN | Reason mandatory (enum below). Guards **U1–U3**. Audited; appointment block released. |

Retroactive jobs: operator-created retroactive jobs may skip EN_ROUTE/ARRIVED (reason required); they are excluded from travel/duration calibration data.

### Guards (the non-negotiables, encoded)

**G1 — Finding completeness (→ FINAL_SAFETY_CHECK).** Every finding must be decided: REPAIRED, DECLINED (with ApprovalRecord), or DEFERRED (customer-recorded). A job cannot reach FINAL_SAFETY_CHECK with undecided findings.

**G2 — Safety completeness (→ PAYMENT_PENDING).** The FINAL-phase safety check must be complete:
- All 5 items have a result: CRANK, STEM_HANDLEBAR, WHEELS_AXLES, BRAKES, GEARS.
- **GEARS N/A rule**: NOT_APPLICABLE is legal only for GEARS, and only when `bicycle.has_gears = false`. The technician's N/A tap ("אין הילוכים") writes `has_gears = false` back to the bicycle. No other item may be N/A.
- Any UNSAFE result requires a linked finding that is either repaired or explicitly customer-acknowledged; acknowledgment sets `follow_up_required = true`.
- Phases are separate records (INSPECTION vs FINAL): inspection-phase UNSAFE results are preserved, so "found unsafe, repaired, now OK" keeps both truths.

**G3 — Payment amount guard (payment recording / any amount edit).** `final_amount ≤ sum(approved line items)`:
- Downward edits always allowed **with a reason** (goodwill/discount) — audited.
- Any upward edit beyond the approved total is **rejected** unless a matching APPROVED `ApprovalRecord` exists. Tolerance configurable, default 0₪. This closes the "edit the number at the end" bypass.
- Payment state must be recorded (one of the payment states, incl. WAIVED) before COMPLETED.

**G4 — After-photo rule (→ COMPLETED).** After-photo present, or an explicit skip-with-reason. On the visit-fee path the skip-reason "no work performed" is set automatically.

**G5 — Approval requirement on line items.** Additional ACTUAL line items above the approved total require an APPROVED `ApprovalRecord` (same configurable tolerance, default 0₪; a documented exception hook exists per the brief). ApprovalRecords are immutable once decided.

**VF — Visit-fee path guards (INSPECTION | AWAITING_APPROVAL → PAYMENT_PENDING):**
- VF1: line items reduce to the configurable visit fee — chargeable or explicitly WAIVED. Fee amount is **TBD** (T1/Q-d): configurable, placeholder 60₪; per approved defaults it is credited against a same-visit repair, final value still TBD before launch.
- VF2: the inspection-phase safety check must still be recorded.
- VF3: findings persist on the bicycle as open recommendations.
- VF4: the after-photo guard is satisfied by the automatic "no work performed" skip-reason.
- The job ends **COMPLETED** (the visit resolved commercially) with `resolution.first_visit_resolved` exclusion_reason = `CUSTOMER_DECLINED`.

**U — UNRESOLVED guards:**
- U1: reason mandatory. Section F enum: `NO_SHOW | PART_UNAVAILABLE | SAFETY_STOP | CUSTOMER_ABORTED | OTHER`.
- U2: if inspection had begun, recorded safety findings are preserved.
- U3: visit-fee payment recorded or explicitly WAIVED where applicable; the appointment block is released.
- Note: an "all work declined" visit is not UNRESOLVED — it ends via the visit-fee path above. **TBD (reconcile at M1):** the plan's data model (§E) lists the `unresolved_reason` field enum as `NO_SHOW | ALL_WORK_DECLINED | PART_UNAVAILABLE | SAFETY_STOP | OTHER`, while §F's transition (authoritative for this file) lists `CUSTOMER_ABORTED` and no `ALL_WORK_DECLINED`.

### `follow_up_required` — a flag, not a state

- `follow_up_required` is a boolean on ServiceJob. A job can be paid, COMPLETED, and still need a follow-up — completion is never blocked by it.
- Set when a FINAL-check UNSAFE item is customer-acknowledged rather than repaired (G2), and used for warranty/complaint follow-ups (complaint flow: inspect first, then classify warranty vs new damage; Rancho errors fixed immediately — full complaint module is post-P0).
- The follow-up visit is a **new** ServiceJob linked to this one via `originating_job_id` (ServiceJob 0..1—1 ServiceJob).
