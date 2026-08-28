import { describe, expect, it } from "vitest";
import { relativeTime, REPLY_CONTENT_MAX, validateReply } from "./post-detail.ts";

const NOW = new Date("2026-08-26T12:00:00.000Z");

function ago(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString();
}

describe("relativeTime", () => {
  it("speaks in the product's words, never an ISO string", () => {
    expect(relativeTime(ago(10_000), NOW)).toBe("刚刚");
    expect(relativeTime(ago(5 * 60_000), NOW)).toBe("5 分钟前");
    expect(relativeTime(ago(3 * 3_600_000), NOW)).toBe("3 小时前");
    expect(relativeTime(ago(2 * 86_400_000), NOW)).toBe("2 天前");
  });

  it("falls back to a plain date once a week has passed", () => {
    expect(relativeTime("2026-08-01T09:00:00.000Z", NOW)).toBe("2026-08-01");
  });

  it("is deterministic for a given now", () => {
    expect(relativeTime(ago(3 * 3_600_000), NOW)).toBe(relativeTime(ago(3 * 3_600_000), NOW));
  });

  it("says nothing rather than NaN for a broken timestamp", () => {
    expect(relativeTime("not-a-date", NOW)).toBe("");
  });
});

describe("validateReply", () => {
  it("accepts an ordinary line and trims it", () => {
    expect(validateReply("  恭喜  ")).toEqual({ ok: true, content: "恭喜" });
  });

  it("refuses empty and whitespace-only replies", () => {
    expect(validateReply("").ok).toBe(false);
    expect(validateReply("   ").ok).toBe(false);
    expect(validateReply(undefined).ok).toBe(false);
  });

  it("holds the same limit the server enforces", () => {
    expect(validateReply("字".repeat(REPLY_CONTENT_MAX)).ok).toBe(true);
    expect(validateReply("字".repeat(REPLY_CONTENT_MAX + 1)).ok).toBe(false);
  });
});
