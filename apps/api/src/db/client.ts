import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "./schema.ts";

export type Db = PostgresJsDatabase<typeof schema>;

export function createDb(url: string): { db: Db; client: Sql } {
  const client = postgres(url, { max: 8 });
  const db = drizzle(client, { schema });
  return { db, client };
}

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for migrate/seed/postgres store");
  }
  return url;
}
