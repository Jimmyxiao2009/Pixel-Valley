import { describe, expect, it } from "vitest";
import { RESIDENT_LIN, type PostDetailResponse, type Reply } from "@pixel-valley/domain";
import { createApp } from "./app.ts";

const NOW = new Date("2026-08-26T12:00:00.000Z");

function cookieFrom(response: Response): string {
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

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

function json(cookie: string, body?: unknown) {
  return {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}

async function detail(app: ReturnType<typeof createApp>, cookie: string, id: string) {
  const response = await app.request(`/api/posts/${id}`, { headers: { cookie } });
  return { status: response.status, body: (await response.json()) as PostDetailResponse };
}

describe("GET /api/posts/:id (§4.11)", () => {
  it("carries the post, its author and its replies in one read", async () => {
    const { app, you } = await world();
    const { status, body } = await detail(app, you, "post-lin");

    expect(status).toBe(200);
    expect(body.post.content).toContain("bug");
    expect(body.author?.displayName).toBe("林");
    expect(body.author).not.toHaveProperty("truePresence");
    expect(Array.isArray(body.replies)).toBe(true);
    expect(body.reacted).toBe(false);
  });

  it("resolves every reply author without a second read", async () => {
    const { app, you, lin } = await world();
    await app.request("/api/posts/post-lin/replies", json(you, { content: "恭喜" }));
    await app.request("/api/posts/post-lin/replies", json(lin, { content: "谢谢" }));

    const { body } = await detail(app, you, "post-lin");
    expect(body.replies).toHaveLength(2);
    for (const reply of body.replies) {
      expect(reply.author?.displayName).toBeTruthy();
      expect(reply.author?.kind).toMatch(/human|ai/);
    }
    expect(body.replies.map((row) => row.author?.handle)).toEqual(["you", "lin"]);
  });

  it("404s a post that does not exist", async () => {
    const { app, you } = await world();
    expect((await detail(app, you, "nope")).status).toBe(404);
  });

  it("404s a post after it is taken down", async () => {
    const { app, lin } = await world();
    const removed = await app.request("/api/posts/post-lin/delete", json(lin));
    expect(removed.status).toBe(200);
    expect((await detail(app, lin, "post-lin")).status).toBe(404);
  });
});

describe("POST /api/posts/:id/replies", () => {
  it("stores a reply and counts it on the post", async () => {
    const { app, you } = await world();
    const before = await detail(app, you, "post-lin");

    const response = await app.request("/api/posts/post-lin/replies", json(you, { content: "恭喜" }));
    expect(response.status).toBe(201);
    const reply = (await response.json()) as Reply;
    expect(reply.content).toBe("恭喜");

    const after = await detail(app, you, "post-lin");
    expect(after.body.post.replyCount).toBe(before.body.post.replyCount + 1);
    expect(after.body.replies.some((row) => row.content === "恭喜")).toBe(true);
  });

  it("authors from the session, ignoring anything the client claims", async () => {
    const { app, you } = await world();
    const response = await app.request(
      "/api/posts/post-lin/replies",
      json(you, { content: "我是谁", authorResidentId: RESIDENT_LIN }),
    );
    const reply = (await response.json()) as Reply;
    expect(reply.authorResidentId).toBe("you");
  });

  it("refuses empty and over-long replies", async () => {
    const { app, you } = await world();
    expect((await app.request("/api/posts/post-lin/replies", json(you, { content: "   " }))).status).toBe(400);
    expect(
      (await app.request("/api/posts/post-lin/replies", json(you, { content: "字".repeat(1001) })))
        .status,
    ).toBe(400);
  });

  it("refuses a reply to a post that is gone", async () => {
    const { app, you, lin } = await world();
    await app.request("/api/posts/post-lin/delete", json(lin));
    expect((await app.request("/api/posts/post-lin/replies", json(you, { content: "还在吗" }))).status).toBe(404);
  });

  it("needs a session", async () => {
    const app = createApp({ now: NOW, clock: () => NOW });
    const response = await app.request("/api/posts/post-lin/replies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "偷偷说" }),
    });
    expect(response.status).toBe(401);
  });
});

describe("POST /api/posts/:id/reactions", () => {
  it("counts the first 拍一拍 and reports it back on the detail", async () => {
    const { app, you } = await world();
    const response = await app.request("/api/posts/post-lin/reactions", json(you));
    expect(response.status).toBe(201);

    const { body } = await detail(app, you, "post-lin");
    expect(body.post.reactionCount).toBe(1);
    expect(body.reacted).toBe(true);
  });

  it("is add-only: reacting twice does not double the count or undo it", async () => {
    const { app, you } = await world();
    await app.request("/api/posts/post-lin/reactions", json(you));
    const second = await app.request("/api/posts/post-lin/reactions", json(you));
    // Idempotent, not a toggle — the existing row comes back with 200.
    expect(second.status).toBe(200);

    const { body } = await detail(app, you, "post-lin");
    expect(body.post.reactionCount).toBe(1);
    expect(body.reacted).toBe(true);
  });

  it("keeps each resident's 拍一拍 separate", async () => {
    const { app, you, lin } = await world();
    await app.request("/api/posts/post-lin/reactions", json(you));
    await app.request("/api/posts/post-lin/reactions", json(lin));

    const mine = await detail(app, you, "post-lin");
    expect(mine.body.post.reactionCount).toBe(2);
    expect(mine.body.reacted).toBe(true);
  });

  it("reports reacted=false for someone who has not reacted", async () => {
    const { app, you, lin } = await world();
    await app.request("/api/posts/post-lin/reactions", json(you));
    const theirs = await detail(app, lin, "post-lin");
    expect(theirs.body.post.reactionCount).toBe(1);
    expect(theirs.body.reacted).toBe(false);
  });

  it("refuses a reaction on a post that is gone", async () => {
    const { app, you, lin } = await world();
    await app.request("/api/posts/post-lin/delete", json(lin));
    expect((await app.request("/api/posts/post-lin/reactions", json(you))).status).toBe(404);
  });
});
