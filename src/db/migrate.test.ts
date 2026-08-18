import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

describe("migrations", () => {
  it("run cleanly on an empty database and create the schema", async () => {
    const pglite = new PGlite(); // in-memory, fresh every run
    const db = drizzle(pglite, { schema });

    await migrate(db, { migrationsFolder: "./drizzle" });

    await db
      .insert(schema.appMeta)
      .values({ key: "schema_bootstrap", value: "ok" });
    const rows = await db.select().from(schema.appMeta);
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe("schema_bootstrap");

    // migrations are recorded, so a second run is a no-op
    await migrate(db, { migrationsFolder: "./drizzle" });
    const journal = await db.execute(
      sql`select count(*)::int as n from drizzle.__drizzle_migrations`,
    );
    expect(Number(journal.rows[0].n)).toBeGreaterThan(0);
  });
});
