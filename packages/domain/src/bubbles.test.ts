import { describe, expect, it } from "vitest";
import { bubbleForResident } from "./bubbles.ts";
import { createSeed, RESIDENT_LIN, RESIDENT_YOU } from "./seed.ts";

const now = new Date("2026-08-26T12:00:00.000Z");

describe("bubbleForResident", () => {
  const world = createSeed(now);

  it("shows 林's 2h-old seed post", () => {
    const bubble = bubbleForResident(RESIDENT_LIN, world.posts, now);
    expect(bubble?.postId).toBe("post-lin");
    expect(bubble?.collapsed).toBe(false);
    expect(bubble?.excerpt).toContain("bug");
  });

  it("does not invent a bubble for you before the first post", () => {
    expect(bubbleForResident(RESIDENT_YOU, world.posts, now)).toBeNull();
  });

  it("drops bubbles after a soft delete", () => {
    const deleted = world.posts.map((post) =>
      post.id === "post-lin" ? { ...post, deletedAt: now.toISOString() } : post,
    );
    expect(bubbleForResident(RESIDENT_LIN, deleted, now)).toBeNull();
  });
});
