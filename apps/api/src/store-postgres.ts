import {
  deriveObserverPresence,
  tilesFor,
  type AiQuota,
  type AiRole,
  type Block,
  type ClosedTag,
  type Conversation,
  type House,
  type HousePreset,
  type Message,
  type MessageVia,
  type NeighborEdge,
  type Neighborhood,
  type NeighborhoodKind,
  type Post,
  type PostType,
  type Presence,
  type Reaction,
  type Reply,
  type Resident,
  type ResidentKind,
  type SeedWorld,
  type Visit,
  type Visibility,
} from "@pixel-valley/domain";
import type { AccountSecret } from "@pixel-valley/domain/secret";
import { and, eq, gt, ne, or, sql } from "drizzle-orm";
import { createDb, type Db } from "./db/client.ts";
import {
  account,
  aiQuota,
  block,
  conversation,
  conversationRead,
  house,
  message,
  neighborEdge,
  neighborhood,
  post,
  reaction,
  reply,
  resident,
  session,
  visit,
} from "./db/schema.ts";
import {
  sortedPair,
  type PostPatch,
  type ResidentPatch,
  type SessionRow,
  type Store,
} from "./store.ts";
import type { Sql } from "postgres";

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function isoOrNull(value: Date | string | null | undefined): string | null {
  return value == null ? null : iso(value);
}

function mapResident(row: typeof resident.$inferSelect): Resident {
  const truePresence = row.truePresence as Presence;
  return {
    id: row.id,
    accountId: row.accountId,
    kind: row.kind as ResidentKind,
    displayName: row.displayName,
    handle: row.handle,
    bio: row.bio,
    interests: row.interests ?? [],
    avatarSprite: row.avatarSprite,
    truePresence,
    observerPresence: deriveObserverPresence(truePresence, row.privacy.showOnline, {
      kind: row.kind as ResidentKind,
      aiRole: (row.aiRole as AiRole | null) ?? null,
    }),
    lastSeenAt: iso(row.lastSeenAt),
    houseId: row.houseId,
    homeNeighborhoodId: row.homeNeighborhoodId,
    companionResidentId: row.companionResidentId,
    ownerResidentId: row.ownerResidentId,
    aiRole: (row.aiRole as AiRole | null) ?? null,
    aiMetadata: row.aiMetadata ?? null,
    privacy: row.privacy,
    onboarding: { firstPostAt: isoOrNull(row.firstPostAt) },
    createdAt: iso(row.createdAt),
  };
}

function mapHouse(row: typeof house.$inferSelect): House {
  return {
    id: row.id,
    residentId: row.residentId,
    neighborhoodId: row.neighborhoodId,
    slotIndex: row.slotIndex,
    preset: row.preset as HousePreset,
    roofTint: row.roofTint,
    nameplate: row.nameplate,
  };
}

function mapNeighborhood(row: typeof neighborhood.$inferSelect): Neighborhood {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as NeighborhoodKind,
    slotCount: row.slotCount,
  };
}

function mapPost(row: typeof post.$inferSelect): Post {
  return {
    id: row.id,
    authorResidentId: row.authorResidentId,
    type: row.type as PostType,
    title: row.title,
    content: row.content,
    visibility: row.visibility as Visibility,
    createdAt: iso(row.createdAt),
    editedAt: isoOrNull(row.editedAt),
    deletedAt: isoOrNull(row.deletedAt),
    replyCount: row.replyCount,
    reactionCount: row.reactionCount,
    tags: (row.tags ?? []) as ClosedTag[],
    flags: row.flags,
  };
}

function mapConversation(row: typeof conversation.$inferSelect): Conversation {
  return {
    id: row.id,
    kind: "direct",
    participantResidentIds: [row.participantA, row.participantB],
    lastMessageAt: iso(row.lastMessageAt),
    lastMessagePreview: row.lastMessagePreview,
  };
}

function mapMessage(row: typeof message.$inferSelect): Message {
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderResidentId: row.senderResidentId,
    content: row.content,
    createdAt: iso(row.createdAt),
    via: row.via as MessageVia,
  };
}

export class PostgresStore implements Store {
  private readonly db: Db;
  private readonly client: Sql;

  constructor(db: Db, client: Sql) {
    this.db = db;
    this.client = client;
  }

  async close(): Promise<void> {
    await this.client.end({ timeout: 5 });
  }

  async snapshot(): Promise<SeedWorld> {
    const [neighborhoods, houses, residents, posts, edges, blocks] = await Promise.all([
      this.listNeighborhoods(),
      this.listHouses(),
      this.listResidents(),
      this.listPosts(),
      this.listNeighborEdges(),
      this.listBlocks(),
    ]);
    return {
      neighborhoods,
      tiles: neighborhoods.flatMap((entry) => tilesFor(entry, houses)),
      houses,
      residents,
      posts,
      neighborEdges: edges,
      blocks,
    };
  }

  async getAccountById(id: string): Promise<AccountSecret | undefined> {
    const [row] = await this.db.select().from(account).where(eq(account.id, id)).limit(1);
    return row
      ? { id: row.id, email: row.email, passwordHash: row.passwordHash, createdAt: iso(row.createdAt) }
      : undefined;
  }

  async getAccountByEmail(email: string): Promise<AccountSecret | undefined> {
    const [row] = await this.db.select().from(account).where(eq(account.email, email)).limit(1);
    return row
      ? { id: row.id, email: row.email, passwordHash: row.passwordHash, createdAt: iso(row.createdAt) }
      : undefined;
  }

  async createSession(row: SessionRow): Promise<void> {
    await this.db.insert(session).values({
      id: row.id,
      accountId: row.accountId,
      residentId: row.residentId,
      expiresAt: new Date(row.expiresAt),
      createdAt: new Date(row.createdAt),
    });
  }

  async getSession(id: string): Promise<SessionRow | undefined> {
    const [row] = await this.db.select().from(session).where(eq(session.id, id)).limit(1);
    return row
      ? {
          id: row.id,
          accountId: row.accountId,
          residentId: row.residentId,
          expiresAt: iso(row.expiresAt),
          createdAt: iso(row.createdAt),
        }
      : undefined;
  }

  async deleteSession(id: string): Promise<void> {
    await this.db.delete(session).where(eq(session.id, id));
  }

  async getResident(id: string): Promise<Resident | undefined> {
    const [row] = await this.db.select().from(resident).where(eq(resident.id, id)).limit(1);
    return row ? mapResident(row) : undefined;
  }

  async listResidents(): Promise<Resident[]> {
    const rows = await this.db.select().from(resident);
    return rows.map(mapResident);
  }

  async updateResident(id: string, patch: ResidentPatch): Promise<Resident | undefined> {
    const set: Partial<typeof resident.$inferInsert> = {};
    if (patch.bio !== undefined) set.bio = patch.bio;
    if (patch.interests !== undefined) set.interests = patch.interests;
    if (patch.privacy !== undefined) set.privacy = patch.privacy;
    if (patch.truePresence !== undefined) set.truePresence = patch.truePresence;
    if (patch.lastSeenAt !== undefined) set.lastSeenAt = new Date(patch.lastSeenAt);
    if (patch.firstPostAt !== undefined) {
      set.firstPostAt = patch.firstPostAt ? new Date(patch.firstPostAt) : null;
    }
    if (Object.keys(set).length === 0) {
      return this.getResident(id);
    }
    await this.db.update(resident).set(set).where(eq(resident.id, id));
    return this.getResident(id);
  }

  async getNeighborhood(id: string): Promise<Neighborhood | undefined> {
    const [row] = await this.db.select().from(neighborhood).where(eq(neighborhood.id, id)).limit(1);
    return row ? mapNeighborhood(row) : undefined;
  }

  async listNeighborhoods(): Promise<Neighborhood[]> {
    return (await this.db.select().from(neighborhood)).map(mapNeighborhood);
  }

  async listHouses(): Promise<House[]> {
    return (await this.db.select().from(house)).map(mapHouse);
  }

  async getHouseByResident(residentId: string): Promise<House | undefined> {
    const [row] = await this.db.select().from(house).where(eq(house.residentId, residentId)).limit(1);
    return row ? mapHouse(row) : undefined;
  }

  async getPost(id: string): Promise<Post | undefined> {
    const [row] = await this.db.select().from(post).where(eq(post.id, id)).limit(1);
    return row ? mapPost(row) : undefined;
  }

  async listPosts(): Promise<Post[]> {
    return (await this.db.select().from(post)).map(mapPost);
  }

  async insertPost(row: Post): Promise<Post> {
    await this.db.insert(post).values({
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
    });
    return row;
  }

  async updatePost(id: string, patch: PostPatch): Promise<Post | undefined> {
    const set: Partial<typeof post.$inferInsert> = {};
    if (patch.deletedAt !== undefined) set.deletedAt = patch.deletedAt ? new Date(patch.deletedAt) : null;
    if (patch.replyCount !== undefined) set.replyCount = patch.replyCount;
    if (patch.reactionCount !== undefined) set.reactionCount = patch.reactionCount;
    if (patch.flags !== undefined) set.flags = patch.flags;
    if (Object.keys(set).length === 0) {
      return this.getPost(id);
    }
    await this.db.update(post).set(set).where(eq(post.id, id));
    return this.getPost(id);
  }

  async listReplies(postId: string): Promise<Reply[]> {
    const rows = await this.db.select().from(reply).where(eq(reply.postId, postId));
    return rows
      .map((row) => ({
        id: row.id,
        postId: row.postId,
        authorResidentId: row.authorResidentId,
        content: row.content,
        createdAt: iso(row.createdAt),
      }))
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  }

  async listAllReplies(): Promise<Reply[]> {
    const rows = await this.db.select().from(reply);
    return rows.map((row) => ({
      id: row.id,
      postId: row.postId,
      authorResidentId: row.authorResidentId,
      content: row.content,
      createdAt: iso(row.createdAt),
    }));
  }

  async insertReply(row: Reply): Promise<Reply> {
    await this.db.insert(reply).values({
      id: row.id,
      postId: row.postId,
      authorResidentId: row.authorResidentId,
      content: row.content,
      createdAt: new Date(row.createdAt),
    });
    return row;
  }

  async getReaction(postId: string, residentId: string): Promise<Reaction | undefined> {
    const [row] = await this.db
      .select()
      .from(reaction)
      .where(and(eq(reaction.postId, postId), eq(reaction.residentId, residentId)))
      .limit(1);
    return row
      ? {
          postId: row.postId,
          residentId: row.residentId,
          kind: "like",
          createdAt: iso(row.createdAt),
        }
      : undefined;
  }

  async listAllReactions(): Promise<Reaction[]> {
    const rows = await this.db.select().from(reaction);
    return rows.map((row) => ({
      postId: row.postId,
      residentId: row.residentId,
      kind: "like" as const,
      createdAt: iso(row.createdAt),
    }));
  }

  async insertReaction(row: Reaction): Promise<Reaction> {
    await this.db.insert(reaction).values({
      postId: row.postId,
      residentId: row.residentId,
      kind: row.kind,
      createdAt: new Date(row.createdAt),
    });
    return row;
  }

  async getNeighborEdge(from: string, to: string): Promise<NeighborEdge | undefined> {
    const [row] = await this.db
      .select()
      .from(neighborEdge)
      .where(and(eq(neighborEdge.fromResidentId, from), eq(neighborEdge.toResidentId, to)))
      .limit(1);
    return row
      ? {
          fromResidentId: row.fromResidentId,
          toResidentId: row.toResidentId,
          createdAt: iso(row.createdAt),
        }
      : undefined;
  }

  async listNeighborEdgesFrom(from: string): Promise<NeighborEdge[]> {
    const rows = await this.db.select().from(neighborEdge).where(eq(neighborEdge.fromResidentId, from));
    return rows.map((row) => ({
      fromResidentId: row.fromResidentId,
      toResidentId: row.toResidentId,
      createdAt: iso(row.createdAt),
    }));
  }

  async listNeighborEdges(): Promise<NeighborEdge[]> {
    const rows = await this.db.select().from(neighborEdge);
    return rows.map((row) => ({
      fromResidentId: row.fromResidentId,
      toResidentId: row.toResidentId,
      createdAt: iso(row.createdAt),
    }));
  }

  async insertNeighborEdge(edge: NeighborEdge): Promise<NeighborEdge> {
    await this.db.insert(neighborEdge).values({
      fromResidentId: edge.fromResidentId,
      toResidentId: edge.toResidentId,
      createdAt: new Date(edge.createdAt),
    });
    return edge;
  }

  async deleteNeighborEdge(from: string, to: string): Promise<boolean> {
    const deleted = await this.db
      .delete(neighborEdge)
      .where(and(eq(neighborEdge.fromResidentId, from), eq(neighborEdge.toResidentId, to)))
      .returning({ from: neighborEdge.fromResidentId });
    return deleted.length > 0;
  }

  async isBlockedPair(a: string, b: string): Promise<boolean> {
    const rows = await this.db
      .select()
      .from(block)
      .where(
        or(
          and(eq(block.blockerResidentId, a), eq(block.blockedResidentId, b)),
          and(eq(block.blockerResidentId, b), eq(block.blockedResidentId, a)),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  async getBlock(blocker: string, blocked: string): Promise<Block | undefined> {
    const [row] = await this.db
      .select()
      .from(block)
      .where(and(eq(block.blockerResidentId, blocker), eq(block.blockedResidentId, blocked)))
      .limit(1);
    return row
      ? {
          blockerResidentId: row.blockerResidentId,
          blockedResidentId: row.blockedResidentId,
          createdAt: iso(row.createdAt),
        }
      : undefined;
  }

  async insertBlock(row: Block): Promise<Block> {
    await this.db.insert(block).values({
      blockerResidentId: row.blockerResidentId,
      blockedResidentId: row.blockedResidentId,
      createdAt: new Date(row.createdAt),
    });
    return row;
  }

  async deleteBlock(blocker: string, blocked: string): Promise<boolean> {
    const deleted = await this.db
      .delete(block)
      .where(and(eq(block.blockerResidentId, blocker), eq(block.blockedResidentId, blocked)))
      .returning({ id: block.blockerResidentId });
    return deleted.length > 0;
  }

  private async listBlocks(): Promise<Block[]> {
    const rows = await this.db.select().from(block);
    return rows.map((row) => ({
      blockerResidentId: row.blockerResidentId,
      blockedResidentId: row.blockedResidentId,
      createdAt: iso(row.createdAt),
    }));
  }

  async insertVisit(row: Visit): Promise<Visit> {
    await this.db.insert(visit).values({
      id: row.id,
      visitorResidentId: row.visitorResidentId,
      hostResidentId: row.hostResidentId,
      startedAt: new Date(row.startedAt),
      endedAt: row.endedAt ? new Date(row.endedAt) : null,
    });
    return row;
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const [row] = await this.db.select().from(conversation).where(eq(conversation.id, id)).limit(1);
    return row ? mapConversation(row) : undefined;
  }

  async getConversationByPair(a: string, b: string): Promise<Conversation | undefined> {
    const [left, right] = sortedPair(a, b);
    const [row] = await this.db
      .select()
      .from(conversation)
      .where(and(eq(conversation.participantA, left), eq(conversation.participantB, right)))
      .limit(1);
    return row ? mapConversation(row) : undefined;
  }

  async listConversationsFor(residentId: string): Promise<Conversation[]> {
    const rows = await this.db
      .select()
      .from(conversation)
      .where(or(eq(conversation.participantA, residentId), eq(conversation.participantB, residentId)));
    return rows.map(mapConversation);
  }

  async insertConversation(row: Conversation): Promise<Conversation> {
    const [left, right] = sortedPair(row.participantResidentIds[0], row.participantResidentIds[1]);
    await this.db.insert(conversation).values({
      id: row.id,
      kind: row.kind,
      participantA: left,
      participantB: right,
      lastMessageAt: new Date(row.lastMessageAt),
      lastMessagePreview: row.lastMessagePreview,
    });
    return { ...row, participantResidentIds: [left, right] };
  }

  async updateConversationPreview(id: string, lastMessageAt: string, lastMessagePreview: string): Promise<void> {
    await this.db
      .update(conversation)
      .set({ lastMessageAt: new Date(lastMessageAt), lastMessagePreview })
      .where(eq(conversation.id, id));
  }

  async listMessages(conversationId: string): Promise<Message[]> {
    const rows = await this.db.select().from(message).where(eq(message.conversationId, conversationId));
    return rows.map(mapMessage).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  }

  async insertMessage(row: Message): Promise<Message> {
    await this.db.insert(message).values({
      id: row.id,
      conversationId: row.conversationId,
      senderResidentId: row.senderResidentId,
      content: row.content,
      createdAt: new Date(row.createdAt),
      via: row.via,
    });
    return row;
  }

  async getLastRead(conversationId: string, residentId: string): Promise<string | null> {
    const [row] = await this.db
      .select()
      .from(conversationRead)
      .where(and(eq(conversationRead.conversationId, conversationId), eq(conversationRead.residentId, residentId)))
      .limit(1);
    return row ? iso(row.lastReadAt) : null;
  }

  async setLastRead(conversationId: string, residentId: string, at: string): Promise<void> {
    await this.db
      .insert(conversationRead)
      .values({
        conversationId,
        residentId,
        lastReadAt: new Date(at),
      })
      .onConflictDoUpdate({
        target: [conversationRead.conversationId, conversationRead.residentId],
        set: { lastReadAt: new Date(at) },
      });
  }

  async unreadCount(conversationId: string, residentId: string): Promise<number> {
    const lastRead = await this.getLastRead(conversationId, residentId);
    const filters = [eq(message.conversationId, conversationId), ne(message.senderResidentId, residentId)];
    if (lastRead) {
      filters.push(gt(message.createdAt, new Date(lastRead)));
    }
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(message)
      .where(and(...filters));
    return row?.count ?? 0;
  }

  async unreadTotal(residentId: string): Promise<number> {
    const convos = await this.listConversationsFor(residentId);
    let total = 0;
    for (const convo of convos) {
      total += await this.unreadCount(convo.id, residentId);
    }
    return total;
  }

  async getAiQuota(residentId: string, date: string): Promise<AiQuota | undefined> {
    const [row] = await this.db
      .select()
      .from(aiQuota)
      .where(and(eq(aiQuota.residentId, residentId), eq(aiQuota.date, date)))
      .limit(1);
    return row
      ? {
          residentId: row.residentId,
          date: row.date,
          postsCreated: row.postsCreated,
          repliesCreated: row.repliesCreated,
        }
      : undefined;
  }

  async bumpAiQuota(residentId: string, date: string, field: "postsCreated" | "repliesCreated"): Promise<AiQuota> {
    const current = await this.getAiQuota(residentId, date);
    if (!current) {
      const next: AiQuota = {
        residentId,
        date,
        postsCreated: field === "postsCreated" ? 1 : 0,
        repliesCreated: field === "repliesCreated" ? 1 : 0,
      };
      await this.db.insert(aiQuota).values(next);
      return next;
    }
    const next: AiQuota = { ...current, [field]: current[field] + 1 };
    await this.db
      .update(aiQuota)
      .set({ postsCreated: next.postsCreated, repliesCreated: next.repliesCreated })
      .where(and(eq(aiQuota.residentId, residentId), eq(aiQuota.date, date)));
    return next;
  }
}

export function createPostgresStore(url: string): PostgresStore {
  const { db, client } = createDb(url);
  return new PostgresStore(db, client);
}
