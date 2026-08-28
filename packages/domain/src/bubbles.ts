import { excerpt } from "./excerpt.ts";
import type { BubbleView, Post } from "./types.ts";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export function deriveBubbles(
  posts: readonly Post[],
  now: Date,
  residentIds?: ReadonlySet<string>,
): BubbleView[] {
  const nowMs = now.getTime();
  const weekAgo = nowMs - WEEK;
  const dayAgo = nowMs - DAY;
  const byAuthor = new Map<string, Post[]>();

  for (const post of posts) {
    if (post.deletedAt !== null || post.visibility !== "public") {
      continue;
    }
    if (residentIds && !residentIds.has(post.authorResidentId)) {
      continue;
    }
    const created = Date.parse(post.createdAt);
    if (Number.isNaN(created) || created < weekAgo) {
      continue;
    }
    const list = byAuthor.get(post.authorResidentId);
    if (list) {
      list.push(post);
    } else {
      byAuthor.set(post.authorResidentId, [post]);
    }
  }

  const bubbles: BubbleView[] = [];
  for (const [residentId, list] of byAuthor) {
    list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const latest = list[0];
    if (!latest) {
      continue;
    }
    const count24h = list.filter((post) => Date.parse(post.createdAt) >= dayAgo).length;
    bubbles.push({
      residentId,
      postId: latest.id,
      excerpt: excerpt(latest.content),
      createdAt: latest.createdAt,
      count24h,
      hot: latest.flags.hot,
      collapsed: count24h >= 6,
    });
  }

  return bubbles;
}
