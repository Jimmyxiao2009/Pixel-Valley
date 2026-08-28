import { HOUSE_SIZE, TILE, tileOrigin } from "./mapMetrics";

export type FocusPanInput = {
  /** Slot to bring into view, in the canonical layout. */
  slotIndex: number;
  /** Integer scale the stage is currently drawn at. */
  scale: number;
  /** Scaled stage size, i.e. logical size * scale. */
  stageWidth: number;
  stageHeight: number;
  /** Visible viewport of the stage host, in CSS px. */
  viewportWidth: number;
  viewportHeight: number;
  /** Where the stage is panned right now. */
  currentPan: { x: number; y: number };
};

export type FocusPan = { x: number; y: number };

function clamp(value: number, min: number, max: number): number {
  if (max <= min) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

/**
 * Move the camera, never the house (KD-19). Returns the pan that puts the
 * given slot in the middle of whatever is visible, clamped to the same
 * overflow bounds the drag handler uses.
 *
 * When the stage already fits the viewport there is nothing to pan: the
 * overflow is zero, so a big desktop window produces no movement at all
 * rather than a pointless jump.
 */
export function computeFocusPan(input: FocusPanInput): FocusPan {
  const overflowX = Math.max(0, input.stageWidth - input.viewportWidth);
  const overflowY = Math.max(0, input.stageHeight - input.viewportHeight);

  if (overflowX <= 0 && overflowY <= 0) {
    return { x: 0, y: 0 };
  }

  const origin = tileOrigin(input.slotIndex);
  // Centre of the house sprite, in scaled stage pixels.
  const centreX = (origin.x + TILE / 2) * input.scale;
  const centreY = (origin.y + TILE - HOUSE_SIZE / 2) * input.scale;

  // With no overflow on an axis, 0 is the only pan the drag handler allows.
  return {
    x: clamp(centreX - input.viewportWidth / 2, 0, overflowX),
    y: clamp(centreY - input.viewportHeight / 2, 0, overflowY),
  };
}

/** True when the slot's tile is already fully inside the visible window. */
export function isSlotVisible(input: FocusPanInput): boolean {
  const origin = tileOrigin(input.slotIndex);
  const left = origin.x * input.scale - input.currentPan.x;
  const top = origin.y * input.scale - input.currentPan.y;
  const size = TILE * input.scale;
  return (
    left >= 0 &&
    top >= 0 &&
    left + size <= input.viewportWidth &&
    top + size <= input.viewportHeight
  );
}
