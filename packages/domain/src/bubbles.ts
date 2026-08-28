import { excerpt } from "./excerpt.ts";
import type { BubbleView, Post } from "./types.ts";

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

export function computeHot(replies24h: number, reactions24h: number): boolean {
  return replies24h >= 8 || reactions24h >= 15;
}

export function livePostsOf(posts: readonly Post[], residentId: string): Post[] {
  return posts
    .filter(
      (post) =>
        post.authorResidentId === residentId &&
        post.deletedAt === null &&
        post.visibility === "public",
    )
    .sort((a, b) => {
      const time = Date.parse(b.createdAt) - Date.parse(a.createdAt);
      if (time !== 0) {
        return time;
      }
      return b.id.localeCompare(a.id);
    });
}

export function bubbleForResident(residentId: string, posts: readonly Post[], now: Date): BubbleView | null {
  const nowMs = now.getTime();
  const live = livePostsOf(posts, residentId);
  const last7 = live.filter((post) => nowMs - Date.parse(post.createdAt) <= WEEK);
  if (last7.length === 0) {
    return null;
  }
  const latest = last7[0]!;
  const count24h = live.filter((post) => nowMs - Date.parse(post.createdAt) <= DAY).length;
  return {
    residentId,
    postId: latest.id,
    excerpt: excerpt(latest.content),
    createdAt: latest.createdAt,
    count24h,
    hot: latest.flags.hot,
    collapsed: count24h >= 6,
  };
}

export function bubblesForResidents(
  residentIds: Iterable<string>,
  posts: readonly Post[],
  now: Date,
): BubbleView[] {
  const seen = new Set<string>();
  const bubbles: BubbleView[] = [];
  for (const id of residentIds) {
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    const bubble = bubbleForResident(id, posts, now);
    if (bubble) {
      bubbles.push(bubble);
    }
  }
  return bubbles;
}

/**
 * Whole-world variant: without `residentIds` it derives a bubble for every author
 * that still has a live public post. Delegates to bubbleForResident so the §3.3
 * rules (7-day TTL, 24h count, collapse at 6) live in exactly one place.
 */
export function deriveBubbles(
  posts: readonly Post[],
  now: Date,
  residentIds?: ReadonlySet<string>,
): BubbleView[] {
  const ids =
    residentIds ??
    new Set(
      posts
        .filter((post) => post.deletedAt === null && post.visibility === "public")
        .map((post) => post.authorResidentId),
    );
  return bubblesForResidents(ids, posts, now);
}
