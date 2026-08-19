# Rancho RideCare — Roadmap & Acceptance Criteria

Execution contract for the P0 build. Source of truth: the approved Phase 0 plan (approved 2026-08-18, "approved with defaults": O1 tire pricing parked as QUOTE; TBD values configurable and marked TBD). Milestones are small, sequential, each independently reviewable; **one milestone at a time**. Acceptance criteria below are copied from the plan verbatim in substance — do not weaken them.

## Current status

| Milestone | Status |
|---|---|
| M0–M12 | **Complete** (2026-08-19) — see PROGRESS.md |

## P0 milestones

### M0 — Foundation *(complete)*
Repo, Next.js+TS+Tailwind v4+Drizzle+Supabase wiring, CI, RTL root + tokens v1 (pending C1 confirmation), base components, docs scaffolding + CLAUDE.md.

**Accept:** CI green; RTL Hebrew landing renders from tokens; migrations run on a clean DB; Playwright mobile smoke passes.

### M1 — Domain core & schema
All plan-E entities + exclusion constraint migrated; both state machines as pure functions with exhaustive transition tests (incl. visit-fee path, UNRESOLVED reasons, READY_TO_BOOK→NEEDS_REVIEW); seeds: ✅ catalogue rows active, ⚠️ rows inactive/QUOTE, 6 zones (TBD-marked config), technician + start location.

**Accept:** every legal/illegal transition covered incl. all F guards (safety completeness, payment amount guard, N/A-gears rule); seeds idempotent.

### M2 — Staff auth & Pro shell
Supabase auth, staff gate on all `/pro` routes AND server actions, Pro nav shell, settings CRUD (services/zones/availability incl. start location).

**Accept:** unauthenticated access impossible at the action level (tested); a price edit reflects in catalogue reads; audit rows on every edit.

### M3 — Booking intake
Steps 1–7; anonymous draft persisted from step 2, household attach at contact; photo pipeline (compression, progress, retry); GeoProvider + dev fallback; out-of-scope (e-bike/road/אחר) and out-of-zone exits with Lead persistence.

**Accept:** mobile E2E completes intake with 2 photos on throttled network; refresh resumes; e-bike, road-bike, and out-of-zone paths each persist a Lead and show correct copy; no password anywhere.

### M4 — Assessment engine
Deterministic rules → expected services, duration, price type, confidence, rationale; LOW → request path.

**Accept:** fixture table (≥12 cases incl. Scenario B) passes; ambiguous input never instant-books; wheel sizes outside 20"–26" yield MEDIUM range per plan-K.

### M5 — Scheduling + booking commit
Candidate gen, Stage-1 constraints (incl. first-job travel from start location, whole-block window rule), ranking, windows, fallback; slots UI; confirm → full eligibility recheck in tx + exclusion constraint → Appointment + Job(SCHEDULED) + confirmation + status token; stale-slot alternatives screen.

**Accept:** fixtures: Scenario F (free-but-infeasible ⇒ INELIGIBLE with reason), day-boundary block, first-job travel, no-slot fallback → request NEEDS_REVIEW(NO_SLOT); race test: two concurrent confirmations of *overlapping* slots → exactly one succeeds, the other receives alternatives; zone-day-disabled-after-offer test passes.

### M6 — Status page
`/s/[token]` with the complete internal→customer mapping table from plan G-12 (every F state covered), change/cancel contact affordance, NotificationProvider + DevConsole, event-log wiring.

**Accept:** every reachable job state renders a defined customer text (snapshot test over the full mapping); tokens unguessable + rate-limited; no internal state names leak.

### M7 — Pro Today & job runner (happy path)
Today list + deep links + at-risk flags; runner stages through payment/completion for jobs **without findings**; departure tap; visit-fee and UNRESOLVED outcomes; cancel with reason.

**Accept:** Scenario A minus findings green E2E on mobile viewport; safety guard blocks completion with an incomplete final check; GEARS N/A only for gearless (writes has_gears); UNRESOLVED requires reason and releases the calendar block (fixture); at-risk flag appears when actuals project lateness.

### M8 — Findings & additional-work approval
Finding creation (incl. UNSAFE auto-create from inspection), proposal → in-person + link approval → immutable ApprovalRecord → actual line items unlock; declined/deferred paths mark bike recommendations; payment upward-edit guard live end-to-end; customer-part refusal path.

**Accept:** Scenario C green E2E; approval records immutable (mutation attempts rejected); job cannot reach FINAL_SAFETY_CHECK with undecided findings; final amount above approved total rejected without approval (tested); all-declined path ends in visit-fee COMPLETED.

### M9 — Requests inbox
Review queue, clarify templates (copy-to-WhatsApp), price/duration set → READY_TO_BOOK → customer booking link; out-of-scope/workshop-required actions.

**Accept:** Scenario B green end-to-end: ambiguous intake → NEEDS_REVIEW → operator prices → customer books through the normal slots flow.

### M10 — History, bike cards & returning path
Completion writes the service record; bike card with history + unresolved flags; `/pro/search` + household view; customer re-booking CTA from the completion view (token seeds bike+location).

**Accept:** Scenario E green both sides: operator finds household by phone and books skipping re-entry; customer's "קבעו תיקון נוסף" pre-fills bike+location; unresolved UNSAFE finding from job 1 visible on job 2's Pro view.

### M11 — Manual calendar control
Day/week calendar, blocks (range/day/zone-day), manual booking → DRAFT job, move/extend/cancel with conflict warnings + customer-notify prompts, override-with-reason.

**Accept:** zone-day block removes slots from engine output (fixture); moving a confirmed job requires explicit confirm + audit + notification event; override reason stored; cancel from calendar releases the block.

### M12 — Hardening & production readiness
Error/empty/loading states, network-failure retries, a11y pass, RTL audit (mixed Hebrew/English strings, ₪ rendering), rate limiting on public endpoints, token/upload/authz security review, performance, docs current, all scenarios in CI.

**Accept:** scenarios A–F green in CI; Lighthouse mobile on booking flow: accessibility ≥ 90 **and performance ≥ 80** (equivalently LCP ≤ 2.5s on emulated mid-tier mobile, also measured on `/pro`); zero PII in logs verified; audit checklist (accessibility, RTL, mobile, outdoor use, validation, permissions, security, error/loading/empty states, network failure, performance) completed with written results in PROGRESS.md.

## E2E scenario appendix (referenced by the acceptance criteria)

- **A — Simple puncture**: new customer → puncture → new bike → photo → expected service+price → smart slot → Pro: inspect → repair → safety check → complete → history updated.
- **B — Ambiguous problem**: noise/gears symptom, insufficient info → no invented diagnosis → Service Request → operator review → priced → booked.
- **C — Additional work**: technician finds extra issue → customer receives proposal+price → approves → approval recorded → final job reflects approved work.
- **D — Unsupported area**: address outside active zones → no appointment offered → useful next action (Lead).
- **E — Returning household**: known bike chosen → onboarding skipped → history available.
- **F — Invalid smart slot**: calendar-free but travel-infeasible slot → INELIGIBLE → never shown regardless of score.

## P0 scope statement

**P0 — the complete loop, nothing else**: guest booking (problem→bike→intake→photos→location→contact→assessment→slots-or-request→confirm→status); deterministic assessment, 3 confidence levels; instant-book vs service-request split; scheduling engine (eligibility, ranking, windows, commit-time recheck, fallback); customer status page with full state mapping, change/cancel affordance, approval screen, completion summary + token-based re-booking; Rancho Pro (Today with at-risk flags, requests inbox, 10-step job runner incl. visit-fee and unresolved outcomes, approvals, payment recording with amount guards, completion, calendar with blocks/moves/cancels/overrides, household search, bike cards, settings); household/bike/history model; photos; Lead capture; staff auth (single gate); Hebrew RTL throughout; scenarios A–F green.

*Deliberate P0 exclusions (recorded decisions)*: rider-culture content is limited to the maintenance-tip line (the kid-facing "שלוש בדיקות לפני רכיבה" card ships in P1 — the pillar is otherwise expressed off-product); automated overrun re-optimization deferred (manual notify/move in P0); inventory table deferred (line-item chips instead).

## P1

Customer OTP/magic-link + My Bikes; WhatsApp Business API + SMS provider (activates the outbox); routing/ETA provider; payment provider (Bit/Grow/Meshulam — business decision); inventory + Daily Loadout; waitlist + cancellation-slot recovery; video intake; while-you-are-here; self-service rescheduling; reminder automation; kid-facing 3-check card in the completion summary.

## P2

AI-assisted intake classification/summarization (assistive only — never a safety authority); predictive maintenance; multi-technician dispatch + skills + role-based authorization; demand forecasting; purchasing; loyalty/community/events; shop/custom ecosystem.

## Standing TBDs affecting milestones

Approved defaults in force; each remains configurable and TBD-marked until answered (see plan sections C/K/O):

- **O1/C3/Q-b** — tire replacement pricing semantics: parked as **QUOTE** (catalogue row inactive/QUOTE-typed) until answered. Affects M1 seeds.
- **Q-a/T3** — tube/tire prices outside 20"–26": MEDIUM confidence range 80–110₪. Affects M1/M4.
- **Q-c/T4** — cables/pedals part inclusion: seeded "includes standard part", flagged. Affects M1.
- **Q-d/T1** — visit/diagnosis fee: placeholder 60₪, credited on repair, marked TBD; needed before launch. Affects M1/M7.
- **T2** — travel surcharge per non-B7 zone: no seeded values; non-B7 zones show MEDIUM confidence with "כולל הגעה — נאשר סופית בתיאום". Affects M1/M4/M5.
- **C1** — brand direction: price-list black/fuchsia street identity confirmed as default; **confirm before Phase 1 tokens are final**. Affects M0 tokens.
- **T5** — workshop-class requests: WORKSHOP_REQUIRED terminal with honest copy, operator follows up manually. Affects M9.
- **T6** — warranty terms/duration: free-text policy line, TBD. Affects M7/M8 completion copy.
- **Maps provider (O7)** — Google approved; API key + billing needed at M3.
- **Stack (O8)** — Supabase + Vercel approved; project credentials needed at M0.
