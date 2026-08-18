# Scheduling Engine (P0)

Spec for the smart-scheduling domain module, per the approved Phase 0 plan (section I; approved 2026-08-18 with defaults). Implementation lands at milestone M5; M0 (foundation) is in progress. Module home: `/src/domain/scheduling` — a pure, unit-tested TypeScript module with zero framework imports.

**Core principle**: eligibility (Stage 1) and ranking (Stage 2) are strictly separated. Ranking can never resurrect an ineligible slot (E2E Scenario F: a calendar-free but travel-infeasible slot is INELIGIBLE and never shown, regardless of score).

## 1. Candidate generation

For each of the next N days (default 7):

1. Intersect: zone operating windows × technician availability × existing calendar (ACTIVE appointment blocks + travel estimates + manual `CalendarBlock`s, including zone-day closures).
2. Resulting free intervals → candidate starts on a 10-minute grid.
3. Each candidate carries the job's block duration (`ServiceCatalogItem.block_duration_min`) and its travel context (neighbors, day edges).

**Same-day generation uses projected end times** (actual timestamps + remaining estimates), never planned ones — so a running overrun is already priced into what customers are offered.

## 2. Stage 1 — hard constraints

ALL must pass. Each failure returns a machine-readable reason — logged and asserted in fixtures. A failed candidate is INELIGIBLE with that reason.

| # | Constraint | Failure reason(s) |
|---|---|---|
| 1 | Whole operational block inside technician availability | `OUTSIDE_TECHNICIAN_AVAILABILITY` |
| 2 | Whole block inside an active zone window: `block_start ≥ window_start` AND `block_end ≤ window_end` (boundary fixture included); zone active; service active | `OUTSIDE_ZONE_WINDOW` · `ZONE_INACTIVE` · `SERVICE_INACTIVE` |
| 3 | Travel feasibility, including day edges — **first job of the day**: `travel(technician.start_location → here)` must fit after the working-window open; **between jobs**: `prev.end + travel(prev → here) ≤ block.start` AND `block.end + travel(here → next) ≤ next.start`; optionally end-of-day return to `end_location` (defaults to start) | `TRAVEL_INFEASIBLE` |
| 4 | No manual calendar block / zone-day closure overlap | `CALENDAR_BLOCKED` |
| 5 | Same-day cutoff respected (configurable lead, default 90 min) | `SAME_DAY_CUTOFF` |

Inventory availability is a **named extension-point constraint** (§10), not implemented in P0.

**Travel model (P0)**: `travel = haversine × road_factor ÷ configurable_speed + per-zone travel_buffer_min`, behind a `TravelEstimator` adapter. Crude by design; mitigated by generous per-zone buffers and calibrated by learning data (§9). Real routing provider is a P1 adapter swap (§10).

## 3. Stage 2 — ranking (eligible candidates only)

Deterministic weighted sum. Weights live in `scheduling.weights` config (editable without deploys); numeric defaults are seeded at M5 — TBD until then, tuned later with learning data.

| Factor | Meaning |
|---|---|
| `earliness` | Within-24h availability aspiration. **Scaled by request urgency** — urgency is an input to ordering, never a bypass of Stage 1. |
| `route_continuity` | Incremental travel vs adjacent commitments; anchored on `technician.start_location` for empty days. |
| `day_density` | Prefer filling started days over opening empty ones. |
| `buffer_health` | Slack beyond bare-minimum fits. |
| `customer_preference` | Matches the `time_preference` chip (MORNING \| AFTERNOON \| NONE). |

Stable sort; ties resolve to earliest. Top 3–5 shown to the customer; the rest behind "מעדיפים זמן אחר?" (eligible windows only).

## 4. Windows vs blocks vs estimates

Three distinct things, stored separately on `Appointment` — never conflated:

- **Appointment window** (`window_start/end`) — what the customer sees; default 30 min, per-zone configurable; anchored to `planned_start`.
- **Operational block** (`block_start/end`) — what the calendar reserves (`block_duration_min` + travel context); the unit of the exclusion constraint.
- **Work estimate** (`est_duration_min`) — expected wrench time; feeds projections and learning data.

`window ≠ block ≠ work estimate`. One ACTIVE appointment per job; superseded appointments are retained (status SUPERSEDED).

## 5. Booking commit — revalidation and race guard

Confirmation re-runs the **full Stage-1 eligibility check** for the chosen candidate inside the booking transaction, against current calendar truth. On top of that, the schema itself guards the race:

```sql
EXCLUDE USING gist (technician_id WITH =, tstzrange(block_start, block_end) WITH &&)
  WHERE (status = 'ACTIVE')
```

(`btree_gist` extension; migrated at M1.) Overlapping commits are impossible at the schema level: two customers confirming **overlapping (not merely identical)** slots resolve to exactly one success. The loser gets freshly ranked alternatives with honest copy — "הזמן הזה בדיוק נתפס".

**Stale slots**: the same commit-time recheck catches slots invalidated by operator actions between offer and confirm (zone-day disabled, block added, service deactivated). The customer sees "הזמן הזה בדיוק נתפס — הנה החלופות הקרובות" with fresh options — never a silent failure.

On success (one transaction): Appointment (ACTIVE) + ServiceJob → SCHEDULED + status token + confirmation.

## 6. Fallback chain

Never a dead end:

1. No eligible slot in 7 days → widen horizon to 14 days.
2. Still nothing → honest screen; ServiceRequest drops READY_TO_BOOK → NEEDS_REVIEW with reason `NO_SLOT` (a legal transition in the request state machine) for manual resolution.
3. Engine failure → same graceful path, reason `ENGINE_FAILURE`.
4. Out-of-zone address → Lead capture (reason `OUT_OF_ZONE`), no appointment offered (Scenario D).

## 7. Overrun handling (P0-minimum)

When actual timestamps project the running job past a later appointment's feasible start:

- Today view flags affected job cards "צפי איחור" with one-tap actions: **notify** (prefilled WhatsApp message) or **move** (calendar).
- Same-day candidate generation already consumes projected, not planned, end times (§1).

**Automated re-optimization is explicitly deferred to P1** — a recorded decision. P0 keeps the human in the loop with manual notify/move.

## 8. Manual override

The operator can always beat the engine, never silently:

- Book anything anywhere: explicit confirm + stored override reason for engine-ineligible placements ("אני יודע מה אני עושה").
- Move/extend/cancel appointments with conflict warnings + customer-notify prompt; cancel requires a reason and releases the calendar block.
- Blocks: time range, whole day, or zone-day closure.
- Overrides never silently mutate engine config; subsequent suggestions always recompute from calendar truth.
- Every override/move/cancel writes an AuditLog row and a DomainEvent.

## 9. Learning data

Recorded per job to calibrate estimates (no automation acts on it in P0):

- Estimated vs actual duration: `arrived_at → left_site_at`.
- Planned vs actual travel: `left_site_at → next arrived_at`.
- All state-transition timestamps (DomainEvent log).
- **Excluded from calibration**: retroactive operator-created jobs and override placements.

## 10. Named extension points

| Extension | P0 state | Activation |
|---|---|---|
| **Inventory availability constraint** | Named Stage-1 constraint slot; no InventoryItem table in P0 (actual parts are JobLineItem chips) | P1, with inventory + Daily Loadout |
| **Routing provider swap** | `TravelEstimator` adapter over haversine heuristic | P1: real routing/ETA provider behind the same adapter |
| **Automated re-optimization** | Manual notify/move only (§7); deferral recorded | P1 |

## 11. Configuration reference

All operational config is editable without deploys (`/pro/settings/*`).

| Knob | Default | Notes |
|---|---|---|
| Horizon | 7 days | Widens to 14 on fallback |
| Candidate grid | 10 min | |
| Same-day cutoff lead | 90 min | Configurable |
| Appointment window length | 30 min | Per-zone configurable |
| Zone operating windows | Sun–Thu afternoons (seed e.g. 15:00–20:00) | Per-zone; 12–15 calls/day is aspiration, not capacity config (conflict C2) |
| Travel: road factor, speed | configurable, values TBD | Heuristic inputs to `TravelEstimator` |
| Per-zone `travel_buffer_min` | configurable, values TBD | Generous until learning data lands |
| `scheduling.weights` | TBD at M5 seeding | §3 factors |
| Technician `start_location` | configurable (settings) | Anchors first-job travel and empty-day `route_continuity` |
| Technician `end_location` | defaults to `start_location` | Optional end-of-day return check |

## 12. M5 acceptance fixtures

- Scenario F: free-but-infeasible candidate ⇒ INELIGIBLE with reason.
- Day-boundary block: whole-block zone-window rule at window edges.
- First-job travel from `technician.start_location`.
- No-slot fallback → request NEEDS_REVIEW(`NO_SLOT`).
- Race: two concurrent confirmations of *overlapping* slots → exactly one succeeds; the other receives alternatives.
- Zone-day disabled after offer → commit-time recheck rejects, alternatives shown.
