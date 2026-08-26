import { describe, expect, it } from "vitest";
import { deriveBubbles } from "./bubbles.ts";
import { excerpt } from "./excerpt.ts";
import {
  createSeed,
  RESIDENT_AVA,
  RESIDENT_DOUMIAO,
  RESIDENT_LIN,
  RESIDENT_YOU,
} from "./seed.ts";
import type { Post } from "./types.ts";

const NOW = new Date("2026-08-26T12:00:00.000Z");

function post(partial: Pick<Post, "id" | "authorResidentId" | "content" | "createdAt"> & Partial<Post>): Post {
  return {
    type: "post",
    title: null,
    visibility: "public",
    editedAt: null,
    deletedAt: null,
    replyCount: 0,
    reactionCount: 0,
    tags: ["闲聊"],
    flags: { hot: false, pinned: false, aiGenerated: false },
    ...partial,
  };
}

describe("deriveBubbles", () => {
  it("collapses a house at 6 posts in 24h and not at 5", () => {
    const five = Array.from({ length: 5 }, (_, index) =>
      post({
        id: `p5-${index}`,
        authorResidentId: "busy",
        content: `第${index}句`,
        createdAt: new Date(NOW.getTime() - index * 60 * 1000).toISOString(),
      }),
    );
    expect(deriveBubbles(five, NOW).find((bubble) => bubble.residentId === "busy")?.collapsed).toBe(false);
    expect(deriveBubbles(five, NOW).find((bubble) => bubble.residentId === "busy")?.count24h).toBe(5);

    const six = [
      ...five,
      post({
        id: "p6",
        authorResidentId: "busy",
        content: "第六句",
        createdAt: new Date(NOW.getTime() - 5 * 60 * 1000).toISOString(),
      }),
    ];
    const collapsed = deriveBubbles(six, NOW).find((bubble) => bubble.residentId === "busy");
    expect(collapsed?.collapsed).toBe(true);
    expect(collapsed?.count24h).toBe(6);
  });

  it("still shows a 3-day-old single post and hides >7-day posts", () => {
    const threeDays = [
      post({
        id: "oldish",
        authorResidentId: "slow",
        content: "三天前还在",
        createdAt: new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    ];
    const shown = deriveBubbles(threeDays, NOW);
    expect(shown).toHaveLength(1);
    expect(shown[0]?.count24h).toBe(0);
    expect(shown[0]?.collapsed).toBe(false);
    expect(shown[0]?.excerpt).toBe("三天前还在");

    const stale = [
      post({
        id: "stale",
        authorResidentId: "slow",
        content: "上周的话",
        createdAt: new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    ];
    expect(deriveBubbles(stale, NOW)).toEqual([]);
  });

  it("uses excerpt() and ignores deleted posts", () => {
    const posts = [
      post({
        id: "long",
        authorResidentId: "writer",
        content: "字".repeat(40),
        createdAt: NOW.toISOString(),
      }),
      post({
        id: "gone",
        authorResidentId: "writer",
        content: "不该出现",
        createdAt: NOW.toISOString(),
        deletedAt: NOW.toISOString(),
      }),
    ];
    const [bubble] = deriveBubbles(posts, NOW);
    expect(bubble?.excerpt).toBe(excerpt("字".repeat(40)));
    expect(bubble?.postId).toBe("long");
  });

  it("seeds lin/ava bubbles and never derives doumiao or you", () => {
    const world = createSeed(NOW);
    const bubbles = deriveBubbles(world.posts, NOW);
    const lin = bubbles.find((bubble) => bubble.residentId === RESIDENT_LIN);
    const ava = bubbles.find((bubble) => bubble.residentId === RESIDENT_AVA);
    expect(lin?.excerpt).toBe("修好了那个折磨我一周的 bug");
    expect(lin?.collapsed).toBe(false);
    expect(ava?.excerpt).toBe("新搬来，还在认路");
    expect(ava?.count24h).toBe(0);
    expect(bubbles.some((bubble) => bubble.residentId === RESIDENT_YOU)).toBe(false);
    expect(bubbles.some((bubble) => bubble.residentId === RESIDENT_DOUMIAO)).toBe(false);
  });
});
