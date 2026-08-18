import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import * as schema from "./schema";

export type Db =
  | ReturnType<typeof drizzlePostgres<typeof schema>>
  | ReturnType<typeof drizzlePglite<typeof schema>>;

/**
 * Production/staging: set DATABASE_URL (Supabase Postgres) — see .env.example.
 * Local dev without credentials: falls back to PGlite (real Postgres via WASM,
 * persisted under .data/pglite). This is a labeled dev fallback, not a mock —
 * the same migrations run on both.
 */
export function createDb(): { db: Db; driver: "postgres" | "pglite" } {
  const url = process.env.DATABASE_URL;
  if (url) {
    const client = postgres(url, { prepare: false });
    return { db: drizzlePostgres(client, { schema }), driver: "postgres" };
  }
  const pglite = new PGlite(process.env.PGLITE_DIR ?? ".data/pglite");
  return { db: drizzlePglite(pglite, { schema }), driver: "pglite" };
}
