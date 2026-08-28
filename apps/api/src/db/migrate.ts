import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { requireDatabaseUrl } from "./client.ts";

const MIGRATION_ID = "0001_init";

export async function runMigrations(url = requireDatabaseUrl()): Promise<void> {
  const sql = postgres(url, { max: 1 });
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migration (
        id text PRIMARY KEY,
        applied_at timestamptz NOT NULL
      )
    `;
    const applied = await sql<{ id: string }[]>`
      SELECT id FROM schema_migration WHERE id = ${MIGRATION_ID}
    `;
    if (applied.length > 0) {
      console.log(`migration ${MIGRATION_ID} already applied`);
      return;
    }
    const file = join(dirname(fileURLToPath(import.meta.url)), "migrations", "0001_init.sql");
    await sql.unsafe(readFileSync(file, "utf8"));
    await sql`INSERT INTO schema_migration (id, applied_at) VALUES (${MIGRATION_ID}, now())`;
    console.log(`applied ${MIGRATION_ID}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function isDirectRun(): boolean {
  const self = fileURLToPath(import.meta.url);
  const arg = process.argv[1];
  return Boolean(arg) && resolve(self) === resolve(arg);
}

if (isDirectRun()) {
  runMigrations().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
