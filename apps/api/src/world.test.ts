import { describe, expect, it } from "vitest";
import { createSeed, RESIDENT_AVA, RESIDENT_YOU, type Reaction } from "@pixel-valley/domain";
import { cafeFeed, cafeHotScore } from "./world.ts";

const now = new Date("2026-08-26T12:00:00.000Z");

describe("cafe hot ranking", () => {
  it("uses hotScore * exp(-ageHours/6)", () => {
    const recent = cafeHotScore(10, new Date(now.getTime() - 60 * 60 * 1000).toISOString(), now);
    const old = cafeHotScore(10, new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(), now);
    expect(recent).toBeCloseTo(10 * Math.exp(-1 / 6));
    expect(old).toBeCloseTo(10 * Math.exp(-2));
    expect(recent).toBeGreaterThan(old);
  });

  it("lets 6h decay beat a staler higher raw hotScore", () => {
    const world = createSeed(now);
    world.posts.push({
      id: "post-fresh",
      authorResidentId: RESIDENT_YOU,
      type: "post",
      title: null,
      content: "刚写的一句",
      visibility: "public",
      createdAt: now.toISOString(),
      editedAt: null,
      deletedAt: null,
      replyCount: 0,
      reactionCount: 3,
      tags: ["闲聊"],
      flags: { hot: false, pinned: false, aiGenerated: false },
    });
    const reactions: Reaction[] = [
      ...Array.from({ length: 15 }, (_, i) => ({
        postId: "post-ava",
        residentId: `r-${i}`,
        kind: "like" as const,
        createdAt: now.toISOString(),
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        postId: "post-fresh",
        residentId: `f-${i}`,
        kind: "like" as const,
        createdAt: now.toISOString(),
      })),
    ];
    const me = world.residents.find((resident) => resident.id === RESIDENT_YOU)!;
    const page = cafeFeed(world, me, [], reactions, now, "hot", undefined, 20);
    expect(page.items[0]?.id).toBe("post-fresh");
    expect(page.items.some((item) => item.authorResidentId === RESIDENT_AVA)).toBe(true);
  });
});
