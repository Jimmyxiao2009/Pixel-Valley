import type { DerivedSlotKind } from "@pixel-valley/domain";

export type TileBand = "bubble" | "roof" | "wall" | "edge";
export type HitAction = "post" | "peek" | "vacant" | "walk" | "bus" | "none";

export type LotHitInput = {
  kind: DerivedSlotKind;
  hasBubble: boolean;
};

export function tileBand(localY: number): TileBand | null {
  if (localY < 0 || localY >= 48) {
    return null;
  }
  if (localY < 16) {
    return "bubble";
  }
  if (localY < 28) {
    return "roof";
  }
  if (localY < 44) {
    return "wall";
  }
  return "edge";
}

export function isOccupiedLot(kind: DerivedSlotKind): boolean {
  return kind === "house" || kind === "self" || kind === "overlay-ai";
}

/**
 * Per-tile bands, top-to-bottom, first match wins (§4.3).
 * Clicks in the gutter (localY < 0) only hit a bubble.
 */
export function hitTestLot(localY: number, lot: LotHitInput): HitAction {
  if (localY < 0) {
    return lot.hasBubble ? "post" : "none";
  }
  const band = tileBand(localY);
  if (!band) {
    return "none";
  }
  if (band === "bubble") {
    return lot.hasBubble ? "post" : "walk";
  }
  if (lot.kind === "bus-stop") {
    return "bus";
  }
  if (lot.kind === "road" || lot.kind === "tree") {
    return "walk";
  }
  if (isOccupiedLot(lot.kind)) {
    return "peek";
  }
  if (lot.kind === "vacant") {
    return band === "edge" ? "vacant" : "walk";
  }
  return "none";
}
