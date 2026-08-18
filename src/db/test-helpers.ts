import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";

export type TestDb = ReturnType<typeof drizzle<typeof schema>>;

/** Fresh in-memory Postgres (PGlite) with all migrations applied. */
export async function createTestDb(): Promise<TestDb> {
  const pglite = new PGlite({ extensions: { btree_gist } });
  const db = drizzle(pglite, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}
