import { walkAnchor } from "./mapMetrics";
import { gridPath } from "./path";

export type WalkPos = { x: number; y: number; slot: number };

export function snapWalkToSlot(slotIndex: number): WalkPos {
  return { ...walkAnchor(slotIndex), slot: slotIndex };
}

/**
 * Empty path (same tile / cancelled in place) and reduced-motion both snap;
 * otherwise keep the current pixel so a new lerp can start mid-tile.
 */
export function startWalkPlan(
  current: WalkPos,
  destSlot: number,
  reduceMotion: boolean,
): { snap: WalkPos | null; path: number[] } {
  if (reduceMotion) {
    return { snap: snapWalkToSlot(destSlot), path: [] };
  }
  const path = gridPath(current.slot, destSlot);
  if (path.length === 0) {
    return { snap: snapWalkToSlot(destSlot), path: [] };
  }
  return { snap: null, path };
}
