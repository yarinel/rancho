import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Full P0 schema (docs/DATA_MODEL.md). Ownership: Household owns people/
 * bikes/places; Bicycle owns history; ServiceJob owns everything operational
 * about one visit. Money columns are integer agorot (₪80 = 8000).
 *
 * The appointments table additionally carries a GiST exclusion constraint
 * (no overlapping ACTIVE blocks per technician) — added in a custom SQL
 * migration because drizzle-kit does not model EXCLUDE constraints.
 */

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const appMeta = pgTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ----------------------------- People & places ---------------------------- */

export const households = pgTable("households", {
  id: id(),
  label: text("label").notNull(),
  createdAt: createdAt(),
});

export const customers = pgTable(
  "customers",
  {
    id: id(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id),
    name: text("name").notNull(),
    phone: text("phone").notNull(), // E.164
    whatsappSameAsPhone: boolean("whatsapp_same_as_phone")
      .notNull()
      .default(true),
    email: text("email"),
    preferredChannel: text("preferred_channel").notNull().default("whatsapp"),
    createdAt: createdAt(),
  },
  (t) => [index("customers_phone_idx").on(t.phone)],
);

export const riders = pgTable("riders", {
  id: id(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id),
  displayName: text("display_name").notNull(),
  ageRange: text("age_range"), // child | teen | adult — never DOB
  notes: text("notes"),
  createdAt: createdAt(),
});

export const bicycles = pgTable("bicycles", {
  id: id(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id),
  riderId: uuid("rider_id").references(() => riders.id),
  nickname: text("nickname"),
  category: text("category").notNull(), // BicycleCategory
  wheelSize: text("wheel_size").notNull().default("unknown"), // WheelSize
  hasGears: boolean("has_gears"), // null = unknown
  brand: text("brand"),
  model: text("model"),
  year: integer("year"),
  serial: text("serial"),
  primaryMediaId: uuid("primary_media_id"),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const locations = pgTable("locations", {
  id: id(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id),
  label: text("label").notNull().default("הבית"),
  formattedAddress: text("formatted_address").notNull(),
  lat: text("lat"),
  lng: text("lng"),
  zoneId: uuid("zone_id").references(() => serviceZones.id),
  accessNotes: text("access_notes"),
  geocodeStatus: text("geocode_status").notNull().default("manual"), // manual | geocoded | failed
  createdAt: createdAt(),
});

export const leads = pgTable("leads", {
  id: id(),
  phone: text("phone").notNull(),
  area: text("area"),
  reason: text("reason").notNull(), // LeadReason
  note: text("note"),
  status: text("status").notNull().default("NEW"), // NEW | CONTACTED | CLOSED
  createdAt: createdAt(),
});

/* ------------------------------- Catalogue -------------------------------- */

export const serviceCatalogItems = pgTable("service_catalog_items", {
  id: id(),
  internalName: text("internal_name").notNull().unique(),
  customerNameHe: text("customer_name_he").notNull(),
  descriptionHe: text("description_he"),
  priceType: text("price_type").notNull(), // PriceType
  basePrice: integer("base_price"), // agorot; null for QUOTE
  priceHigh: integer("price_high"), // agorot; RANGE upper bound
  estDurationMin: integer("est_duration_min").notNull().default(30),
  blockDurationMin: integer("block_duration_min").notNull().default(40),
  supportedCategories: jsonb("supported_categories")
    .$type<string[]>()
    .notNull()
    .default([]),
  wheelSizeConstraints: jsonb("wheel_size_constraints").$type<string[]>(), // null = all
  partIncluded: boolean("part_included").notNull().default(true),
  partIncludedTbd: boolean("part_included_tbd").notNull().default(false), // D3 flag
  instantBookEligible: boolean("instant_book_eligible").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const serviceZones = pgTable("service_zones", {
  id: id(),
  nameHe: text("name_he").notNull().unique(),
  cityMatch: jsonb("city_match").$type<string[]>().notNull().default([]),
  travelCharge: integer("travel_charge"), // agorot; null = TBD (D5)
  minOrder: integer("min_order"), // agorot
  travelBufferMin: integer("travel_buffer_min").notNull().default(10),
  instantBookEnabled: boolean("instant_book_enabled").notNull().default(true),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const zoneWindows = pgTable("zone_windows", {
  id: id(),
  zoneId: uuid("zone_id")
    .notNull()
    .references(() => serviceZones.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Sunday … 6=Saturday
  startMinute: integer("start_minute").notNull(), // minutes from local midnight
  endMinute: integer("end_minute").notNull(),
});

/* -------------------------------- Operations ------------------------------ */

export const technicians = pgTable("technicians", {
  id: id(),
  name: text("name").notNull(),
  phone: text("phone"),
  startLat: text("start_lat").notNull(),
  startLng: text("start_lng").notNull(),
  endLat: text("end_lat"),
  endLng: text("end_lng"),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const technicianHours = pgTable("technician_hours", {
  id: id(),
  technicianId: uuid("technician_id")
    .notNull()
    .references(() => technicians.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(),
  startMinute: integer("start_minute").notNull(),
  endMinute: integer("end_minute").notNull(),
});

export const calendarBlocks = pgTable("calendar_blocks", {
  id: id(),
  technicianId: uuid("technician_id")
    .notNull()
    .references(() => technicians.id),
  zoneId: uuid("zone_id").references(() => serviceZones.id), // set ⇒ zone-day closure
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  reason: text("reason"),
  createdAt: createdAt(),
});

/* ------------------------------ Service intake ---------------------------- */

export const serviceRequests = pgTable("service_requests", {
  id: id(),
  publicToken: text("public_token").notNull().unique(),
  householdId: uuid("household_id").references(() => households.id), // null until contact step
  customerId: uuid("customer_id").references(() => customers.id),
  bicycleId: uuid("bicycle_id").references(() => bicycles.id),
  locationId: uuid("location_id").references(() => locations.id),
  status: text("status").notNull().default("NEW"), // RequestStatus
  statusReason: text("status_reason"), // NO_SLOT | ENGINE_FAILURE | EXPIRED | picker reasons
  symptomCategory: text("symptom_category").notNull(), // SymptomCategory
  intakeAnswers: jsonb("intake_answers")
    .$type<Record<string, string>>()
    .notNull()
    .default({}),
  intakeSchemaVersion: integer("intake_schema_version").notNull().default(1),
  urgency: text("urgency").notNull().default("NORMAL"), // NORMAL | URGENT
  timePreference: text("time_preference").notNull().default("NONE"),
  assessment: jsonb("assessment").$type<{
    expectedServiceIds: string[];
    durationEstMin: number;
    blockDurationMin: number;
    priceType: string;
    priceLow: number | null;
    priceHigh: number | null;
    confidence: string;
    rationale: string;
  }>(),
  reviewNotes: text("review_notes"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ------------------------------- Service jobs ------------------------------ */

export const serviceJobs = pgTable(
  "service_jobs",
  {
    id: id(),
    publicToken: text("public_token").notNull().unique(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    bicycleId: uuid("bicycle_id")
      .notNull()
      .references(() => bicycles.id),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicians.id),
    serviceRequestId: uuid("service_request_id").references(
      () => serviceRequests.id,
    ),
    originatingJobId: uuid("originating_job_id"),
    status: text("status").notNull().default("DRAFT"), // JobStatus
    followUpRequired: boolean("follow_up_required").notNull().default(false),
    reportedSymptoms: text("reported_symptoms").notNull(),
    intakeSnapshot: jsonb("intake_snapshot")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    priceNoteHe: text("price_note_he"),
    expectedTotal: integer("expected_total"), // agorot at booking time
    expectedTotalHigh: integer("expected_total_high"),
    travelCharge: integer("travel_charge").notNull().default(0),
    visitFee: integer("visit_fee").notNull().default(6000), // D4 placeholder 60₪
    paymentState: text("payment_state").notNull().default("PENDING"),
    finalAmount: integer("final_amount"),
    paymentRecordedAt: timestamp("payment_recorded_at", { withTimezone: true }),
    amountAdjustReason: text("amount_adjust_reason"),
    beforeMediaId: uuid("before_media_id"),
    afterMediaId: uuid("after_media_id"),
    afterPhotoSkipReason: text("after_photo_skip_reason"),
    initialRideDone: boolean("initial_ride_done"),
    cleaned: boolean("cleaned"),
    testRideDone: boolean("test_ride_done"),
    summaryHe: text("summary_he"),
    maintenanceTipHe: text("maintenance_tip_he"),
    enRouteAt: timestamp("en_route_at", { withTimezone: true }),
    arrivedAt: timestamp("arrived_at", { withTimezone: true }),
    workStartedAt: timestamp("work_started_at", { withTimezone: true }),
    leftSiteAt: timestamp("left_site_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    unresolvedReason: text("unresolved_reason"), // UnresolvedReason
    cancelReason: text("cancel_reason"),
    retroactive: boolean("retroactive").notNull().default(false),
    retroactiveReason: text("retroactive_reason"),
    firstVisitResolved: boolean("first_visit_resolved"),
    resolutionExclusion: text("resolution_exclusion"), // ResolutionExclusion
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("jobs_status_idx").on(t.status),
    index("jobs_bicycle_idx").on(t.bicycleId),
    index("jobs_household_idx").on(t.householdId),
  ],
);

export const appointments = pgTable(
  "appointments",
  {
    id: id(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => serviceJobs.id, { onDelete: "cascade" }),
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicians.id),
    status: text("status").notNull().default("ACTIVE"), // AppointmentStatus
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
    blockStart: timestamp("block_start", { withTimezone: true }).notNull(),
    blockEnd: timestamp("block_end", { withTimezone: true }).notNull(),
    plannedStart: timestamp("planned_start", { withTimezone: true }).notNull(),
    travelTimeEstMin: integer("travel_time_est_min").notNull().default(0),
    overrideReason: text("override_reason"), // set ⇒ operator bypassed eligibility
    createdAt: createdAt(),
  },
  (t) => [
    index("appointments_time_idx").on(t.technicianId, t.blockStart),
    // One ACTIVE appointment per job (partial unique index via custom migration
    // is unnecessary — enforced in the booking transaction + this index helps).
    index("appointments_job_idx").on(t.jobId, t.status),
  ],
);

export const jobLineItems = pgTable("job_line_items", {
  id: id(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => serviceJobs.id, { onDelete: "cascade" }),
  catalogItemId: uuid("catalog_item_id").references(
    () => serviceCatalogItems.id,
  ),
  label: text("label").notNull(),
  kind: text("kind").notNull(), // EXPECTED | ACTUAL
  price: integer("price"), // agorot; null when range/quote at expected stage
  priceHigh: integer("price_high"),
  partSource: text("part_source").notNull().default("RANCHO"),
  partsUsed: jsonb("parts_used").$type<string[]>().notNull().default([]),
  approvalId: uuid("approval_id"),
  createdAt: createdAt(),
});

export const findings = pgTable("findings", {
  id: id(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => serviceJobs.id, { onDelete: "cascade" }),
  bicycleId: uuid("bicycle_id")
    .notNull()
    .references(() => bicycles.id),
  titleHe: text("title_he").notNull(),
  explanationHe: text("explanation_he"),
  severity: text("severity").notNull(), // FindingSeverity
  proposedWorkHe: text("proposed_work_he"),
  proposedPrice: integer("proposed_price"), // agorot
  resolution: text("resolution").notNull().default("OPEN"), // FindingResolution
  resolvedInJob: boolean("resolved_in_job").notNull().default(false),
  mediaId: uuid("media_id"),
  createdAt: createdAt(),
});

export const approvalRecords = pgTable("approval_records", {
  id: id(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => serviceJobs.id, { onDelete: "cascade" }),
  findingId: uuid("finding_id").references(() => findings.id),
  proposedWorkHe: text("proposed_work_he").notNull(),
  explanationHe: text("explanation_he"),
  price: integer("price").notNull(), // agorot
  decision: text("decision").notNull().default("PENDING"), // ApprovalDecision
  channel: text("channel").notNull(), // ApprovalChannel
  approverName: text("approver_name"),
  approverPhone: text("approver_phone"),
  technicianId: uuid("technician_id")
    .notNull()
    .references(() => technicians.id),
  requestedAt: timestamp("requested_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
});

export const safetyChecks = pgTable(
  "safety_checks",
  {
    id: id(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => serviceJobs.id, { onDelete: "cascade" }),
    phase: text("phase").notNull(), // INSPECTION | FINAL
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("safety_checks_job_phase_uq").on(t.jobId, t.phase)],
);

export const safetyCheckItems = pgTable(
  "safety_check_items",
  {
    id: id(),
    safetyCheckId: uuid("safety_check_id")
      .notNull()
      .references(() => safetyChecks.id, { onDelete: "cascade" }),
    checkType: text("check_type").notNull(), // CheckType
    result: text("result").notNull(), // CheckResult
    note: text("note"),
  },
  (t) => [
    uniqueIndex("safety_check_items_uq").on(t.safetyCheckId, t.checkType),
  ],
);

/* --------------------------------- Media ---------------------------------- */

export const media = pgTable("media", {
  id: id(),
  jobId: uuid("job_id").references(() => serviceJobs.id),
  requestId: uuid("request_id").references(() => serviceRequests.id),
  bicycleId: uuid("bicycle_id").references(() => bicycles.id),
  findingId: uuid("finding_id"),
  kind: text("kind").notNull(), // MediaKind
  storageKey: text("storage_key").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  status: text("status").notNull().default("READY"),
  createdAt: createdAt(),
});

/* ------------------------------ Events & audit ----------------------------- */

export const domainEvents = pgTable(
  "domain_events",
  {
    id: id(),
    entity: text("entity").notNull(), // service_job | service_request | …
    entityId: uuid("entity_id").notNull(),
    event: text("event").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    actor: text("actor").notNull(), // staff:<id> | customer:<token-prefix> | system
    createdAt: createdAt(),
  },
  (t) => [index("domain_events_entity_idx").on(t.entity, t.entityId)],
);

export const auditLog = pgTable("audit_log", {
  id: id(),
  staffUserId: uuid("staff_user_id"),
  action: text("action").notNull(),
  entity: text("entity"),
  entityId: uuid("entity_id"),
  detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
});

/* ---------------------------------- Staff ---------------------------------- */

export const staffUsers = pgTable("staff_users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(), // scrypt: salt:hash (hex)
  role: text("role").notNull().default("OWNER"), // dormant in P0 (D14)
  technicianId: uuid("technician_id").references(() => technicians.id),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});
