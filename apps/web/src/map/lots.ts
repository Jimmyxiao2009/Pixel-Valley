import {
  RESIDENT_DOUMIAO,
  RESIDENT_LULU,
  SLOTS,
  type DerivedSlot,
  type DerivedSlotKind,
  type NeighborhoodView,
} from "@pixel-valley/domain";

export type MapLot = {
  slotIndex: number;
  kind: DerivedSlotKind;
  houseId: string | null;
  residentId: string | null;
  overlay?: boolean;
};

export function lotsFromMine(slots: readonly DerivedSlot[]): MapLot[] {
  return slots
    .filter((slot) => slot.residentId !== RESIDENT_DOUMIAO)
    .map((slot) => ({
      slotIndex: slot.layoutIndex,
      kind: slot.kind,
      houseId: slot.houseId,
      residentId: slot.residentId,
      overlay: slot.overlay,
    }));
}

export function lotsFromCanonical(view: NeighborhoodView): MapLot[] {
  const houseById = new Map(view.houses.map((house) => [house.id, house]));
  const lulu = view.residents.find((resident) => resident.id === RESIDENT_LULU);
  const lots = view.tiles.map((tile) => {
    const house = tile.houseId ? houseById.get(tile.houseId) : undefined;
    const residentId =
      house?.residentId === RESIDENT_DOUMIAO
        ? null
        : (house?.residentId ?? (tile.kind === "bus-stop" ? (lulu?.id ?? null) : null));
    return {
      slotIndex: tile.slotIndex,
      kind: tile.kind,
      houseId: house?.residentId === RESIDENT_DOUMIAO ? null : tile.houseId,
      residentId,
      overlay: tile.kind === "bus-stop" || undefined,
    };
  });
  lots.sort((a, b) => a.slotIndex - b.slotIndex);
  return lots;
}

export function lotAt(lots: readonly MapLot[], slotIndex: number): MapLot {
  return (
    lots.find((lot) => lot.slotIndex === slotIndex) ?? {
      slotIndex,
      kind: "vacant",
      houseId: null,
      residentId: null,
    }
  );
}

export function selfSlotIndex(lots: readonly MapLot[], meId: string): number {
  const mine = lots.find((lot) => lot.kind === "self" || lot.residentId === meId);
  return mine?.slotIndex ?? 4;
}

export function fillSlots(lots: readonly MapLot[]): MapLot[] {
  return Array.from({ length: SLOTS }, (_, slotIndex) => lotAt(lots, slotIndex));
}
