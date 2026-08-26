import { describe, expect, it } from "vitest";
import { getStreetMine, labelStreetMine } from "./getStreetMine.ts";
import {
  isReservedHandle,
  RESERVED_HANDLES,
  sanitizeHumanDisplayName,
} from "./handles.ts";
import {
  createSeed,
  NEIGHBORHOOD_WUTONG,
  NEIGHBORHOOD_ZHENXIN,
  RESIDENT_DOUMIAO,
  RESIDENT_LIN,
  RESIDENT_YOU,
} from "./seed.ts";
import { BUS_SLOT, HOUSE_LOTS } from "./types.ts";

const YOU_FIXTURE = ["林", "南风◇", "Neko", "空", "你★", "青禾◇", "Ava", "空", "树", "公交+路路", "路", "树"];
const LIN_FIXTURE = ["你", "南风◇", "Neko", "空", "林★", "青禾◇", "Ava", "空", "树", "公交+路路", "路", "树"];

describe("getStreetMine fixtures", () => {
  const now = new Date("2026-08-26T12:00:00.000Z");
  const world = createSeed(now);

  it("persona=you pins same-street humans then no-ops the center swap", () => {
    expect(labelStreetMine(world, RESIDENT_YOU, now)).toEqual(YOU_FIXTURE);
    const slots = getStreetMine(world, RESIDENT_YOU, now);
    expect(slots[4]?.kind).toBe("self");
    expect(slots[4]?.residentId).toBe(RESIDENT_YOU);
  });

  it("persona=lin swaps canonical 0 with layout 4", () => {
    expect(labelStreetMine(world, RESIDENT_LIN, now)).toEqual(LIN_FIXTURE);
    const slots = getStreetMine(world, RESIDENT_LIN, now);
    expect(slots[4]?.kind).toBe("self");
    expect(slots[4]?.residentId).toBe(RESIDENT_LIN);
    expect(slots[0]?.residentId).toBe(RESIDENT_YOU);
  });

  it("keeps doumiao off both derived grids and 梧桐街 house lots", () => {
    const youSlots = getStreetMine(world, RESIDENT_YOU, now);
    const linSlots = getStreetMine(world, RESIDENT_LIN, now);
    expect(youSlots.some((slot) => slot.residentId === RESIDENT_DOUMIAO)).toBe(false);
    expect(linSlots.some((slot) => slot.residentId === RESIDENT_DOUMIAO)).toBe(false);

    const wutongHouses = world.houses.filter((house) => house.neighborhoodId === NEIGHBORHOOD_WUTONG);
    expect(wutongHouses.some((house) => house.residentId === RESIDENT_DOUMIAO)).toBe(false);

    const you = world.residents.find((resident) => resident.id === RESIDENT_YOU);
    const doumiao = world.residents.find((resident) => resident.id === RESIDENT_DOUMIAO);
    expect(you?.companionResidentId).toBe(RESIDENT_DOUMIAO);
    expect(you?.onboarding.firstPostAt).toBeNull();
    expect(world.posts.some((post) => post.authorResidentId === RESIDENT_YOU)).toBe(false);
    expect(doumiao?.ownerResidentId).toBe(RESIDENT_YOU);
    expect(doumiao?.houseId).toBeNull();
    expect(doumiao?.homeNeighborhoodId).toBeNull();
  });

  it("does not pack same-street humans into leftover lots", () => {
    const slots = getStreetMine(world, RESIDENT_YOU, now);
    expect(slots[1]?.residentId).not.toBe("neko");
    expect(slots[2]?.residentId).toBe("neko");
    expect(slots[6]?.residentId).toBe("ava");
    expect(slots[3]?.kind).toBe("vacant");
    expect(slots[7]?.kind).toBe("vacant");
  });

  it("uses the residential bus overlay and civic lots without a bus", () => {
    const youSlots = getStreetMine(world, RESIDENT_YOU, now);
    expect(youSlots[BUS_SLOT]?.kind).toBe("bus-stop");
    expect(youSlots[BUS_SLOT]?.residentId).toBe("lulu");

    const civicBus = world.tiles.find(
      (tile) => tile.neighborhoodId === NEIGHBORHOOD_ZHENXIN && tile.kind === "bus-stop",
    );
    expect(civicBus).toBeUndefined();

    const wutongHouseResidents = world.houses
      .filter((house) => house.neighborhoodId === NEIGHBORHOOD_WUTONG)
      .map((house) => house.residentId)
      .sort();
    expect(wutongHouseResidents).toEqual(["ava", "lin", "neko", "you"]);

    for (const lot of HOUSE_LOTS) {
      const tile = world.tiles.find(
        (entry) => entry.neighborhoodId === NEIGHBORHOOD_WUTONG && entry.slotIndex === lot,
      );
      expect(tile?.kind === "house" || tile?.kind === "vacant").toBe(true);
    }
  });

  it("does not seed NeighborEdge rows", () => {
    expect(world.neighborEdges).toEqual([]);
  });
});

describe("reserved handles and human display names", () => {
  it("reserves civic/companion handles and the ai. prefix", () => {
    for (const handle of RESERVED_HANDLES) {
      expect(isReservedHandle(handle)).toBe(true);
    }
    expect(isReservedHandle("ai.bot")).toBe(true);
    expect(isReservedHandle("AI.Guide")).toBe(true);
    expect(isReservedHandle("you")).toBe(false);
    expect(isReservedHandle("lin")).toBe(false);
  });

  it("strips ◇ from human display names", () => {
    expect(sanitizeHumanDisplayName("林◇")).toBe("林");
    expect(sanitizeHumanDisplayName("◇你◇")).toBe("你");
    expect(sanitizeHumanDisplayName("Neko")).toBe("Neko");

    const world = createSeed();
    for (const resident of world.residents) {
      if (resident.kind === "human") {
        expect(resident.displayName.includes("◇")).toBe(false);
        expect(isReservedHandle(resident.handle)).toBe(false);
      }
    }

    const aiPlates = world.houses
      .filter((house) => ["qinghe", "nanfeng", "mobai"].includes(house.residentId))
      .map((house) => house.nameplate);
    expect(aiPlates.every((plate) => plate.includes("◇"))).toBe(true);
  });
});
