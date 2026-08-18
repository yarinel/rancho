-- Double-booking guard at the schema level (docs/SCHEDULING.md):
-- two ACTIVE appointments of the same technician may never overlap in block time.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist (
    technician_id WITH =,
    tstzrange(block_start, block_end) WITH &&
  ) WHERE (status = 'ACTIVE');
