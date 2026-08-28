import { describe, expect, it } from "vitest";
import {
  COMPOSE_DAILY_LIMIT,
  COMPOSE_GAP_MS,
  POST_CONTENT_MAX,
  RESIDENT_YOU,
  type MeResponse,
  type Post,
  type ResidentHomeResponse,
  type ResidentPostsResponse,
} from "@pixel-valley/domain";
import { createApp } from "./app.ts";

/** Kept from the PR-3 line; createApp now takes a plain () => Date clock. */
type AppClock = { now: () => Date };

const NOW = new Date("2026-08-26T12:00:00.000Z");

function cookieFrom(response: Response): string {
  const header = response.headers.get("set-cookie");
  if (!header) {
    return "";
  }
  return header.split(";")[0] ?? "";
}

async function login(persona: "you" | "lin", clock?: AppClock) {
  const app = createApp({ now: NOW, clock: (clock ?? { now: () => NOW }).now });
  const response = await app.request("/api/auth/demo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ persona }),
  });
  return { app, response, cookie: cookieFrom(response) };
}

function postBody(content: string, extra: Record<string, unknown> = {}) {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content, ...extra }),
  };
}

describe("POST /api/posts", () => {
  it("authors from the session and ignores body.authorResidentId", async () => {
    const { app, cookie } = await login("you");
    const response = await app.request("/api/posts", {
      ...postBody("今晚灯很暖", { tag: "闲聊", authorResidentId: "lin" }),
      headers: { "content-type": "application/json", cookie },
    });
    expect(response.status).toBe(201);
    const post = (await response.json()) as Post;
    expect(post.authorResidentId).toBe(RESIDENT_YOU);
    expect(post.content).toBe("今晚灯很暖");
    expect(post.type).toBe("post");
    expect(post.tags).toEqual(["闲聊"]);
    expect(post.title).toBeNull();

    const me = await app.request("/api/me", { headers: { cookie } });
    const meBody = (await me.json()) as MeResponse;
    expect(meBody.resident.onboarding.firstPostAt).toBe(post.createdAt);

    const list = await app.request(`/api/residents/${RESIDENT_YOU}/posts`, { headers: { cookie } });
    expect(list.status).toBe(200);
    const listed = (await list.json()) as ResidentPostsResponse;
    expect(listed.items[0]?.id).toBe(post.id);
    expect(listed.items[0]?.content).toBe("今晚灯很暖");
  });

  it("returns 401 without a session", async () => {
    const app = createApp(NOW);
    const response = await app.request("/api/posts", postBody("一句"));
    expect(response.status).toBe(401);
    const error = (await response.json()) as { error: { code: string } };
    expect(error.error.code).toBe("unauthenticated");
  });

  it("validates empty, overlong, and unknown tags", async () => {
    const { app, cookie } = await login("you");
    const headers = { "content-type": "application/json", cookie };

    const empty = await app.request("/api/posts", { ...postBody("   "), headers });
    expect(empty.status).toBe(400);
    expect(((await empty.json()) as { error: { code: string } }).error.code).toBe("validation_error");

    const long = await app.request("/api/posts", {
      ...postBody("字".repeat(POST_CONTENT_MAX + 1)),
      headers,
    });
    expect(long.status).toBe(400);

    const tag = await app.request("/api/posts", {
      ...postBody("一句", { tag: "八卦" }),
      headers,
    });
    expect(tag.status).toBe(400);
  });

  it("returns 429 compose_cooldown within 10s and after 30 posts in a Shanghai day", async () => {
    let t = NOW.getTime();
    const clock: AppClock = { now: () => new Date(t) };
    const { app, cookie } = await login("you", clock);
    const headers = { "content-type": "application/json", cookie };

    const first = await app.request("/api/posts", { ...postBody("第一句"), headers });
    expect(first.status).toBe(201);

    const tooSoon = await app.request("/api/posts", { ...postBody("第二句"), headers });
    expect(tooSoon.status).toBe(429);
    const tooSoonBody = (await tooSoon.json()) as { error: { code: string } };
    expect(tooSoonBody.error.code).toBe("compose_cooldown");

    t += COMPOSE_GAP_MS;
    const second = await app.request("/api/posts", { ...postBody("第二句"), headers });
    expect(second.status).toBe(201);

    for (let i = 3; i <= COMPOSE_DAILY_LIMIT; i += 1) {
      t += COMPOSE_GAP_MS;
      const response = await app.request("/api/posts", { ...postBody(`第${i}句`), headers });
      expect(response.status).toBe(201);
    }

    t += COMPOSE_GAP_MS;
    const thirtyFirst = await app.request("/api/posts", { ...postBody("第31句"), headers });
    expect(thirtyFirst.status).toBe(429);
    expect(((await thirtyFirst.json()) as { error: { code: string } }).error.code).toBe("compose_cooldown");
  });
});

describe("GET /api/residents/:id", () => {
  it("omits truePresence and lists seed posts for lin", async () => {
    const { app, cookie } = await login("you");
    const resident = await app.request("/api/residents/lin", { headers: { cookie } });
    expect(resident.status).toBe(200);
    const body = (await resident.json()) as ResidentHomeResponse;
    expect(body.resident.id).toBe("lin");
    expect(body.resident).not.toHaveProperty("truePresence");
    expect(body.house?.neighborhoodId).toBe("wutong");

    const posts = await app.request("/api/residents/lin/posts", { headers: { cookie } });
    const listed = (await posts.json()) as ResidentPostsResponse;
    expect(listed.items.some((post) => post.content.includes("bug"))).toBe(true);
    expect(listed.items.every((post) => post.deletedAt === null)).toBe(true);
  });
});
