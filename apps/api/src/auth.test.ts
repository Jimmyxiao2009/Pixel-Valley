import { describe, expect, it } from "vitest";
import {
  createSeed,
  getStreetMine,
  labelStreetMineSlot,
  NEIGHBORHOOD_WUTONG,
  RESIDENT_DOUMIAO,
  RESIDENT_LIN,
  RESIDENT_YOU,
  type MeResponse,
  type NeighborhoodView,
  type StreetMineResponse,
} from "@pixel-valley/domain";
import { SESSION_COOKIE } from "./accounts.ts";
import { createApp } from "./app.ts";

const NOW = new Date("2026-08-26T12:00:00.000Z");
const YOU_FIXTURE = ["林", "南风◇", "Neko", "空", "你★", "青禾◇", "Ava", "空", "树", "公交+路路", "路", "树"];
const LIN_FIXTURE = ["你", "南风◇", "Neko", "空", "林★", "青禾◇", "Ava", "空", "树", "公交+路路", "路", "树"];

function cookieFrom(response: Response): string {
  const header = response.headers.get("set-cookie");
  if (!header) {
    return "";
  }
  return header.split(";")[0] ?? "";
}

async function login(persona: "you" | "lin") {
  const app = createApp(NOW);
  const response = await app.request("/api/auth/demo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ persona }),
  });
  return { app, response, cookie: cookieFrom(response) };
}

function labelsFromMine(body: StreetMineResponse, meId: string): string[] {
  const world = createSeed(NOW);
  return body.slots.map((slot) => labelStreetMineSlot(slot, world, meId));
}

describe("demo auth", () => {
  it("sets pv_session and never ships passwordHash", async () => {
    const { app, response, cookie } = await login("you");
    expect(response.status).toBe(200);

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${SESSION_COOKIE}=`);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Path=\//i);
    expect(setCookie).toMatch(/Max-Age=1209600/i);
    expect(setCookie).not.toMatch(/Secure/i);

    const body = (await response.json()) as MeResponse;
    expect(JSON.stringify(body)).not.toContain("passwordHash");
    expect(body.account).not.toHaveProperty("passwordHash");
    expect(body.resident.handle).toBe("you");
    expect(body.resident.kind).toBe("human");
    expect(body.resident.truePresence).toBe("online");
    expect(body.resident.companionResidentId).toBe(RESIDENT_DOUMIAO);
    expect(body.unreadTotal).toBe(0);

    const me = await app.request("/api/me", { headers: { cookie } });
    expect(me.status).toBe(200);
    const meBody = (await me.json()) as MeResponse;
    expect(JSON.stringify(meBody)).not.toContain("passwordHash");
    expect(meBody.resident.truePresence).toBeDefined();
    expect(meBody.account.email).toBe("you@pixel-valley.local");
  });

  it("GET /api/me is 401 without a session", async () => {
    const app = createApp(NOW);
    const anonymous = await app.request("/api/me");
    expect(anonymous.status).toBe(401);
    const error = (await anonymous.json()) as { error: { code: string; message: string } };
    expect(error.error.code).toBe("unauthenticated");
    expect(JSON.stringify(error)).not.toContain("passwordHash");
  });

  it("unauthenticated street and neighborhood reads are 401", async () => {
    const app = createApp(NOW);
    const street = await app.request("/api/street/mine");
    expect(street.status).toBe(401);
    const neighborhood = await app.request(`/api/neighborhoods/${NEIGHBORHOOD_WUTONG}`);
    expect(neighborhood.status).toBe(401);
  });

  it("logout clears the session", async () => {
    const { app, cookie } = await login("you");
    const logout = await app.request("/api/auth/logout", {
      method: "POST",
      headers: { cookie },
    });
    expect(logout.status).toBe(204);
    const me = await app.request("/api/me", { headers: { cookie } });
    expect(me.status).toBe(401);
  });
});

describe("GET /api/street/mine and neighborhoods", () => {
  it("persona=you matches the frozen grid and ignores ?as=", async () => {
    const { app, cookie } = await login("you");
    const response = await app.request("/api/street/mine?as=lin", { headers: { cookie } });
    expect(response.status).toBe(200);
    const body = (await response.json()) as StreetMineResponse;
    expect(labelsFromMine(body, RESIDENT_YOU)).toEqual(YOU_FIXTURE);
    expect(body.slots.some((slot) => slot.residentId === RESIDENT_DOUMIAO)).toBe(false);
    expect(body.residents.some((resident) => resident.id === RESIDENT_DOUMIAO)).toBe(false);
    expect(body.residents.some((resident) => "truePresence" in resident)).toBe(false);
    expect(JSON.stringify(body)).not.toContain("passwordHash");
    const linBubble = body.bubbles.find((bubble) => bubble.residentId === RESIDENT_LIN);
    expect(linBubble?.excerpt).toBe("修好了那个折磨我一周的 bug");
    expect(linBubble?.collapsed).toBe(false);
    expect(body.bubbles.some((bubble) => bubble.residentId === RESIDENT_DOUMIAO)).toBe(false);
  });

  it("persona=lin matches the frozen swapped grid", async () => {
    const { app, cookie } = await login("lin");
    const response = await app.request("/api/street/mine", { headers: { cookie } });
    expect(response.status).toBe(200);
    const body = (await response.json()) as StreetMineResponse;
    expect(labelsFromMine(body, RESIDENT_LIN)).toEqual(LIN_FIXTURE);
    expect(body.slots[4]?.residentId).toBe(RESIDENT_LIN);
    expect(getStreetMine(createSeed(NOW), RESIDENT_LIN, NOW).map((slot) => slot.residentId)).toEqual(
      body.slots.map((slot) => slot.residentId),
    );
  });

  it("canonical 梧桐街 keeps persistent lots and excludes doumiao", async () => {
    const { app, cookie } = await login("you");
    const response = await app.request(`/api/neighborhoods/${NEIGHBORHOOD_WUTONG}`, {
      headers: { cookie },
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as NeighborhoodView;
    const houseLots = body.houses
      .filter((house) => house.neighborhoodId === NEIGHBORHOOD_WUTONG)
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .map((house) => [house.slotIndex, house.residentId]);
    expect(houseLots).toEqual([
      [0, "lin"],
      [2, "neko"],
      [4, "you"],
      [6, "ava"],
    ]);
    expect(body.houses.some((house) => house.residentId === RESIDENT_DOUMIAO)).toBe(false);
    expect(body.residents.some((resident) => resident.id === RESIDENT_DOUMIAO)).toBe(false);
    expect(body.tiles.some((tile) => tile.kind === "bus-stop")).toBe(true);
    expect(body.bubbles.some((bubble) => bubble.residentId === RESIDENT_LIN)).toBe(true);
    expect(body.bubbles.some((bubble) => bubble.residentId === RESIDENT_DOUMIAO)).toBe(false);
  });
});
