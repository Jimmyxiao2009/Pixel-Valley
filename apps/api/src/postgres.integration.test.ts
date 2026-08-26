import { describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("PostgresStore", () => {
  it("roundtrips a session when TEST_DATABASE_URL is set", async () => {
    const { runMigrations } = await import("./db/migrate.ts");
    const { seedDatabase } = await import("./db/seed.ts");
    const { createPostgresStore } = await import("./store-postgres.ts");
    await runMigrations(url);
    await seedDatabase(url, new Date("2026-08-26T12:00:00.000Z"));
    const store = createPostgresStore(url!);
    try {
      const you = await store.getResident("you");
      expect(you?.handle).toBe("you");
      const token = crypto.randomUUID();
      await store.createSession({
        id: token,
        accountId: "account-you",
        residentId: "you",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      });
      const session = await store.getSession(token);
      expect(session?.residentId).toBe("you");
      await store.deleteSession(token);
    } finally {
      await store.close?.();
    }
  });
});
