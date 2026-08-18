CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"technician_id" uuid NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"block_start" timestamp with time zone NOT NULL,
	"block_end" timestamp with time zone NOT NULL,
	"planned_start" timestamp with time zone NOT NULL,
	"travel_time_est_min" integer DEFAULT 0 NOT NULL,
	"override_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"finding_id" uuid,
	"proposed_work_he" text NOT NULL,
	"explanation_he" text,
	"price" integer NOT NULL,
	"decision" text DEFAULT 'PENDING' NOT NULL,
	"channel" text NOT NULL,
	"approver_name" text,
	"approver_phone" text,
	"technician_id" uuid NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_user_id" uuid,
	"action" text NOT NULL,
	"entity" text,
	"entity_id" uuid,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bicycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"rider_id" uuid,
	"nickname" text,
	"category" text NOT NULL,
	"wheel_size" text DEFAULT 'unknown' NOT NULL,
	"has_gears" boolean,
	"brand" text,
	"model" text,
	"year" integer,
	"serial" text,
	"primary_media_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technician_id" uuid NOT NULL,
	"zone_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"whatsapp_same_as_phone" boolean DEFAULT true NOT NULL,
	"email" text,
	"preferred_channel" text DEFAULT 'whatsapp' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"event" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"bicycle_id" uuid NOT NULL,
	"title_he" text NOT NULL,
	"explanation_he" text,
	"severity" text NOT NULL,
	"proposed_work_he" text,
	"proposed_price" integer,
	"resolution" text DEFAULT 'OPEN' NOT NULL,
	"resolved_in_job" boolean DEFAULT false NOT NULL,
	"media_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"catalog_item_id" uuid,
	"label" text NOT NULL,
	"kind" text NOT NULL,
	"price" integer,
	"price_high" integer,
	"part_source" text DEFAULT 'RANCHO' NOT NULL,
	"parts_used" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"approval_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"area" text,
	"reason" text NOT NULL,
	"note" text,
	"status" text DEFAULT 'NEW' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"label" text DEFAULT 'הבית' NOT NULL,
	"formatted_address" text NOT NULL,
	"lat" text,
	"lng" text,
	"zone_id" uuid,
	"access_notes" text,
	"geocode_status" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid,
	"request_id" uuid,
	"bicycle_id" uuid,
	"finding_id" uuid,
	"kind" text NOT NULL,
	"storage_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"status" text DEFAULT 'READY' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "riders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"age_range" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "safety_check_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"safety_check_id" uuid NOT NULL,
	"check_type" text NOT NULL,
	"result" text NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "safety_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"phase" text NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_catalog_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"internal_name" text NOT NULL,
	"customer_name_he" text NOT NULL,
	"description_he" text,
	"price_type" text NOT NULL,
	"base_price" integer,
	"price_high" integer,
	"est_duration_min" integer DEFAULT 30 NOT NULL,
	"block_duration_min" integer DEFAULT 40 NOT NULL,
	"supported_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"wheel_size_constraints" jsonb,
	"part_included" boolean DEFAULT true NOT NULL,
	"part_included_tbd" boolean DEFAULT false NOT NULL,
	"instant_book_eligible" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_catalog_items_internal_name_unique" UNIQUE("internal_name")
);
--> statement-breakpoint
CREATE TABLE "service_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_token" text NOT NULL,
	"household_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"bicycle_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"technician_id" uuid NOT NULL,
	"service_request_id" uuid,
	"originating_job_id" uuid,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"follow_up_required" boolean DEFAULT false NOT NULL,
	"reported_symptoms" text NOT NULL,
	"intake_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"price_note_he" text,
	"expected_total" integer,
	"expected_total_high" integer,
	"travel_charge" integer DEFAULT 0 NOT NULL,
	"visit_fee" integer DEFAULT 6000 NOT NULL,
	"payment_state" text DEFAULT 'PENDING' NOT NULL,
	"final_amount" integer,
	"payment_recorded_at" timestamp with time zone,
	"amount_adjust_reason" text,
	"before_media_id" uuid,
	"after_media_id" uuid,
	"after_photo_skip_reason" text,
	"initial_ride_done" boolean,
	"cleaned" boolean,
	"test_ride_done" boolean,
	"summary_he" text,
	"maintenance_tip_he" text,
	"en_route_at" timestamp with time zone,
	"arrived_at" timestamp with time zone,
	"work_started_at" timestamp with time zone,
	"left_site_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"unresolved_reason" text,
	"cancel_reason" text,
	"retroactive" boolean DEFAULT false NOT NULL,
	"retroactive_reason" text,
	"first_visit_resolved" boolean,
	"resolution_exclusion" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_jobs_public_token_unique" UNIQUE("public_token")
);
--> statement-breakpoint
CREATE TABLE "service_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_token" text NOT NULL,
	"household_id" uuid,
	"customer_id" uuid,
	"bicycle_id" uuid,
	"location_id" uuid,
	"status" text DEFAULT 'NEW' NOT NULL,
	"status_reason" text,
	"symptom_category" text NOT NULL,
	"intake_answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"intake_schema_version" integer DEFAULT 1 NOT NULL,
	"urgency" text DEFAULT 'NORMAL' NOT NULL,
	"time_preference" text DEFAULT 'NONE' NOT NULL,
	"assessment" jsonb,
	"review_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_requests_public_token_unique" UNIQUE("public_token")
);
--> statement-breakpoint
CREATE TABLE "service_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_he" text NOT NULL,
	"city_match" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"travel_charge" integer,
	"min_order" integer,
	"travel_buffer_min" integer DEFAULT 10 NOT NULL,
	"instant_book_enabled" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_zones_name_he_unique" UNIQUE("name_he")
);
--> statement-breakpoint
CREATE TABLE "staff_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'OWNER' NOT NULL,
	"technician_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "technician_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technician_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technicians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"start_lat" text NOT NULL,
	"start_lng" text NOT NULL,
	"end_lat" text,
	"end_lng" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zone_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zone_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_job_id_service_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."service_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_job_id_service_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."service_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_finding_id_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."findings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bicycles" ADD CONSTRAINT "bicycles_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bicycles" ADD CONSTRAINT "bicycles_rider_id_riders_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."riders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_blocks" ADD CONSTRAINT "calendar_blocks_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_blocks" ADD CONSTRAINT "calendar_blocks_zone_id_service_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."service_zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_job_id_service_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."service_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_bicycle_id_bicycles_id_fk" FOREIGN KEY ("bicycle_id") REFERENCES "public"."bicycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_line_items" ADD CONSTRAINT "job_line_items_job_id_service_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."service_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_line_items" ADD CONSTRAINT "job_line_items_catalog_item_id_service_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."service_catalog_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_zone_id_service_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."service_zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_job_id_service_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."service_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_bicycle_id_bicycles_id_fk" FOREIGN KEY ("bicycle_id") REFERENCES "public"."bicycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "riders" ADD CONSTRAINT "riders_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_check_items" ADD CONSTRAINT "safety_check_items_safety_check_id_safety_checks_id_fk" FOREIGN KEY ("safety_check_id") REFERENCES "public"."safety_checks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_checks" ADD CONSTRAINT "safety_checks_job_id_service_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."service_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_bicycle_id_bicycles_id_fk" FOREIGN KEY ("bicycle_id") REFERENCES "public"."bicycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_jobs" ADD CONSTRAINT "service_jobs_service_request_id_service_requests_id_fk" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_bicycle_id_bicycles_id_fk" FOREIGN KEY ("bicycle_id") REFERENCES "public"."bicycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_users" ADD CONSTRAINT "staff_users_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technician_hours" ADD CONSTRAINT "technician_hours_technician_id_technicians_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone_windows" ADD CONSTRAINT "zone_windows_zone_id_service_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."service_zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_time_idx" ON "appointments" USING btree ("technician_id","block_start");--> statement-breakpoint
CREATE INDEX "appointments_job_idx" ON "appointments" USING btree ("job_id","status");--> statement-breakpoint
CREATE INDEX "customers_phone_idx" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "domain_events_entity_idx" ON "domain_events" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "safety_check_items_uq" ON "safety_check_items" USING btree ("safety_check_id","check_type");--> statement-breakpoint
CREATE UNIQUE INDEX "safety_checks_job_phase_uq" ON "safety_checks" USING btree ("job_id","phase");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "service_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_bicycle_idx" ON "service_jobs" USING btree ("bicycle_id");--> statement-breakpoint
CREATE INDEX "jobs_household_idx" ON "service_jobs" USING btree ("household_id");