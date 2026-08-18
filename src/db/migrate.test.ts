import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createTestDb } from "./test-helpers";
import * as schema from "./schema";

describe("migrations", () => {
  it("run cleanly on an empty database and create the full schema", async () => {
    const db = await createTestDb();

    await db
      .insert(schema.appMeta)
      .values({ key: "schema_bootstrap", value: "ok" });
    const rows = await db.select().from(schema.appMeta);
    expect(rows).toHaveLength(1);

    // spot-check core operational tables exist
    for (const table of [
      "households",
      "bicycles",
      "service_requests",
      "service_jobs",
      "appointments",
      "findings",
      "approval_records",
      "safety_checks",
      "domain_events",
      "staff_users",
    ]) {
      const r = await db.execute(
        sql`select 1 from information_schema.tables where table_name = ${table}`,
      );
      expect(r.rows.length, `table ${table} missing`).toBe(1);
    }
  });

  it("enforces the appointments no-overlap exclusion constraint", async () => {
    const db = await createTestDb();

    const [tech] = await db
      .insert(schema.technicians)
      .values({ name: "רן", startLat: "31.25", startLng: "34.79" })
      .returning();
    const [hh] = await db
      .insert(schema.households)
      .values({ label: "test" })
      .returning();
    const [cust] = await db
      .insert(schema.customers)
      .values({ householdId: hh.id, name: "א", phone: "+972500000000" })
      .returning();
    const [bike] = await db
      .insert(schema.bicycles)
      .values({ householdId: hh.id, category: "kids" })
      .returning();
    const [loc] = await db
      .insert(schema.locations)
      .values({ householdId: hh.id, formattedAddress: "באר שבע" })
      .returning();

    const mkJob = async (token: string) =>
      (
        await db
          .insert(schema.serviceJobs)
          .values({
            publicToken: token,
            householdId: hh.id,
            customerId: cust.id,
            bicycleId: bike.id,
            locationId: loc.id,
            technicianId: tech.id,
            reportedSymptoms: "פנצ'ר",
          })
          .returning()
      )[0];

    const jobA = await mkJob("tokA");
    const jobB = await mkJob("tokB");

    const at = (h: number, m: number) =>
      new Date(Date.UTC(2026, 8, 1, h, m, 0));

    await db.insert(schema.appointments).values({
      jobId: jobA.id,
      technicianId: tech.id,
      windowStart: at(14, 0),
      windowEnd: at(14, 30),
      blockStart: at(14, 0),
      blockEnd: at(14, 40),
      plannedStart: at(14, 0),
    });

    // overlapping (not identical) ACTIVE block must be rejected by the DB
    let overlapError: unknown;
    try {
      await db.insert(schema.appointments).values({
        jobId: jobB.id,
        technicianId: tech.id,
        windowStart: at(14, 10),
        windowEnd: at(14, 40),
        blockStart: at(14, 10),
        blockEnd: at(14, 50),
        plannedStart: at(14, 10),
      });
    } catch (e) {
      overlapError = e;
    }
    expect(overlapError).toBeDefined();
    const chain = `${String(overlapError)} ${String((overlapError as Error).cause ?? "")}`;
    expect(chain).toMatch(/appointments_no_overlap|exclusion|conflict/i);

    // a SUPERSEDED overlap is fine (constraint applies to ACTIVE only)
    await db.insert(schema.appointments).values({
      jobId: jobB.id,
      technicianId: tech.id,
      status: "SUPERSEDED",
      windowStart: at(14, 10),
      windowEnd: at(14, 40),
      blockStart: at(14, 10),
      blockEnd: at(14, 50),
      plannedStart: at(14, 10),
    });

    // non-overlapping ACTIVE block is fine
    await db.insert(schema.appointments).values({
      jobId: jobB.id,
      technicianId: tech.id,
      windowStart: at(15, 0),
      windowEnd: at(15, 30),
      blockStart: at(14, 40),
      blockEnd: at(15, 20),
      plannedStart: at(15, 0),
    });
  });
});
