import { describe, expect, it } from "vitest";
import {
  RESIDENT_DOUMIAO,
  RESIDENT_LIN,
  RESIDENT_YOU,
  type Conversation,
  type ConversationListItem,
  type Message,
} from "@pixel-valley/domain";
import { createApp } from "./app.ts";

const NOW = new Date("2026-08-26T12:00:00.000Z");

function cookieFrom(response: Response): string {
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

/** One app instance so both personas share the same store. */
async function world() {
  const app = createApp({ now: NOW, clock: () => NOW });
  const login = async (persona: "you" | "lin") =>
    cookieFrom(
      await app.request("/api/auth/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ persona }),
      }),
    );
  return { app, you: await login("you"), lin: await login("lin") };
}

function json(cookie: string, body?: unknown, method = "POST") {
  return {
    method,
    headers: { cookie, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

async function open(app: ReturnType<typeof createApp>, cookie: string, peerResidentId: string) {
  const response = await app.request("/api/conversations", json(cookie, { peerResidentId }));
  return {
    status: response.status,
    body: (await response.json()) as { conversation: Conversation; via: "knock" | "note" },
  };
}

async function send(
  app: ReturnType<typeof createApp>,
  cookie: string,
  conversationId: string,
  content: string,
) {
  const response = await app.request(
    `/api/conversations/${conversationId}/messages`,
    json(cookie, { content }),
  );
  return { status: response.status, body: await response.json() };
}

async function list(app: ReturnType<typeof createApp>, cookie: string) {
  const response = await app.request("/api/conversations", { headers: { cookie } });
  return ((await response.json()) as { items: ConversationListItem[] }).items;
}

async function history(app: ReturnType<typeof createApp>, cookie: string, conversationId: string) {
  const response = await app.request(`/api/conversations/${conversationId}/messages`, {
    headers: { cookie },
  });
  return {
    status: response.status,
    messages: ((await response.json()) as { messages: Message[] }).messages ?? [],
  };
}

describe("conversation uniqueness (KD-9)", () => {
  it("returns the same thread however many times it is opened", async () => {
    const { app, you } = await world();
    const first = await open(app, you, RESIDENT_LIN);
    const second = await open(app, you, RESIDENT_LIN);
    const third = await open(app, you, RESIDENT_LIN);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.conversation.id).toBe(first.body.conversation.id);
    expect(third.body.conversation.id).toBe(first.body.conversation.id);
    expect(await list(app, you)).toHaveLength(1);
  });

  it("gives both participants the one thread, whoever opened it", async () => {
    const { app, you, lin } = await world();
    const mine = await open(app, you, RESIDENT_LIN);
    const theirs = await open(app, lin, RESIDENT_YOU);
    expect(theirs.body.conversation.id).toBe(mine.body.conversation.id);
  });

  it("refuses a conversation with yourself", async () => {
    const { app, you } = await world();
    const response = await app.request("/api/conversations", json(you, { peerResidentId: RESIDENT_YOU }));
    expect(response.status).toBe(400);
  });

  it("routes the companion cushion into an ordinary thread", async () => {
    const { app, you } = await world();
    const opened = await open(app, you, RESIDENT_DOUMIAO);
    expect(opened.body.conversation.id).toBeTruthy();
    expect(opened.body.via).toBe("knock");
  });
});

describe("messages", () => {
  it("stores a message and reads it back later", async () => {
    const { app, you } = await world();
    const { body } = await open(app, you, RESIDENT_LIN);
    const sent = await send(app, you, body.conversation.id, "在吗");
    expect(sent.status).toBe(201);

    const again = await history(app, you, body.conversation.id);
    expect(again.messages.some((row) => row.content === "在吗")).toBe(true);
  });

  it("stamps via from the gate, ignoring anything the client says", async () => {
    const { app, you } = await world();
    const { body } = await open(app, you, RESIDENT_LIN);
    const response = await app.request(
      `/api/conversations/${body.conversation.id}/messages`,
      json(you, { content: "试试", via: "system" }),
    );
    const message = (await response.json()) as Message;
    expect(message.via).not.toBe("system");
    expect(["knock", "note"]).toContain(message.via);
  });

  it("hides someone else's thread behind 404", async () => {
    const { app, you, lin } = await world();
    const { body } = await open(app, you, RESIDENT_DOUMIAO);
    const peek = await history(app, lin, body.conversation.id);
    expect(peek.status).toBe(404);
  });
});

describe("blocking closes the gate (§5.4)", () => {
  it("refuses a send after the actor blocks the peer", async () => {
    const { app, you } = await world();
    const { body } = await open(app, you, RESIDENT_LIN);
    expect((await send(app, you, body.conversation.id, "先说一句")).status).toBe(201);

    await app.request("/api/blocks", json(you, { residentId: RESIDENT_LIN }));

    const after = await send(app, you, body.conversation.id, "再说一句");
    expect(after.status).toBe(403);
    expect((after.body as { error: { code: string } }).error.code).toBe("blocked");
  });

  it("refuses the peer's send too, and does not let an existing thread bypass the gate", async () => {
    const { app, you, lin } = await world();
    const { body } = await open(app, you, RESIDENT_LIN);
    await app.request("/api/blocks", json(you, { residentId: RESIDENT_LIN }));

    const fromPeer = await send(app, lin, body.conversation.id, "我还能说话吗");
    expect(fromPeer.status).toBe(403);
  });

  it("still lets both sides read the history", async () => {
    const { app, you, lin } = await world();
    const { body } = await open(app, you, RESIDENT_LIN);
    await send(app, you, body.conversation.id, "之前说过的话");
    await app.request("/api/blocks", json(you, { residentId: RESIDENT_LIN }));

    expect((await history(app, you, body.conversation.id)).status).toBe(200);
    expect((await history(app, lin, body.conversation.id)).status).toBe(200);
  });

  it("reopens the door after unblocking", async () => {
    const { app, you } = await world();
    const { body } = await open(app, you, RESIDENT_LIN);
    await app.request("/api/blocks", json(you, { residentId: RESIDENT_LIN }));
    expect((await send(app, you, body.conversation.id, "挡住时")).status).toBe(403);

    await app.request(`/api/blocks/${RESIDENT_LIN}`, { method: "DELETE", headers: { cookie: you } });
    expect((await send(app, you, body.conversation.id, "取消以后")).status).toBe(201);
  });
});

describe("focus and unread", () => {
  it("accepts focus from a participant and refuses a stranger", async () => {
    const { app, you, lin } = await world();
    const { body } = await open(app, you, RESIDENT_DOUMIAO);

    const mine = await app.request(
      `/api/conversations/${body.conversation.id}/focus`,
      json(you, { open: true }, "PUT"),
    );
    expect(mine.status).toBe(204);

    const stranger = await app.request(
      `/api/conversations/${body.conversation.id}/focus`,
      json(lin, { open: true }, "PUT"),
    );
    expect(stranger.status).toBe(404);
  });

  it("counts the peer's messages as unread until the thread is read", async () => {
    const { app, you, lin } = await world();
    const { body } = await open(app, you, RESIDENT_LIN);
    await send(app, lin, body.conversation.id, "我回你一句");

    const before = await list(app, you);
    expect(before[0]?.unreadCount).toBeGreaterThan(0);

    await history(app, you, body.conversation.id);

    const after = await list(app, you);
    expect(after[0]?.unreadCount).toBe(0);
  });

  it("does not count my own messages as unread to me", async () => {
    const { app, you } = await world();
    const { body } = await open(app, you, RESIDENT_LIN);
    await send(app, you, body.conversation.id, "我说的话");
    const items = await list(app, you);
    expect(items[0]?.unreadCount).toBe(0);
  });
});
