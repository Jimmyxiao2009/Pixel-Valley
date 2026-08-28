import type { AccountSecret } from "@pixel-valley/domain/secret";
import {
  createSeed,
  type AiQuota,
  type Block,
  type Conversation,
  type House,
  type Message,
  type NeighborEdge,
  type Neighborhood,
  type Post,
  type Presence,
  type Reaction,
  type Reply,
  type Resident,
  type ResidentPrivacy,
  type SeedWorld,
  type Visit,
} from "@pixel-valley/domain";
import { createDemoAccounts } from "./accounts.ts";

export type SessionRow = {
  id: string;
  accountId: string;
  residentId: string;
  expiresAt: string;
  createdAt: string;
};

export type ResidentPatch = {
  bio?: string;
  interests?: string[];
  privacy?: ResidentPrivacy;
  truePresence?: Presence;
  lastSeenAt?: string;
  firstPostAt?: string | null;
};

export type PostPatch = Partial<Pick<Post, "deletedAt" | "replyCount" | "reactionCount" | "flags">>;

export interface Store {
  snapshot(): Promise<SeedWorld>;
  getAccountById(id: string): Promise<AccountSecret | undefined>;
  getAccountByEmail(email: string): Promise<AccountSecret | undefined>;
  createSession(row: SessionRow): Promise<void>;
  getSession(id: string): Promise<SessionRow | undefined>;
  deleteSession(id: string): Promise<void>;
  getResident(id: string): Promise<Resident | undefined>;
  listResidents(): Promise<Resident[]>;
  updateResident(id: string, patch: ResidentPatch): Promise<Resident | undefined>;
  getNeighborhood(id: string): Promise<Neighborhood | undefined>;
  listNeighborhoods(): Promise<Neighborhood[]>;
  listHouses(): Promise<House[]>;
  getHouseByResident(residentId: string): Promise<House | undefined>;
  getPost(id: string): Promise<Post | undefined>;
  listPosts(): Promise<Post[]>;
  insertPost(post: Post): Promise<Post>;
  updatePost(id: string, patch: PostPatch): Promise<Post | undefined>;
  listReplies(postId: string): Promise<Reply[]>;
  listAllReplies(): Promise<Reply[]>;
  insertReply(reply: Reply): Promise<Reply>;
  getReaction(postId: string, residentId: string): Promise<Reaction | undefined>;
  listAllReactions(): Promise<Reaction[]>;
  insertReaction(reaction: Reaction): Promise<Reaction>;
  getNeighborEdge(from: string, to: string): Promise<NeighborEdge | undefined>;
  listNeighborEdgesFrom(from: string): Promise<NeighborEdge[]>;
  listNeighborEdges(): Promise<NeighborEdge[]>;
  insertNeighborEdge(edge: NeighborEdge): Promise<NeighborEdge>;
  deleteNeighborEdge(from: string, to: string): Promise<boolean>;
  isBlockedPair(a: string, b: string): Promise<boolean>;
  getBlock(blocker: string, blocked: string): Promise<Block | undefined>;
  insertBlock(block: Block): Promise<Block>;
  deleteBlock(blocker: string, blocked: string): Promise<boolean>;
  insertVisit(visit: Visit): Promise<Visit>;
  getConversation(id: string): Promise<Conversation | undefined>;
  getConversationByPair(a: string, b: string): Promise<Conversation | undefined>;
  listConversationsFor(residentId: string): Promise<Conversation[]>;
  insertConversation(conversation: Conversation): Promise<Conversation>;
  updateConversationPreview(id: string, lastMessageAt: string, lastMessagePreview: string): Promise<void>;
  listMessages(conversationId: string): Promise<Message[]>;
  insertMessage(message: Message): Promise<Message>;
  getLastRead(conversationId: string, residentId: string): Promise<string | null>;
  setLastRead(conversationId: string, residentId: string, at: string): Promise<void>;
  unreadCount(conversationId: string, residentId: string): Promise<number>;
  unreadTotal(residentId: string): Promise<number>;
  getAiQuota(residentId: string, date: string): Promise<AiQuota | undefined>;
  bumpAiQuota(residentId: string, date: string, field: "postsCreated" | "repliesCreated"): Promise<AiQuota>;
  close?(): Promise<void>;
}

export function sortedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function otherParticipant(conversation: Conversation, residentId: string): string | undefined {
  return conversation.participantResidentIds.find((id) => id !== residentId);
}

export function previewOf(content: string): string {
  const trimmed = content.trim().replaceAll(/\s+/g, " ");
  return trimmed.length <= 40 ? trimmed : `${trimmed.slice(0, 40)}…`;
}

export class MemoryStore implements Store {
  private readonly accounts = new Map<string, AccountSecret>();
  private readonly sessions = new Map<string, SessionRow>();
  private readonly residents = new Map<string, Resident>();
  private readonly neighborhoods = new Map<string, Neighborhood>();
  private readonly houses = new Map<string, House>();
  private readonly posts = new Map<string, Post>();
  private readonly replies = new Map<string, Reply>();
  private readonly reactions = new Map<string, Reaction>();
  private readonly edges = new Map<string, NeighborEdge>();
  private readonly blocks = new Map<string, Block>();
  private readonly visits: Visit[] = [];
  private readonly conversations = new Map<string, Conversation>();
  private readonly conversationByPair = new Map<string, string>();
  private readonly messages = new Map<string, Message[]>();
  private readonly reads = new Map<string, string>();
  private readonly quotas = new Map<string, AiQuota>();
  private readonly tiles;

  constructor(world: SeedWorld, accounts: AccountSecret[]) {
    this.tiles = world.tiles;
    for (const account of accounts) {
      this.accounts.set(account.id, structuredClone(account));
    }
    for (const neighborhood of world.neighborhoods) {
      this.neighborhoods.set(neighborhood.id, structuredClone(neighborhood));
    }
    for (const house of world.houses) {
      this.houses.set(house.id, structuredClone(house));
    }
    for (const resident of world.residents) {
      this.residents.set(resident.id, structuredClone(resident));
    }
    for (const post of world.posts) {
      this.posts.set(post.id, structuredClone(post));
    }
    for (const edge of world.neighborEdges) {
      this.edges.set(edgeKey(edge.fromResidentId, edge.toResidentId), structuredClone(edge));
    }
    for (const block of world.blocks) {
      this.blocks.set(edgeKey(block.blockerResidentId, block.blockedResidentId), structuredClone(block));
    }
  }

  async snapshot(): Promise<SeedWorld> {
    return {
      neighborhoods: [...this.neighborhoods.values()].map((row) => structuredClone(row)),
      tiles: this.tiles.map((row) => structuredClone(row)),
      houses: [...this.houses.values()].map((row) => structuredClone(row)),
      residents: [...this.residents.values()].map((row) => structuredClone(row)),
      posts: [...this.posts.values()].map((row) => structuredClone(row)),
      neighborEdges: [...this.edges.values()].map((row) => structuredClone(row)),
      blocks: [...this.blocks.values()].map((row) => structuredClone(row)),
    };
  }

  async getAccountById(id: string) {
    const row = this.accounts.get(id);
    return row ? structuredClone(row) : undefined;
  }

  async getAccountByEmail(email: string) {
    const row = [...this.accounts.values()].find((account) => account.email === email);
    return row ? structuredClone(row) : undefined;
  }

  async createSession(row: SessionRow) {
    this.sessions.set(row.id, { ...row });
  }

  async getSession(id: string) {
    const row = this.sessions.get(id);
    return row ? { ...row } : undefined;
  }

  async deleteSession(id: string) {
    this.sessions.delete(id);
  }

  async getResident(id: string) {
    const row = this.residents.get(id);
    return row ? structuredClone(row) : undefined;
  }

  async listResidents() {
    return [...this.residents.values()].map((row) => structuredClone(row));
  }

  async updateResident(id: string, patch: ResidentPatch) {
    const current = this.residents.get(id);
    if (!current) {
      return undefined;
    }
    const next: Resident = {
      ...current,
      bio: patch.bio ?? current.bio,
      interests: patch.interests ?? current.interests,
      privacy: patch.privacy ?? current.privacy,
      truePresence: patch.truePresence ?? current.truePresence,
      lastSeenAt: patch.lastSeenAt ?? current.lastSeenAt,
      onboarding: {
        firstPostAt:
          patch.firstPostAt !== undefined ? patch.firstPostAt : current.onboarding.firstPostAt,
      },
    };
    this.residents.set(id, next);
    return structuredClone(next);
  }

  async getNeighborhood(id: string) {
    const row = this.neighborhoods.get(id);
    return row ? structuredClone(row) : undefined;
  }

  async listNeighborhoods() {
    return [...this.neighborhoods.values()].map((row) => structuredClone(row));
  }

  async listHouses() {
    return [...this.houses.values()].map((row) => structuredClone(row));
  }

  async getHouseByResident(residentId: string) {
    const row = [...this.houses.values()].find((house) => house.residentId === residentId);
    return row ? structuredClone(row) : undefined;
  }

  async getPost(id: string) {
    const row = this.posts.get(id);
    return row ? structuredClone(row) : undefined;
  }

  async listPosts() {
    return [...this.posts.values()].map((row) => structuredClone(row));
  }

  async insertPost(post: Post) {
    this.posts.set(post.id, structuredClone(post));
    return structuredClone(post);
  }

  async updatePost(id: string, patch: PostPatch) {
    const current = this.posts.get(id);
    if (!current) {
      return undefined;
    }
    const next: Post = {
      ...current,
      ...patch,
      flags: patch.flags ?? current.flags,
    };
    this.posts.set(id, next);
    return structuredClone(next);
  }

  async listReplies(postId: string) {
    return [...this.replies.values()]
      .filter((row) => row.postId === postId)
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
      .map((row) => structuredClone(row));
  }

  async listAllReplies() {
    return [...this.replies.values()].map((row) => structuredClone(row));
  }

  async insertReply(reply: Reply) {
    this.replies.set(reply.id, structuredClone(reply));
    return structuredClone(reply);
  }

  async getReaction(postId: string, residentId: string) {
    const row = this.reactions.get(edgeKey(postId, residentId));
    return row ? structuredClone(row) : undefined;
  }

  async listAllReactions() {
    return [...this.reactions.values()].map((row) => structuredClone(row));
  }

  async insertReaction(reaction: Reaction) {
    this.reactions.set(edgeKey(reaction.postId, reaction.residentId), structuredClone(reaction));
    return structuredClone(reaction);
  }

  async getNeighborEdge(from: string, to: string) {
    const row = this.edges.get(edgeKey(from, to));
    return row ? structuredClone(row) : undefined;
  }

  async listNeighborEdgesFrom(from: string) {
    return [...this.edges.values()]
      .filter((row) => row.fromResidentId === from)
      .map((row) => structuredClone(row));
  }

  async listNeighborEdges() {
    return [...this.edges.values()].map((row) => structuredClone(row));
  }

  async insertNeighborEdge(edge: NeighborEdge) {
    this.edges.set(edgeKey(edge.fromResidentId, edge.toResidentId), structuredClone(edge));
    return structuredClone(edge);
  }

  async deleteNeighborEdge(from: string, to: string) {
    return this.edges.delete(edgeKey(from, to));
  }

  async isBlockedPair(a: string, b: string) {
    return this.blocks.has(edgeKey(a, b)) || this.blocks.has(edgeKey(b, a));
  }

  async getBlock(blocker: string, blocked: string) {
    const row = this.blocks.get(edgeKey(blocker, blocked));
    return row ? structuredClone(row) : undefined;
  }

  async insertBlock(block: Block) {
    this.blocks.set(edgeKey(block.blockerResidentId, block.blockedResidentId), structuredClone(block));
    return structuredClone(block);
  }

  async deleteBlock(blocker: string, blocked: string) {
    return this.blocks.delete(edgeKey(blocker, blocked));
  }

  async insertVisit(visit: Visit) {
    this.visits.push(structuredClone(visit));
    return structuredClone(visit);
  }

  async getConversation(id: string) {
    const row = this.conversations.get(id);
    return row ? structuredClone(row) : undefined;
  }

  async getConversationByPair(a: string, b: string) {
    const id = this.conversationByPair.get(pairKey(a, b));
    return id ? this.getConversation(id) : undefined;
  }

  async listConversationsFor(residentId: string) {
    return [...this.conversations.values()]
      .filter((row) => row.participantResidentIds.includes(residentId))
      .map((row) => structuredClone(row));
  }

  async insertConversation(conversation: Conversation) {
    this.conversations.set(conversation.id, structuredClone(conversation));
    const [a, b] = conversation.participantResidentIds;
    this.conversationByPair.set(pairKey(a, b), conversation.id);
    this.messages.set(conversation.id, []);
    return structuredClone(conversation);
  }

  async updateConversationPreview(id: string, lastMessageAt: string, lastMessagePreview: string) {
    const current = this.conversations.get(id);
    if (!current) {
      return;
    }
    this.conversations.set(id, { ...current, lastMessageAt, lastMessagePreview });
  }

  async listMessages(conversationId: string) {
    return (this.messages.get(conversationId) ?? []).map((row) => structuredClone(row));
  }

  async insertMessage(message: Message) {
    const list = this.messages.get(message.conversationId) ?? [];
    list.push(structuredClone(message));
    this.messages.set(message.conversationId, list);
    return structuredClone(message);
  }

  async getLastRead(conversationId: string, residentId: string) {
    return this.reads.get(readKey(conversationId, residentId)) ?? null;
  }

  async setLastRead(conversationId: string, residentId: string, at: string) {
    this.reads.set(readKey(conversationId, residentId), at);
  }

  async unreadCount(conversationId: string, residentId: string) {
    const lastRead = await this.getLastRead(conversationId, residentId);
    return (this.messages.get(conversationId) ?? []).filter((message) => {
      if (message.senderResidentId === residentId) {
        return false;
      }
      return !lastRead || message.createdAt > lastRead;
    }).length;
  }

  async unreadTotal(residentId: string) {
    const convos = await this.listConversationsFor(residentId);
    let total = 0;
    for (const conversation of convos) {
      total += await this.unreadCount(conversation.id, residentId);
    }
    return total;
  }

  async getAiQuota(residentId: string, date: string) {
    const row = this.quotas.get(`${residentId}:${date}`);
    return row ? { ...row } : undefined;
  }

  async bumpAiQuota(residentId: string, date: string, field: "postsCreated" | "repliesCreated") {
    const key = `${residentId}:${date}`;
    const current = this.quotas.get(key) ?? { residentId, date, postsCreated: 0, repliesCreated: 0 };
    const next = { ...current, [field]: current[field] + 1 };
    this.quotas.set(key, next);
    return { ...next };
  }
}

export function createMemoryStore(now: Date): MemoryStore {
  const world = createSeed(now);
  const accounts = createDemoAccounts(world.residents[0]?.createdAt ?? now.toISOString());
  return new MemoryStore(world, accounts);
}

function edgeKey(a: string, b: string): string {
  return `${a}\0${b}`;
}

function pairKey(a: string, b: string): string {
  const [left, right] = sortedPair(a, b);
  return `${left}\0${right}`;
}

function readKey(conversationId: string, residentId: string): string {
  return `${conversationId}\0${residentId}`;
}

export function lastHourIso(now: Date): string {
  return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
}
