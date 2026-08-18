# Data Model

Entities and relationships for Rancho RideCare. Source of truth: approved Phase 0 plan, section E. Postgres, one schema, English names.

**Implementation status (2026-08-18):** M0 (foundation) in progress — only the `app_meta` bootstrap table exists. Every entity below, including the exclusion constraint, is migrated in **M1** together with seeds and exhaustive state-machine tests. Nothing here is live yet.

## Ownership rules

- **Household** owns people, bikes, and places (Customer, Rider, Bicycle, Location).
- **Bicycle** owns history (treatments, findings, unresolved recommendations, media).
- **ServiceJob** owns everything operational about one visit (line items, findings, safety checks, approvals, payment, media, timestamps).
- The word "household" never appears in customer UX; it is an internal grouping auto-created at the booking contact step.

## Relationship diagram

```
Household 1—n Customer(contact)      Household 1—n Rider
Household 1—n Bicycle                Household 1—n Location
Bicycle n—1 Rider (optional)         Bicycle 1—n Media
ServiceRequest n—0..1 Household (nullable until contact step)
ServiceJob n—1 Household, Bicycle, Location, Customer, Technician
ServiceJob 0..1—1 ServiceRequest     ServiceJob 1—n Appointment (one ACTIVE; superseded kept)
ServiceJob 0..1—1 ServiceJob (originating_job_id, for follow-up/warranty visits)
ServiceJob 1—n JobLineItem           ServiceJob 1—n Finding
Finding 0..1—1 ApprovalRecord        ServiceJob 1—n SafetyCheck (phase: INSPECTION|FINAL) 1—n SafetyCheckItem
ServiceJob 1—n Media                 Lead (standalone)
ServiceCatalogItem n—m BicycleCategory
ServiceZone 1—n ZoneWindow           Technician 1—n CalendarBlock (optional zone_id)
DomainEvent (append-only event log)  AuditLog (approvals, price/status changes, overrides)
```

## Entities

### Household & people

- **Household** — `id`, `label`. Auto-created at the booking contact step; request drafts before that step are anonymous and attach here.
- **Customer** — `name`, `phone` (E.164), `whatsapp_same_as_phone`, `email?`, `preferred_channel`.
- **Rider** — `display_name?` (optional capture at booking: "מי רוכב עליהם?"), `age_range?` (`child|teen|adult` — **no DOB**, schema-enforced children's-data minimization), `notes?`.

### Bicycle & location

- **Bicycle** — `nickname?`, `category` (`kids|bmx|mtb|cruiser|city|road|other`), `wheel_size` (enum incl. `unknown`), `has_gears` (`true|false|unknown` — set from intake when gears-relevant, confirmed by technician at inspection), `brand?`, `model?`, `year?`, `serial?`, `primary_media?`, `notes`. Computed: `last_service_at`, `open_recommendations` (unresolved findings surface here).
- **Location** — `label`, `formatted_address`, `lat/lng`, `zone_id`, `access_notes`, `geocode_status`.
- **Media** — `owner` (job/bike/request/finding), `kind` (`INTAKE|BEFORE|AFTER|FINDING`), `storage_key`, `size`, `status`. Model supports `VIDEO` later; P0 accepts images only.

### Lead

Standalone entity capturing interest where no Household exists yet (out-of-zone, out-of-scope, no-slot exits — never a dead end):

- **Lead** — `phone`, `free_text_area/address`, `reason` (`OUT_OF_ZONE | OUT_OF_SCOPE | NO_SLOT`), `note`, `created_at`, `status` (`NEW|CONTACTED|CLOSED`).

### Request & job

- **ServiceRequest** — `household_id` (nullable until contact step), `symptom_category`, `intake_answers` (JSONB + `schema_version` — versioning discipline from day 1), `media[]`, `urgency`, `time_preference` (`MORNING|AFTERNOON|NONE`), `status` (see state machines: `NEW, NEEDS_REVIEW, NEEDS_CUSTOMER_INFO, READY_TO_BOOK, CONVERTED_TO_JOB, OUT_OF_SCOPE, WORKSHOP_REQUIRED, CANCELLED`), `assessment` {`expected_service_ids[]`, `duration_est`, `price_type FIXED|RANGE|QUOTE`, `price_low/high`, `confidence HIGH|MEDIUM|LOW`, `rationale`}, `review_notes`.
- **ServiceJob** — `status` (see state machines), `follow_up_required` (bool — a **flag**, not a state: a job can be paid, COMPLETED, and still need a follow-up), `originating_job_id?` (links a follow-up/warranty visit to its origin), `reported_symptoms`, intake snapshot, expected/actual JobLineItems, `findings[]`, `safety_checks[]`, `approvals[]`, `payment` {`state PENDING|PAID_CASH|PAID_BIT|PAID_TRANSFER|PAID_EXTERNAL|WAIVED`, `final_amount`, `recorded_at`}, before/after media, timestamps `en_route_at`, `arrived_at`, `work_started_at`, `left_site_at` (departure tap; may be inferred+flagged), `resolution` {`first_visit_resolved: bool`, `exclusion_reason?: enum` (known value: `CUSTOMER_DECLINED`, from the decline-after-diagnosis path), `unresolved_reason?: NO_SHOW|ALL_WORK_DECLINED|PART_UNAVAILABLE|SAFETY_STOP|OTHER`}.
  - Note: plan section F's UNRESOLVED transition reason enum reads `NO_SHOW, PART_UNAVAILABLE, SAFETY_STOP, CUSTOMER_ABORTED, OTHER` — reconcile `CUSTOMER_ABORTED` vs `ALL_WORK_DECLINED` at M1 (TBD).
- **Appointment** — `job_id`, `status` (`ACTIVE|SUPERSEDED|CANCELLED`), `window_start/end`, `block_start/end`, `planned_start`, `travel_time_est`. One ACTIVE per job; superseded appointments are kept. `window ≠ block ≠ work estimate`, stored separately.
- **JobLineItem** — `catalog_item_id?`, `label`, `kind` (`EXPECTED|ACTUAL`), `price`, `part_source` (`RANCHO|CUSTOMER`), `approval_id?`.
- **Finding** — `title`, `explanation`, `severity` (`INFO|ATTENTION_RECOMMENDED|UNSAFE`), `proposed_service/price?`, `resolution` (`REPAIRED|DECLINED|DEFERRED|REFUSED_UNSAFE_PART`), `resolved_in_job: bool` — unresolved findings surface on the Bicycle as open recommendations.
- **SafetyCheck** — `phase` (`INSPECTION|FINAL`); items: `check_type` (`CRANK|STEM_HANDLEBAR|WHEELS_AXLES|BRAKES|GEARS`), `result` (`OK|ATTENTION_RECOMMENDED|UNSAFE|NOT_APPLICABLE`), `note`.
- **ApprovalRecord** — `finding_id`, `proposed_work`, `explanation`, `price`, `requested_at`, `decided_at`, `decision` (`APPROVED|DECLINED|DEFERRED`), `approver_name/phone`, `channel` (`IN_PERSON|LINK`), `technician_id`.

### Catalogue & operational config

- **ServiceCatalogItem** — `internal_name`, `customer_name_he`, `description_he`, `price_type` (`FIXED|RANGE|QUOTE`), `base_price`, `price_high?`, `est_duration_min`, `block_duration_min`, `supported_categories[]`, `wheel_size_constraints?`, `instant_book_eligible`, `active`. Admin-curated; a service enters the catalogue only when it can be performed at warranty level. Seed policy (M1): verified price-list rows active; ambiguous rows inactive or QUOTE-typed — tire replacement (O1) is parked as QUOTE until resolved.
- **ServiceZone** — `name_he`, `geography` (city match P0; polygon later), `travel_charge` (**TBD** values, configurable — T2), `min_order?`, `travel_buffer_min`, `windows[]`, `instant_book_enabled`, `active`. Six zones seeded at M1 with TBD-marked config.
- **ZoneWindow** — per-zone operating windows (configurable; defaults reflect Sun–Thu afternoons).
- **Technician** — `name`, `phone`, `start_location` (lat/lng, configurable; anchors first-job travel), `end_location?` (defaults to start), `role` column (**dormant in P0** — single staff gate), `active`.
- **CalendarBlock** — `technician_id`, range (time/day), `zone_id?` (zone-day closure), `reason/note`.

### Logs

- **DomainEvent** — append-only: `entity`, `event`, `payload`, `actor`, `at`. Every state transition appends one. Powers the status page, audit, and metrics (booking_started/completed, transitions, est-vs-actual). Doubles as the analytics seed; also the consumption point for the future notification outbox.
- **AuditLog** — approvals, price/status changes, overrides.

## Key integrity rules

1. **Appointment double-booking guard (schema-level).** `EXCLUDE USING gist (technician_id WITH =, tstzrange(block_start, block_end) WITH &&) WHERE (status = 'ACTIVE')` — requires the `btree_gist` extension. Overlapping commits are impossible at the schema level; booking-commit recheck plus this constraint resolve two concurrent overlapping confirmations to exactly one success.
2. **Approval immutability.** An ApprovalRecord is immutable once decided; mutation attempts are rejected.
3. **Safety-check N/A rule.** `NOT_APPLICABLE` is legal only for `GEARS` and only when `bicycle.has_gears = false`; the technician's N/A tap writes `has_gears` back to the Bicycle. Inspection-phase `UNSAFE` results are preserved; the FINAL check is a separate record, so "found unsafe, repaired, now OK" keeps both truths.
4. **Payment amount guard data.** `payment.final_amount ≤ sum(approved line items)`: downward edits always allowed with a recorded reason (goodwill/discount, audited); any upward edit beyond the approved total is rejected unless a matching `APPROVED` ApprovalRecord exists. Tolerance configurable, default 0₪.
5. **Actual line items require approval.** `ACTUAL` JobLineItems above the approved total require an `APPROVED` ApprovalRecord via `approval_id` (same 0₪ default tolerance; documented exception hook).
6. **Event-sourced transitions.** No UI mutates status directly; all transitions go through the domain layer and append a DomainEvent.

## Deliberate P0 exclusions (documented extension points)

- **InventoryItem table** — not built. Actual parts are recorded as JobLineItem chips; the scheduling inventory-availability constraint is a named extension point in `/docs/SCHEDULING.md`.
- **Notification outbox + cron** — no async delivery channel in P0. The `NotificationProvider` interface plus the DomainEvent log make the outbox a drop-in at P1 with the first real channel (WhatsApp BSP/SMS).
- **Payment provider tables** — P0 payments are recorded, not processed (state enum above); provider abstraction documented, not built.
- **Multi-technician routing** — single technician in P0; `Technician.role` is dormant and the domain model supports more technicians later without redesign. Role-differentiated authorization is an extension point.
