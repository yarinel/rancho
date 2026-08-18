import { createDb, type Db } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { seed } from "@/db/seed";

/**
 * App-wide DB singleton. Survives Next.js HMR via globalThis. On first access
 * (PGlite dev fallback) migrations + seeds run automatically so `npm run dev`
 * works with zero setup; against Supabase (DATABASE_URL) migrations are
 * expected to be applied explicitly via `npm run db:migrate`.
 */

const g = globalThis as unknown as {
  __ranchoDb?: { db: Db; ready: Promise<void> };
};

export function getDb(): { db: Db; ready: Promise<void> } {
  if (!g.__ranchoDb) {
    const { db, driver } = createDb();
    const ready =
      driver === "pglite"
        ? runMigrations(db, driver)
            .then(() => seed(db))
            .catch((err) => {
              // do not poison the singleton with a rejected init — retry next request
              g.__ranchoDb = undefined;
              throw err;
            })
        : Promise.resolve();
    g.__ranchoDb = { db, ready };
  }
  return g.__ranchoDb;
}

export async function db(): Promise<Db> {
  const h = getDb();
  await h.ready;
  return h.db;
}
