import { describe, expect, it } from "vitest";
import type { CursorPage, FeedPost, TownBoardResponse, TownCafeResponse } from "@pixel-valley/domain";
import { createApp } from "./app.ts";

const NOW = new Date("2026-08-26T12:00:00.000Z");

async function loggedIn() {
  const app = createApp({ now: NOW, clock: () => NOW });
  const response = await app.request("/api/auth/demo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ persona: "you" }),
  });
  return { app, cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "" };
}

async function zone<T>(path: string): Promise<{ status: number; body: T }> {
  const { app, cookie } = await loggedIn();
  const response = await app.request(path, { headers: { cookie } });
  return { status: response.status, body: (await response.json()) as T };
}

describe("town zone feeds (§7.3)", () => {
  it("serves the plaza with authors carried on each card", async () => {
    const { status, body } = await zone<CursorPage<FeedPost>>("/api/town/plaza");
    expect(status).toBe(200);
    expect(body.items.length).toBeGreaterThan(0);
    const first = body.items[0]!;
    expect(first.author.displayName).toBeTruthy();
    expect(first.author.kind).toMatch(/human|ai/);
    expect(first.author.observerPresence).toBeTruthy();
    expect(first.excerpt).toBeTruthy();
    expect(first).toHaveProperty("replyCount");
    expect(first).toHaveProperty("reactionCount");
  });

  it("never leaks truePresence through a feed author", async () => {
    const { body } = await zone<CursorPage<FeedPost>>("/api/town/plaza");
    for (const post of body.items) {
      expect(post.author).not.toHaveProperty("truePresence");
    }
  });

  it("serves the board with pinned, topics and latest", async () => {
    const { status, body } = await zone<TownBoardResponse>("/api/town/board");
    expect(status).toBe(200);
    expect(Array.isArray(body.pinned)).toBe(true);
    expect(Array.isArray(body.topics)).toBe(true);
    expect(Array.isArray(body.latest.items)).toBe(true);
  });

  it("serves the library with long-form cards", async () => {
    const { status, body } = await zone<CursorPage<FeedPost>>("/api/town/library");
    expect(status).toBe(200);
    // §7.3: article type or >= 500 chars.
    for (const post of body.items) {
      expect(post.type === "article" || Array.from(post.content).length >= 500).toBe(true);
    }
  });

  it("serves the cafe with short posts and a writing count", async () => {
    const { status, body } = await zone<TownCafeResponse>("/api/town/cafe");
    expect(status).toBe(200);
    expect(typeof body.writingCount).toBe("number");
    for (const post of body.items) {
      expect(post.type).toBe("post");
      expect(Array.from(post.content).length).toBeLessThan(500);
    }
  });

  it("honours the plaza sort modes", async () => {
    for (const sort of ["recommended", "hot", "latest", "neighbors"]) {
      const { status } = await zone<CursorPage<FeedPost>>(`/api/town/plaza?sort=${sort}`);
      expect(status).toBe(200);
    }
  });

  it("keeps AI at or under the §7.2 per-page quota", async () => {
    // §7.2: maxAi = floor(limit * 0.15) — the page size, not the rows returned.
    const { body } = await zone<CursorPage<FeedPost>>("/api/town/plaza?sort=hot&limit=20");
    const aiCount = body.items.filter((post) => post.author.kind === "ai").length;
    expect(aiCount).toBeLessThanOrEqual(3);
  });

  it("tightens the quota with the page size", async () => {
    const { body } = await zone<CursorPage<FeedPost>>("/api/town/plaza?sort=hot&limit=5");
    const aiCount = body.items.filter((post) => post.author.kind === "ai").length;
    expect(aiCount).toBeLessThanOrEqual(Math.floor(5 * 0.15));
  });

  it("requires a session", async () => {
    const app = createApp({ now: NOW, clock: () => NOW });
    const response = await app.request("/api/town/plaza");
    expect(response.status).toBe(401);
  });
});
