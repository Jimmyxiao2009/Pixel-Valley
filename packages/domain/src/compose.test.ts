import { describe, expect, it } from "vitest";
import {
  COMPOSE_DAILY_LIMIT,
  COMPOSE_GAP_MS,
  composeCooldownReason,
  countPlainTextChars,
  POST_CONTENT_MAX,
  validateShortPost,
} from "./compose.ts";
import { shanghaiDateKey } from "./time.ts";
import { CLOSED_TAGS } from "./types.ts";

describe("validateShortPost", () => {
  it("rejects empty, whitespace, and non-string content", () => {
    expect(validateShortPost({ content: "" })).toEqual({ ok: false, message: "先写一句" });
    expect(validateShortPost({ content: "   \n\t  " })).toEqual({ ok: false, message: "先写一句" });
    expect(validateShortPost({ content: 12 })).toEqual({ ok: false, message: "先写一句" });
  });

  it("accepts 1–500 plaintext chars and optional closed tag", () => {
    expect(validateShortPost({ content: "好" })).toEqual({ ok: true, content: "好", tag: null });
    expect(validateShortPost({ content: "  今晚灯很暖  ", tag: "闲聊" })).toEqual({
      ok: true,
      content: "今晚灯很暖",
      tag: "闲聊",
    });
    expect(validateShortPost({ content: "字".repeat(POST_CONTENT_MAX), tag: "" })).toEqual({
      ok: true,
      content: "字".repeat(POST_CONTENT_MAX),
      tag: null,
    });
    for (const tag of CLOSED_TAGS) {
      expect(validateShortPost({ content: "一句", tag }).ok).toBe(true);
    }
  });

  it("rejects overlong content and unknown tags", () => {
    expect(validateShortPost({ content: "字".repeat(POST_CONTENT_MAX + 1) })).toEqual({
      ok: false,
      message: "最多 500 个字",
    });
    expect(validateShortPost({ content: "一句", tag: "八卦" })).toEqual({
      ok: false,
      message: "路牌只能是闲聊、技术、生活、镇务或读书",
    });
    expect(countPlainTextChars("字".repeat(500))).toBe(500);
  });
});

describe("composeCooldownReason", () => {
  const t0 = Date.parse("2026-08-26T12:00:00.000Z");

  function postAt(offsetMs: number, deletedAt: string | null = null) {
    return { createdAt: new Date(t0 + offsetMs).toISOString(), deletedAt };
  }

  it("requires a 10s gap from the latest live post", () => {
    const posts = [postAt(0)];
    expect(composeCooldownReason(posts, new Date(t0 + COMPOSE_GAP_MS - 1))).toBe("gap");
    expect(composeCooldownReason(posts, new Date(t0 + COMPOSE_GAP_MS))).toBeNull();
    expect(composeCooldownReason([postAt(0, "2026-08-26T12:00:01.000Z")], new Date(t0 + 1))).toBeNull();
  });

  it("caps 30 live posts per Asia/Shanghai day", () => {
    const posts = Array.from({ length: COMPOSE_DAILY_LIMIT }, (_, index) => postAt(-60_000 * (index + 1)));
    expect(composeCooldownReason(posts, new Date(t0))).toBe("daily");
    expect(composeCooldownReason(posts.slice(1), new Date(t0))).toBeNull();
  });

  it("resets the daily cap after Shanghai midnight and still honors the gap", () => {
    // 23:50 CST 26 Aug = 15:50 UTC; 00:10 CST 27 Aug = 16:10 UTC.
    const beforeMidnight = Date.parse("2026-08-26T15:50:00.000Z");
    const afterMidnight = Date.parse("2026-08-26T16:10:00.000Z");
    const thirty = Array.from({ length: COMPOSE_DAILY_LIMIT }, (_, index) => ({
      createdAt: new Date(beforeMidnight - index * 60_000).toISOString(),
      deletedAt: null,
    }));
    expect(shanghaiDateKey(new Date(beforeMidnight))).toBe("2026-08-26");
    expect(shanghaiDateKey(new Date(afterMidnight))).toBe("2026-08-27");
    expect(composeCooldownReason(thirty, new Date(afterMidnight))).toBeNull();

    const justPosted = [{ createdAt: new Date(afterMidnight - 3_000).toISOString(), deletedAt: null }];
    expect(composeCooldownReason(justPosted, new Date(afterMidnight))).toBe("gap");
  });
});
