import { describe, expect, it } from "vitest";
import {
  RESIDENT_DOUMIAO,
  RESIDENT_LIN,
  RESIDENT_YOU,
  type Conversation,
  type FeedPost,
  type MeResponse,
  type Message,
  type Post,
  type ResidentHomeResponse,
  type TownBoardResponse,
} from "@pixel-valley/domain";
import { createApp } from "./app.ts";
import { createMemoryStore } from "./store.ts";

const NOW = new Date("2026-08-26T12:00:00.000Z");

function cookieFrom(response: Response): string {
  const header = response.headers.get("set-cookie");
  if (!header) {
    return "";
  }
  return header.split(";")[0] ?? "";
}

function createHarness() {
  let current = NOW;
  const store = createMemoryStore(NOW);
  const app = createApp({
    clock: () => current,
    store,
  });
  return {
    app,
    store,
    advance(ms: number) {
      current = new Date(current.getTime() + ms);
    },
  };
}

async function login(app: ReturnType<typeof createApp>, persona: "you" | "lin" = "you") {
  const response = await app.request("/api/auth/demo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ persona }),
  });
  return { response, cookie: cookieFrom(response), body: (await response.json()) as MeResponse };
}

describe("REST §13.4", () => {
  it("patches me/presence/privacy without touching kind or handle", async () => {
    const { app } = createHarness();
    const { cookie } = await login(app);
    const patched = await app.request("/api/me", {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        bio: "新来的住户",
        kind: "ai",
        handle: "qinghe",
        privacy: { showOnline: false },
      }),
    });
    expect(patched.status).toBe(200);
    const me = (await patched.json()) as MeResponse;
    expect(me.resident.bio).toBe("新来的住户");
    expect(me.resident.kind).toBe("human");
    expect(me.resident.handle).toBe("you");
    expect(me.resident.observerPresence).toBe("offline");
    expect(me.resident.truePresence).not.toBe("offline");
    expect(JSON.stringify(me)).not.toContain("passwordHash");

    const presence = await app.request("/api/me/presence", {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ presence: "dnd" }),
    });
    expect(presence.status).toBe(200);
    const dnd = (await presence.json()) as MeResponse;
    expect(dnd.resident.truePresence).toBe("dnd");

    const privacy = await app.request("/api/me/privacy", {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ knock: "nobody", note: "anyone", showOnline: true }),
    });
    expect(privacy.status).toBe(200);
    const after = (await privacy.json()) as MeResponse;
    expect(after.resident.privacy.knock).toBe("nobody");
    expect(after.resident.privacy.note).toBe("anyone");
  });

  it("reads a resident home and posts without truePresence or ?as=", async () => {
    const { app } = createHarness();
    const { cookie } = await login(app);
    const home = await app.request(`/api/residents/${RESIDENT_LIN}?as=ava`, { headers: { cookie } });
    expect(home.status).toBe(200);
    const body = (await home.json()) as ResidentHomeResponse;
    expect(body.resident.handle).toBe("lin");
    expect(body.resident).not.toHaveProperty("truePresence");
    expect(body.house?.slotIndex).toBe(0);

    const posts = await app.request(`/api/residents/${RESIDENT_LIN}/posts`, { headers: { cookie } });
    expect(posts.status).toBe(200);
    const page = (await posts.json()) as { items: Post[] };
    expect(page.items.some((post) => post.id === "post-lin")).toBe(true);
    expect(page.items.every((post) => post.deletedAt === null)).toBe(true);
  });

  it("creates, reads, and soft-deletes a post with cooldown", async () => {
    const { app, advance } = createHarness();
    const { cookie, body: me } = await login(app);
    expect(me.resident.onboarding.firstPostAt).toBeNull();

    const created = await app.request("/api/posts", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ content: "今天把钥匙放进抽屉了", tag: "生活", authorResidentId: "lin" }),
    });
    expect(created.status).toBe(201);
    const post = (await created.json()) as Post;
    expect(post.authorResidentId).toBe(RESIDENT_YOU);
    expect(post.tags).toEqual(["生活"]);

    const tooSoon = await app.request("/api/posts", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ content: "第二句" }),
    });
    expect(tooSoon.status).toBe(429);
    const cooldown = (await tooSoon.json()) as { error: { code: string } };
    expect(cooldown.error.code).toBe("compose_cooldown");

    const got = await app.request(`/api/posts/${post.id}`, { headers: { cookie } });
    expect(got.status).toBe(200);

    const deleted = await app.request(`/api/posts/${post.id}/delete`, {
      method: "POST",
      headers: { cookie },
    });
    expect(deleted.status).toBe(200);
    const after = await app.request(`/api/posts/${post.id}`, { headers: { cookie } });
    expect(after.status).toBe(404);

    const meAfter = await app.request("/api/me", { headers: { cookie } });
    const meBody = (await meAfter.json()) as MeResponse;
    expect(meBody.resident.onboarding.firstPostAt).toBeTruthy();

    advance(11_000);
    const again = await app.request("/api/posts", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ content: "出门就能看见" }),
    });
    expect(again.status).toBe(201);
  });

  it("writes neighbor edges, blocks, visits, and events", async () => {
    const { app } = createHarness();
    const { cookie } = await login(app);
    const edge = await app.request("/api/neighbor-edges", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ toResidentId: "neko" }),
    });
    expect(edge.status).toBe(201);

    const block = await app.request("/api/blocks", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ residentId: "ava" }),
    });
    expect(block.status).toBe(201);

    const visit = await app.request("/api/visits", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ hostResidentId: RESIDENT_LIN }),
    });
    expect(visit.status).toBe(201);
    expect(await visit.text()).toBe("");

    const listed = await app.request("/api/visits", { headers: { cookie } });
    expect(listed.status).toBe(404);

    const event = await app.request("/api/events", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ name: "peek_open" }),
    });
    expect(event.status).toBe(204);
  });

  it("creates conversations with server-authoritative via and ignores client via", async () => {
    const { app } = createHarness();
    await login(app, "lin");
    const { cookie } = await login(app, "you");
    const created = await app.request("/api/conversations", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ peerResidentId: RESIDENT_LIN, via: "note" }),
    });
    expect(created.status).toBe(201);
    const payload = (await created.json()) as { conversation: Conversation; via: string };
    expect(payload.via).toBe("knock");
    expect(payload.conversation.participantResidentIds).toContain(RESIDENT_YOU);
    expect(payload.conversation.participantResidentIds).toContain(RESIDENT_LIN);

    const sent = await app.request(`/api/conversations/${payload.conversation.id}/messages`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ content: "林，在吗", via: "note" }),
    });
    expect(sent.status).toBe(201);
    const message = (await sent.json()) as Message;
    expect(message.via).toBe("knock");
    expect(message.senderResidentId).toBe(RESIDENT_YOU);
    expect(message).not.toHaveProperty("readAt");

    const focus = await app.request(`/api/conversations/${payload.conversation.id}/focus`, {
      method: "PUT",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ open: true }),
    });
    expect(focus.status).toBe(204);

    const blocked = await app.request("/api/blocks", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ residentId: RESIDENT_LIN }),
    });
    expect(blocked.status).toBe(201);
    const refused = await app.request(`/api/conversations/${payload.conversation.id}/messages`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ content: "还在吗" }),
    });
    expect(refused.status).toBe(403);
    const err = (await refused.json()) as { error: { code: string } };
    expect(err.error.code).toBe("blocked");

    const history = await app.request(`/api/conversations/${payload.conversation.id}/messages`, {
      headers: { cookie },
    });
    expect(history.status).toBe(200);
  });

  it("lets you talk to 豆苗 and rejects a hidden companion visitor", async () => {
    const { app } = createHarness();
    const you = await login(app, "you");
    const companion = await app.request("/api/conversations", {
      method: "POST",
      headers: { cookie: you.cookie, "content-type": "application/json" },
      body: JSON.stringify({ peerResidentId: RESIDENT_DOUMIAO }),
    });
    expect(companion.status).toBe(201);
    const payload = (await companion.json()) as { via: string };
    expect(payload.via).toBe("knock");

    await app.request("/api/me/privacy", {
      method: "PATCH",
      headers: { cookie: you.cookie, "content-type": "application/json" },
      body: JSON.stringify({ companionVisible: false }),
    });

    const lin = await login(app, "lin");
    const hidden = await app.request("/api/conversations", {
      method: "POST",
      headers: { cookie: lin.cookie, "content-type": "application/json" },
      body: JSON.stringify({ peerResidentId: RESIDENT_DOUMIAO }),
    });
    expect(hidden.status).toBe(403);
  });

  it("returns seed-backed town feeds", async () => {
    const { app } = createHarness();
    const { cookie } = await login(app);
    const plaza = await app.request("/api/town/plaza?sort=latest", { headers: { cookie } });
    expect(plaza.status).toBe(200);
    const plazaBody = (await plaza.json()) as { items: FeedPost[] };
    expect(plazaBody.items.length).toBeGreaterThan(0);
    expect(plazaBody.items.some((item) => item.id === "post-qinghe")).toBe(true);
    expect(plazaBody.items[0]).toHaveProperty("excerpt");
    expect(plazaBody.items[0]?.author).not.toHaveProperty("truePresence");

    const board = await app.request("/api/town/board", { headers: { cookie } });
    expect(board.status).toBe(200);
    const boardBody = (await board.json()) as TownBoardResponse;
    expect(boardBody.pinned.some((item) => item.id === "post-nanfeng")).toBe(true);

    const library = await app.request("/api/town/library", { headers: { cookie } });
    expect(library.status).toBe(200);
    const libraryBody = (await library.json()) as { items: FeedPost[] };
    expect(libraryBody.items.some((item) => item.type === "article")).toBe(true);

    const cafe = await app.request("/api/town/cafe", { headers: { cookie } });
    expect(cafe.status).toBe(200);
  });
});
