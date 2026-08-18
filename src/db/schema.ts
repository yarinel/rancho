import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * M0 bootstrap table proving the migration pipeline end to end.
 * Domain entities (Household, Bicycle, ServiceJob, …) land in M1 —
 * see docs/DATA_MODEL.md.
 */
export const appMeta = pgTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
