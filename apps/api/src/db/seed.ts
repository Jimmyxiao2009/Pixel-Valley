import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createSeed } from "@pixel-valley/domain";
import { eq } from "drizzle-orm";
import { createDemoAccounts } from "../accounts.ts";
import { createDb, requireDatabaseUrl } from "./client.ts";
import { account, house, neighborhood, post, resident } from "./schema.ts";

export async function seedDatabase(url = requireDatabaseUrl(), now = new Date()): Promise<void> {
  const { db, client } = createDb(url);
  try {
    const existing = await db.select({ id: resident.id }).from(resident).where(eq(resident.id, "you")).limit(1);
    if (existing.length > 0) {
      console.log("seed already present (resident you)");
      return;
    }

    const world = createSeed(now);
    const accounts = createDemoAccounts(world.residents[0]?.createdAt ?? now.toISOString());

    await db.insert(account).values(
      accounts.map((row) => ({
        id: row.id,
        email: row.email,
        passwordHash: row.passwordHash,
        createdAt: new Date(row.createdAt),
      })),
    );

    await db.insert(neighborhood).values(
      world.neighborhoods.map((row) => ({
        id: row.id,
        name: row.name,
        kind: row.kind,
        slotCount: row.slotCount,
      })),
    );

    await db.insert(resident).values(
      world.residents.map((row) => ({
        id: row.id,
        accountId: row.accountId,
        kind: row.kind,
        displayName: row.displayName,
        handle: row.handle,
        bio: row.bio,
        interests: row.interests,
        avatarSprite: row.avatarSprite,
        truePresence: row.truePresence,
        lastSeenAt: new Date(row.lastSeenAt),
        houseId: row.houseId,
        homeNeighborhoodId: row.homeNeighborhoodId,
        companionResidentId: row.companionResidentId,
        ownerResidentId: row.ownerResidentId,
        aiRole: row.aiRole,
        aiMetadata: row.aiMetadata,
        privacy: row.privacy,
        firstPostAt: row.onboarding.firstPostAt ? new Date(row.onboarding.firstPostAt) : null,
        createdAt: new Date(row.createdAt),
      })),
    );

    await db.insert(house).values(
      world.houses.map((row) => ({
        id: row.id,
        residentId: row.residentId,
        neighborhoodId: row.neighborhoodId,
        slotIndex: row.slotIndex,
        preset: row.preset,
        roofTint: row.roofTint,
        nameplate: row.nameplate,
      })),
    );

    await db.insert(post).values(
      world.posts.map((row) => ({
        id: row.id,
        authorResidentId: row.authorResidentId,
        type: row.type,
        title: row.title,
        content: row.content,
        visibility: row.visibility,
        createdAt: new Date(row.createdAt),
        editedAt: row.editedAt ? new Date(row.editedAt) : null,
        deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
        replyCount: row.replyCount,
        reactionCount: row.reactionCount,
        tags: row.tags,
        flags: row.flags,
      })),
    );

    console.log("seeded Pixel Valley 12.8 residents and posts");
  } finally {
    await client.end({ timeout: 5 });
  }
}

function isDirectRun(): boolean {
  const self = fileURLToPath(import.meta.url);
  const arg = process.argv[1];
  return Boolean(arg) && resolve(self) === resolve(arg);
}

if (isDirectRun()) {
  seedDatabase().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
