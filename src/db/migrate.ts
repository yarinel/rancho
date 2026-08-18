import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { createDb, type Db } from "./client";

const MIGRATIONS_FOLDER = "./drizzle";

export async function runMigrations(
  db: Db,
  driver: "postgres" | "pglite",
): Promise<void> {
  if (driver === "postgres") {
    await migratePostgres(db as Parameters<typeof migratePostgres>[0], {
      migrationsFolder: MIGRATIONS_FOLDER,
    });
  } else {
    await migratePglite(db as Parameters<typeof migratePglite>[0], {
      migrationsFolder: MIGRATIONS_FOLDER,
    });
  }
}

/* Invoked via `npm run db:migrate` */
if (process.argv[1]?.endsWith("migrate.ts")) {
  const { db, driver } = createDb();
  runMigrations(db, driver)
    .then(() => {
      console.log(`migrations applied (driver: ${driver})`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
