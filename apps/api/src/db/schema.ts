import { jsonb, pgTable, primaryKey, text, timestamp, integer } from "drizzle-orm/pg-core";
import type { AiMetadata, ResidentPrivacy } from "@pixel-valley/domain";

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => account.id, { onDelete: "cascade" }),
  residentId: text("resident_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const neighborhood = pgTable("neighborhood", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  slotCount: integer("slot_count").notNull(),
});

export const resident = pgTable("resident", {
  id: text("id").primaryKey(),
  accountId: text("account_id").references(() => account.id),
  kind: text("kind").notNull(),
  displayName: text("display_name").notNull(),
  handle: text("handle").notNull().unique(),
  bio: text("bio").notNull(),
  interests: text("interests").array().notNull(),
  avatarSprite: text("avatar_sprite").notNull(),
  truePresence: text("true_presence").notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" }).notNull(),
  houseId: text("house_id"),
  homeNeighborhoodId: text("home_neighborhood_id"),
  companionResidentId: text("companion_resident_id"),
  ownerResidentId: text("owner_resident_id"),
  aiRole: text("ai_role"),
  aiMetadata: jsonb("ai_metadata").$type<AiMetadata | null>(),
  privacy: jsonb("privacy").$type<ResidentPrivacy>().notNull(),
  firstPostAt: timestamp("first_post_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const house = pgTable("house", {
  id: text("id").primaryKey(),
  residentId: text("resident_id").notNull(),
  neighborhoodId: text("neighborhood_id").notNull(),
  slotIndex: integer("slot_index").notNull(),
  preset: text("preset").notNull(),
  roofTint: text("roof_tint").notNull(),
  nameplate: text("nameplate").notNull(),
});

export const post = pgTable("post", {
  id: text("id").primaryKey(),
  authorResidentId: text("author_resident_id").notNull(),
  type: text("type").notNull(),
  title: text("title"),
  content: text("content").notNull(),
  visibility: text("visibility").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  editedAt: timestamp("edited_at", { withTimezone: true, mode: "date" }),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  replyCount: integer("reply_count").notNull().default(0),
  reactionCount: integer("reaction_count").notNull().default(0),
  tags: text("tags").array().notNull(),
  flags: jsonb("flags")
    .$type<{ hot: boolean; pinned: boolean; aiGenerated: boolean }>()
    .notNull(),
});

export const reply = pgTable("reply", {
  id: text("id").primaryKey(),
  postId: text("post_id")
    .notNull()
    .references(() => post.id, { onDelete: "cascade" }),
  authorResidentId: text("author_resident_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const reaction = pgTable(
  "reaction",
  {
    postId: text("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    residentId: text("resident_id").notNull(),
    kind: text("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.postId, table.residentId] })],
);

export const neighborEdge = pgTable(
  "neighbor_edge",
  {
    fromResidentId: text("from_resident_id").notNull(),
    toResidentId: text("to_resident_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.fromResidentId, table.toResidentId] })],
);

export const block = pgTable(
  "block",
  {
    blockerResidentId: text("blocker_resident_id").notNull(),
    blockedResidentId: text("blocked_resident_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.blockerResidentId, table.blockedResidentId] })],
);

export const visit = pgTable("visit", {
  id: text("id").primaryKey(),
  visitorResidentId: text("visitor_resident_id").notNull(),
  hostResidentId: text("host_resident_id").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
});

export const conversation = pgTable("conversation", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  participantA: text("participant_a").notNull(),
  participantB: text("participant_b").notNull(),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true, mode: "date" }).notNull(),
  lastMessagePreview: text("last_message_preview").notNull(),
});

export const message = pgTable("message", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversation.id, { onDelete: "cascade" }),
  senderResidentId: text("sender_resident_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  via: text("via").notNull(),
});

export const conversationRead = pgTable(
  "conversation_read",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    residentId: text("resident_id").notNull(),
    lastReadAt: timestamp("last_read_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.conversationId, table.residentId] })],
);

export const aiQuota = pgTable(
  "ai_quota",
  {
    residentId: text("resident_id").notNull(),
    date: text("date").notNull(),
    postsCreated: integer("posts_created").notNull().default(0),
    repliesCreated: integer("replies_created").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.residentId, table.date] })],
);

export const schemaMigration = pgTable("schema_migration", {
  id: text("id").primaryKey(),
  appliedAt: timestamp("applied_at", { withTimezone: true, mode: "date" }).notNull(),
});
