/**
 * Domain vocabulary — single source of truth for enums shared by the DB
 * schema, the state machines, and the UI. Values are stored as-is in Postgres.
 */

export const BICYCLE_CATEGORIES = [
  "kids",
  "bmx",
  "mtb",
  "cruiser",
  "city",
  "road",
  "other",
] as const;
export type BicycleCategory = (typeof BICYCLE_CATEGORIES)[number];

/** Categories Rancho does not serve today (detected at intake, never booked). */
export const OUT_OF_SCOPE_CATEGORIES: BicycleCategory[] = ["road"];

export const WHEEL_SIZES = [
  "w12",
  "w14",
  "w16",
  "w18",
  "w20",
  "w24",
  "w26",
  "w275",
  "w29",
  "unknown",
] as const;
export type WheelSize = (typeof WHEEL_SIZES)[number];

/** Wheel sizes covered by the printed price list (decision D2). */
export const PRICED_WHEEL_SIZES: WheelSize[] = ["w20", "w24", "w26"];

export const SYMPTOM_CATEGORIES = [
  "puncture",
  "brakes",
  "gears",
  "chain_drops",
  "loose_or_noise",
  "tune_up",
  "unknown",
] as const;
export type SymptomCategory = (typeof SYMPTOM_CATEGORIES)[number];

export const REQUEST_STATUSES = [
  "NEW",
  "NEEDS_REVIEW",
  "NEEDS_CUSTOMER_INFO",
  "READY_TO_BOOK",
  "CONVERTED_TO_JOB",
  "OUT_OF_SCOPE",
  "WORKSHOP_REQUIRED",
  "CANCELLED",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const JOB_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "EN_ROUTE",
  "ARRIVED",
  "INSPECTION",
  "AWAITING_APPROVAL",
  "IN_SERVICE",
  "FINAL_SAFETY_CHECK",
  "PAYMENT_PENDING",
  "COMPLETED",
  "CANCELLED",
  "UNRESOLVED",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const UNRESOLVED_REASONS = [
  "NO_SHOW",
  "PART_UNAVAILABLE",
  "SAFETY_STOP",
  "CUSTOMER_ABORTED",
  "OTHER",
] as const;
export type UnresolvedReason = (typeof UNRESOLVED_REASONS)[number];

export const CANCEL_REASONS = [
  "CUSTOMER_REQUEST",
  "OPERATOR",
  "DUPLICATE",
  "OTHER",
] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];

export const PRICE_TYPES = ["FIXED", "RANGE", "QUOTE"] as const;
export type PriceType = (typeof PRICE_TYPES)[number];

export const CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW"] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export const CHECK_TYPES = [
  "CRANK",
  "STEM_HANDLEBAR",
  "WHEELS_AXLES",
  "BRAKES",
  "GEARS",
] as const;
export type CheckType = (typeof CHECK_TYPES)[number];

export const CHECK_RESULTS = [
  "OK",
  "ATTENTION_RECOMMENDED",
  "UNSAFE",
  "NOT_APPLICABLE",
] as const;
export type CheckResult = (typeof CHECK_RESULTS)[number];

export const SAFETY_PHASES = ["INSPECTION", "FINAL"] as const;
export type SafetyPhase = (typeof SAFETY_PHASES)[number];

export const FINDING_SEVERITIES = [
  "INFO",
  "ATTENTION_RECOMMENDED",
  "UNSAFE",
] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export const FINDING_RESOLUTIONS = [
  "OPEN",
  "REPAIRED",
  "DECLINED",
  "DEFERRED",
  "REFUSED_UNSAFE_PART",
  "ACKNOWLEDGED_UNREPAIRED",
] as const;
export type FindingResolution = (typeof FINDING_RESOLUTIONS)[number];

export const APPROVAL_DECISIONS = [
  "PENDING",
  "APPROVED",
  "DECLINED",
  "DEFERRED",
] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

export const APPROVAL_CHANNELS = ["IN_PERSON", "LINK"] as const;
export type ApprovalChannel = (typeof APPROVAL_CHANNELS)[number];

export const PAYMENT_STATES = [
  "PENDING",
  "PAID_CASH",
  "PAID_BIT",
  "PAID_TRANSFER",
  "PAID_EXTERNAL",
  "WAIVED",
] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

export const LINE_ITEM_KINDS = ["EXPECTED", "ACTUAL"] as const;
export type LineItemKind = (typeof LINE_ITEM_KINDS)[number];

export const PART_SOURCES = ["RANCHO", "CUSTOMER"] as const;
export type PartSource = (typeof PART_SOURCES)[number];

export const LEAD_REASONS = ["OUT_OF_ZONE", "OUT_OF_SCOPE", "NO_SLOT"] as const;
export type LeadReason = (typeof LEAD_REASONS)[number];

export const MEDIA_KINDS = ["INTAKE", "BEFORE", "AFTER", "FINDING"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const TIME_PREFERENCES = ["MORNING", "AFTERNOON", "NONE"] as const;
export type TimePreference = (typeof TIME_PREFERENCES)[number];

export const APPOINTMENT_STATUSES = [
  "ACTIVE",
  "SUPERSEDED",
  "CANCELLED",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const STAFF_ROLES = ["OWNER", "TECHNICIAN"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const RESOLUTION_EXCLUSIONS = [
  "CUSTOMER_DECLINED",
  "PART_UNAVAILABLE",
  "WORKSHOP_ONLY",
  "NEW_UNRELATED_ISSUE",
] as const;
export type ResolutionExclusion = (typeof RESOLUTION_EXCLUSIONS)[number];

/** Money in agorot (integer) to avoid float drift; ₪80 = 8000. */
export type Agorot = number;
export const ILS = (shekels: number): Agorot => Math.round(shekels * 100);
export const toShekels = (a: Agorot): number => a / 100;
