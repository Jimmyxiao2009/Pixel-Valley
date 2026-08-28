import { describe, expect, it } from "vitest";
import { RESIDENT_LIN, RESIDENT_YOU, type ResidentHomeResponse } from "@pixel-valley/domain";
import { createApp } from "./app.ts";

const NOW = new Date("2026-08-26T12:00:00.000Z");

function cookieFrom(response: Response): string {
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

async function login(persona: "you" | "lin" = "you") {
  const app = createApp({ now: NOW, clock: () => NOW });
  const response = await app.request("/api/auth/demo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ persona }),
  });
  return { app, cookie: cookieFrom(response) };
}

async function peek(app: ReturnType<typeof createApp>, cookie: string, id: string) {
  const response = await app.request(`/api/residents/${id}`, { headers: { cookie } });
  return { status: response.status, body: (await response.json()) as ResidentHomeResponse };
}

describe("GET /api/residents/:id — peek card payload", () => {
  it("carries everything §4.4 puts on one screen", async () => {
    const { app, cookie } = await login();
    const { status, body } = await peek(app, cookie, RESIDENT_LIN);

    expect(status).toBe(200);
    expect(body.resident.displayName).toBe("林");
    expect(body.resident).not.toHaveProperty("truePresence");
    expect(body.house?.slotIndex).toBe(0);
    expect(body.neighborhood?.name).toBe("梧桐街");
    expect(body.latestBubble?.excerpt).toContain("bug");
    expect(body.relation).toEqual({
      isNeighbor: false,
      blocking: false,
      blockedBy: false,
      isSelf: false,
    });
  });

  it("reports the gate verdict rather than leaving it to the client", async () => {
    const { app, cookie } = await login();
    const { body } = await peek(app, cookie, RESIDENT_LIN);
    // Seed 林 allows anyone; the verdict is whichever door §5.4 opens.
    expect(body.messageGate.ok).toBe(true);
    if (body.messageGate.ok) {
      expect(["knock", "note"]).toContain(body.messageGate.via);
    }
  });

  it("marks your own house as self", async () => {
    const { app, cookie } = await login();
    const { body } = await peek(app, cookie, RESIDENT_YOU);
    expect(body.relation.isSelf).toBe(true);
    expect(body.relation.isNeighbor).toBe(false);
  });

  it("reflects a neighbor edge after it is created", async () => {
    const { app, cookie } = await login();
    const before = await peek(app, cookie, RESIDENT_LIN);
    expect(before.body.relation.isNeighbor).toBe(false);

    const created = await app.request("/api/neighbor-edges", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ toResidentId: RESIDENT_LIN }),
    });
    expect(created.status).toBe(201);

    const after = await peek(app, cookie, RESIDENT_LIN);
    expect(after.body.relation.isNeighbor).toBe(true);

    const removed = await app.request(`/api/neighbor-edges/${RESIDENT_LIN}`, {
      method: "DELETE",
      headers: { cookie },
    });
    expect(removed.status).toBe(204);
    expect((await peek(app, cookie, RESIDENT_LIN)).body.relation.isNeighbor).toBe(false);
  });

  it("reports a block in both directions and closes the gate", async () => {
    const { app, cookie } = await login();
    await app.request("/api/blocks", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ residentId: RESIDENT_LIN }),
    });

    const { body } = await peek(app, cookie, RESIDENT_LIN);
    expect(body.relation.blocking).toBe(true);
    expect(body.relation.blockedBy).toBe(false);
    expect(body.messageGate).toEqual({ ok: false, code: "blocked" });
  });
});
