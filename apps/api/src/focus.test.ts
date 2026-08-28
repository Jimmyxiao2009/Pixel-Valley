import { describe, expect, it } from "vitest";
import {
  NEIGHBORHOOD_WUTONG,
  NEIGHBORHOOD_ZHENXIN,
  RESIDENT_LIN,
  RESIDENT_NANFENG,
  RESIDENT_YOU,
  type NeighborhoodView,
} from "@pixel-valley/domain";
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

async function street(path: string) {
  const { app, cookie } = await loggedIn();
  const response = await app.request(path, { headers: { cookie } });
  return { status: response.status, body: (await response.json()) as NeighborhoodView };
}

describe("canonical street focus (§12.4.2)", () => {
  it("stays compatible with a read that asks for no focus", async () => {
    const { status, body } = await street(`/api/neighborhoods/${NEIGHBORHOOD_WUTONG}`);
    expect(status).toBe(200);
    expect(body.focus).toBeNull();
    expect(body.tiles.length).toBeGreaterThan(0);
    expect(body.houses.length).toBeGreaterThan(0);
  });

  it("reports the slot a resident actually owns on this street", async () => {
    const { body } = await street(
      `/api/neighborhoods/${NEIGHBORHOOD_WUTONG}?focusResidentId=${RESIDENT_LIN}`,
    );
    // Seed §12.8: 林 lives at 梧桐街 slot 0.
    expect(body.focus).toEqual({ residentId: RESIDENT_LIN, slotIndex: 0 });
    const house = body.houses.find((row) => row.residentId === RESIDENT_LIN);
    expect(house?.slotIndex).toBe(0);
  });

  it("never invents a slot for a resident who lives elsewhere", async () => {
    // 南风 is civic (镇心街), not a 梧桐街 resident.
    const { body } = await street(
      `/api/neighborhoods/${NEIGHBORHOOD_WUTONG}?focusResidentId=${RESIDENT_NANFENG}`,
    );
    expect(body.focus).toBeNull();
  });

  it("does not move the visitor to the centre slot", async () => {
    // §2.7: 访客不会被移到槽 4.
    const { body } = await street(
      `/api/neighborhoods/${NEIGHBORHOOD_ZHENXIN}?focusResidentId=${RESIDENT_YOU}`,
    );
    expect(body.focus).toBeNull();
    expect(body.houses.some((row) => row.residentId === RESIDENT_YOU)).toBe(false);
  });

  it("returns null focus for a resident that does not exist", async () => {
    const { status, body } = await street(
      `/api/neighborhoods/${NEIGHBORHOOD_WUTONG}?focusResidentId=nobody`,
    );
    // The street itself is still perfectly readable.
    expect(status).toBe(200);
    expect(body.focus).toBeNull();
    expect(body.tiles.length).toBeGreaterThan(0);
  });

  it("keeps every tile and house identical whatever focus is asked for", async () => {
    const plain = await street(`/api/neighborhoods/${NEIGHBORHOOD_WUTONG}`);
    const focused = await street(
      `/api/neighborhoods/${NEIGHBORHOOD_WUTONG}?focusResidentId=${RESIDENT_LIN}`,
    );
    const other = await street(
      `/api/neighborhoods/${NEIGHBORHOOD_WUTONG}?focusResidentId=${RESIDENT_YOU}`,
    );

    // The camera moves; the street does not.
    expect(focused.body.tiles).toEqual(plain.body.tiles);
    expect(other.body.tiles).toEqual(plain.body.tiles);
    expect(focused.body.houses).toEqual(plain.body.houses);
    expect(other.body.houses).toEqual(plain.body.houses);
  });

  it("still 404s an unknown street", async () => {
    const { status } = await street("/api/neighborhoods/nowhere?focusResidentId=lin");
    expect(status).toBe(404);
  });
});
