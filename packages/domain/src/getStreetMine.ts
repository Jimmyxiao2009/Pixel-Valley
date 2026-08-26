import { RESIDENT_LULU, RESIDENT_NANFENG, RESIDENT_QINGHE } from "./seed.ts";
import {
  BUS_SLOT,
  DECOR_SLOTS,
  HOUSE_LOTS,
  SLOTS,
  STREET_MINE_CENTER,
  type DerivedSlot,
  type House,
  type Resident,
  type SeedWorld,
  type TileKind,
} from "./types.ts";

const DAY = 24 * 60 * 60 * 1000;

function residentById(world: SeedWorld, id: string): Resident | undefined {
  return world.residents.find((resident) => resident.id === id);
}

function houseByResident(world: SeedWorld, residentId: string): House | undefined {
  return world.houses.find((house) => house.residentId === residentId);
}

function pairBlocked(world: SeedWorld, a: string, b: string): boolean {
  return world.blocks.some(
    (block) =>
      (block.blockerResidentId === a && block.blockedResidentId === b) ||
      (block.blockerResidentId === b && block.blockedResidentId === a),
  );
}

function isOnlineish(presence: Resident["observerPresence"]): boolean {
  return presence === "online" || presence === "writing" || presence === "chatting";
}

function hasPostSince(world: SeedWorld, residentId: string, sinceMs: number): boolean {
  return world.posts.some(
    (post) =>
      post.authorResidentId === residentId &&
      post.deletedAt === null &&
      post.visibility === "public" &&
      Date.parse(post.createdAt) >= sinceMs,
  );
}

function sharedInterestCount(a: Resident, b: Resident): number {
  const mine = new Set(a.interests);
  return b.interests.filter((interest) => mine.has(interest)).length;
}

function vacantHouseLots(slots: DerivedSlot[]): number[] {
  return HOUSE_LOTS.filter((index) => slots[index]?.kind === "vacant");
}

function placeOnLot(
  slots: DerivedSlot[],
  layoutIndex: number,
  slot: Omit<DerivedSlot, "layoutIndex">,
): void {
  slots[layoutIndex] = { ...slot, layoutIndex };
}

function residentialDecorKind(world: SeedWorld, homeNeighborhoodId: string, slotIndex: number): TileKind {
  const tile = world.tiles.find(
    (entry) => entry.neighborhoodId === homeNeighborhoodId && entry.slotIndex === slotIndex,
  );
  if (tile) {
    return tile.kind;
  }
  if (slotIndex === BUS_SLOT) {
    return "bus-stop";
  }
  if (slotIndex === 10) {
    return "road";
  }
  return "tree";
}

export function getStreetMine(world: SeedWorld, meResidentId: string, now: Date = new Date()): DerivedSlot[] {
  const me = residentById(world, meResidentId);
  const myHouse = me ? houseByResident(world, me.id) : undefined;
  if (!me || me.kind !== "human" || !myHouse || !me.homeNeighborhoodId) {
    throw new Error("street_mine_requires_human_house");
  }

  const homeNeighborhoodId = me.homeNeighborhoodId;
  const lulu = residentById(world, RESIDENT_LULU);

  const slots: DerivedSlot[] = Array.from({ length: SLOTS }, (_, layoutIndex) => {
    if ((DECOR_SLOTS as readonly number[]).includes(layoutIndex)) {
      return {
        layoutIndex,
        kind: residentialDecorKind(world, homeNeighborhoodId, layoutIndex),
        houseId: null,
        residentId: null,
      };
    }
    if (layoutIndex === BUS_SLOT) {
      return {
        layoutIndex,
        kind: "bus-stop",
        houseId: null,
        residentId: lulu?.id ?? null,
        overlay: true,
      };
    }
    return {
      layoutIndex,
      kind: "vacant",
      houseId: null,
      residentId: null,
    };
  });

  const sameStreetHouses = world.houses.filter((house) => house.neighborhoodId === homeNeighborhoodId);
  for (const house of sameStreetHouses) {
    const occupant = residentById(world, house.residentId);
    if (!occupant || occupant.kind !== "human") {
      continue;
    }
    placeOnLot(slots, house.slotIndex, {
      kind: occupant.id === me.id ? "self" : "house",
      houseId: house.id,
      residentId: occupant.id,
    });
  }

  const meSlot = myHouse.slotIndex;
  if (meSlot !== STREET_MINE_CENTER) {
    const center = slots[STREET_MINE_CENTER];
    const origin = slots[meSlot];
    if (center && origin) {
      const movedKind = center.kind === "self" ? "house" : center.kind;
      placeOnLot(slots, STREET_MINE_CENTER, {
        kind: "self",
        houseId: origin.houseId,
        residentId: origin.residentId,
        overlay: origin.overlay,
      });
      placeOnLot(slots, meSlot, {
        kind: movedKind,
        houseId: center.houseId,
        residentId: center.residentId,
        overlay: center.overlay,
      });
    }
  } else if (slots[STREET_MINE_CENTER]) {
    slots[STREET_MINE_CENTER].kind = "self";
  }

  const occupied = new Set(
    slots.map((slot) => slot.residentId).filter((id): id is string => typeof id === "string" && id.length > 0),
  );
  occupied.add(me.id);

  const nowMs = now.getTime();
  const cutoff24h = nowMs - DAY;

  const neighborCandidates = world.neighborEdges
    .filter((edge) => edge.fromResidentId === me.id && !occupied.has(edge.toResidentId))
    .map((edge) => {
      const peer = residentById(world, edge.toResidentId);
      return peer ? { edge, peer } : null;
    })
    .filter((entry): entry is { edge: (typeof world.neighborEdges)[number]; peer: Resident } => {
      return Boolean(entry?.peer && entry.peer.kind === "human" && !pairBlocked(world, me.id, entry.peer.id));
    })
    .sort((a, b) => {
      const onlineDelta = Number(isOnlineish(b.peer.observerPresence)) - Number(isOnlineish(a.peer.observerPresence));
      if (onlineDelta !== 0) {
        return onlineDelta;
      }
      const postDelta = Number(hasPostSince(world, b.peer.id, cutoff24h)) - Number(hasPostSince(world, a.peer.id, cutoff24h));
      if (postDelta !== 0) {
        return postDelta;
      }
      return Date.parse(b.edge.createdAt) - Date.parse(a.edge.createdAt);
    });

  for (const { peer } of neighborCandidates) {
    const lot = vacantHouseLots(slots)[0];
    if (lot === undefined) {
      break;
    }
    const house = houseByResident(world, peer.id);
    placeOnLot(slots, lot, {
      kind: "house",
      houseId: house?.id ?? null,
      residentId: peer.id,
    });
    occupied.add(peer.id);
  }

  const recommended = world.residents
    .filter((resident) => {
      return (
        resident.kind === "human" &&
        resident.id !== me.id &&
        !occupied.has(resident.id) &&
        !pairBlocked(world, me.id, resident.id) &&
        sharedInterestCount(me, resident) >= 1 &&
        Boolean(houseByResident(world, resident.id))
      );
    })
    .sort((a, b) => {
      const interestDelta = sharedInterestCount(me, b) - sharedInterestCount(me, a);
      if (interestDelta !== 0) {
        return interestDelta;
      }
      return Date.parse(a.createdAt) - Date.parse(b.createdAt);
    });

  for (const peer of recommended) {
    const lot = vacantHouseLots(slots)[0];
    if (lot === undefined) {
      break;
    }
    const house = houseByResident(world, peer.id);
    placeOnLot(slots, lot, {
      kind: "house",
      houseId: house?.id ?? null,
      residentId: peer.id,
    });
    occupied.add(peer.id);
  }

  const qinghe = residentById(world, RESIDENT_QINGHE);
  if (qinghe && !occupied.has(qinghe.id)) {
    const vacant = vacantHouseLots(slots);
    if (vacant.length > 0) {
      const nearest = [...vacant].sort((a, b) => {
        const distDelta = Math.abs(a - STREET_MINE_CENTER) - Math.abs(b - STREET_MINE_CENTER);
        if (distDelta !== 0) {
          return distDelta;
        }
        return b - a;
      })[0];
      if (nearest !== undefined) {
        placeOnLot(slots, nearest, {
          kind: "overlay-ai",
          houseId: null,
          residentId: qinghe.id,
          overlay: true,
        });
        occupied.add(qinghe.id);
      }
    }
  }

  const nanfeng = residentById(world, RESIDENT_NANFENG);
  if (nanfeng && !occupied.has(nanfeng.id)) {
    const lot = vacantHouseLots(slots)[0];
    if (lot !== undefined) {
      placeOnLot(slots, lot, {
        kind: "overlay-ai",
        houseId: null,
        residentId: nanfeng.id,
        overlay: true,
      });
    }
  }

  return slots;
}

export function labelStreetMineSlot(slot: DerivedSlot, world: SeedWorld, meResidentId: string): string {
  if (slot.kind === "tree") {
    return "树";
  }
  if (slot.kind === "road") {
    return "路";
  }
  if (slot.kind === "bus-stop") {
    return "公交+路路";
  }
  if (slot.kind === "vacant" || !slot.residentId) {
    return "空";
  }
  const resident = residentById(world, slot.residentId);
  if (!resident) {
    return "空";
  }
  if (resident.id === meResidentId) {
    return `${resident.displayName}★`;
  }
  if (resident.kind === "ai") {
    return `${resident.displayName}◇`;
  }
  return resident.displayName;
}

export function labelStreetMine(world: SeedWorld, meResidentId: string, now?: Date): string[] {
  return getStreetMine(world, meResidentId, now).map((slot) => labelStreetMineSlot(slot, world, meResidentId));
}
