import type { ClosedTag, Post } from "./types.ts";

export const CLOSED_TAGS: readonly ClosedTag[] = ["闲聊", "技术", "生活", "镇务", "读书"];

export const POST_CONTENT_MAX = 500;
export const COMPOSE_GAP_MS = 10_000;
export const COMPOSE_DAILY_LIMIT = 30;
export const COMPOSE_TIME_ZONE = "Asia/Shanghai";

export function isClosedTag(value: unknown): value is ClosedTag {
  return typeof value === "string" && (CLOSED_TAGS as readonly string[]).includes(value);
}

export function countPlainTextChars(text: string): number {
  return Array.from(text).length;
}

export function clampPostContent(text: string): string {
  return Array.from(text).slice(0, POST_CONTENT_MAX).join("");
}

export function shanghaiDateKey(date: Date, timeZone = COMPOSE_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export type ShortPostInput = {
  content: unknown;
  tag?: unknown;
};

export type ShortPostValid =
  | { ok: true; content: string; tag: ClosedTag | null }
  | { ok: false; message: string };

export function validateShortPost(input: ShortPostInput): ShortPostValid {
  if (typeof input.content !== "string") {
    return { ok: false, message: "先写一句" };
  }

  const content = input.content.trim();
  if (countPlainTextChars(content) < 1) {
    return { ok: false, message: "先写一句" };
  }
  if (countPlainTextChars(content) > POST_CONTENT_MAX) {
    return { ok: false, message: "最多 500 个字" };
  }

  if (input.tag === undefined || input.tag === null || input.tag === "") {
    return { ok: true, content, tag: null };
  }
  if (!isClosedTag(input.tag)) {
    return { ok: false, message: "路牌只能是闲聊、技术、生活、镇务或读书" };
  }
  return { ok: true, content, tag: input.tag };
}

export type ComposeCooldownReason = "gap" | "daily";

export function composeCooldownReason(
  posts: Pick<Post, "createdAt" | "deletedAt">[],
  now: Date,
): ComposeCooldownReason | null {
  const live = posts.filter((post) => post.deletedAt === null);
  let lastCreatedAt: string | null = null;
  for (const post of live) {
    if (!lastCreatedAt || post.createdAt > lastCreatedAt) {
      lastCreatedAt = post.createdAt;
    }
  }
  if (lastCreatedAt) {
    const elapsed = now.getTime() - Date.parse(lastCreatedAt);
    if (Number.isFinite(elapsed) && elapsed < COMPOSE_GAP_MS) {
      return "gap";
    }
  }

  const today = shanghaiDateKey(now);
  let todayCount = 0;
  for (const post of live) {
    const created = new Date(post.createdAt);
    if (Number.isNaN(created.getTime())) {
      continue;
    }
    if (shanghaiDateKey(created) === today) {
      todayCount += 1;
    }
  }
  if (todayCount >= COMPOSE_DAILY_LIMIT) {
    return "daily";
  }
  return null;
}
