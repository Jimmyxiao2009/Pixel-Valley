const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * §15 product voice: residents read 「3 小时前」, never an ISO timestamp.
 * `now` is a parameter so every surface renders the same words and tests stay
 * deterministic.
 */
export function relativeTime(createdAt: string, now: Date): string {
  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) {
    return "";
  }
  const elapsed = now.getTime() - created;
  if (elapsed < MINUTE) {
    return "刚刚";
  }
  if (elapsed < HOUR) {
    return `${Math.floor(elapsed / MINUTE)} 分钟前`;
  }
  if (elapsed < DAY) {
    return `${Math.floor(elapsed / HOUR)} 小时前`;
  }
  const days = Math.floor(elapsed / DAY);
  return days < 7 ? `${days} 天前` : createdAt.slice(0, 10);
}

/** §4.11 reply box limit, matching the server's own check. */
export const REPLY_CONTENT_MAX = 1000;

export type ReplyValid =
  | { ok: true; content: string }
  | { ok: false; message: string };

/**
 * Client-side sanity only. The server re-checks this, plus the cooldown and
 * whether the post still exists — its answer is the one that counts.
 */
export function validateReply(content: unknown): ReplyValid {
  if (typeof content !== "string") {
    return { ok: false, message: "先写一句" };
  }
  const trimmed = content.trim();
  if (trimmed.length < 1) {
    return { ok: false, message: "先写一句" };
  }
  if (Array.from(trimmed).length > REPLY_CONTENT_MAX) {
    return { ok: false, message: `最多 ${REPLY_CONTENT_MAX} 个字` };
  }
  return { ok: true, content: trimmed };
}
