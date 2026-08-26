export const STAGE_WIDTH = 224;
export const STAGE_HEIGHT = 192;
export const TILE = 48;
export const GRID_COLS = 4;
export const GRID_ROWS = 3;
export const GRID_WIDTH = 192;
export const GRID_HEIGHT = 144;
export const GUTTER_TOP = 48;
export const GUTTER_SIDE = 16;
export const HOUSE_SIZE = 32;
export const BUBBLE_ANCHOR_DY = -4;
export const SLOTS = 12;
export const WALK_MS_PER_TILE = 180;

export function slotCol(slotIndex: number): number {
  return slotIndex % GRID_COLS;
}

export function slotRow(slotIndex: number): number {
  return Math.floor(slotIndex / GRID_COLS);
}

export function tileOrigin(slotIndex: number): { x: number; y: number } {
  return {
    x: GUTTER_SIDE + slotCol(slotIndex) * TILE,
    y: GUTTER_TOP + slotRow(slotIndex) * TILE,
  };
}

export function houseOrigin(slotIndex: number): { x: number; y: number } {
  const tile = tileOrigin(slotIndex);
  return {
    x: tile.x + (TILE - HOUSE_SIZE) / 2,
    y: tile.y + (TILE - HOUSE_SIZE),
  };
}

export function bubbleAnchor(slotIndex: number): { x: number; y: number } {
  const tile = tileOrigin(slotIndex);
  return {
    x: tile.x + TILE / 2,
    y: tile.y + BUBBLE_ANCHOR_DY,
  };
}

/** Feet rest near the bottom-center of the tile. */
export function walkAnchor(slotIndex: number): { x: number; y: number } {
  const tile = tileOrigin(slotIndex);
  return {
    x: tile.x + TILE / 2,
    y: tile.y + TILE - 8,
  };
}

export function slotFromPoint(x: number, y: number): number | null {
  const col = Math.floor((x - GUTTER_SIDE) / TILE);
  if (col < 0 || col >= GRID_COLS) {
    return null;
  }
  if (y < 0 || y >= STAGE_HEIGHT) {
    return null;
  }
  if (y < GUTTER_TOP) {
    return col;
  }
  const row = Math.floor((y - GUTTER_TOP) / TILE);
  if (row < 0 || row >= GRID_ROWS) {
    return null;
  }
  return row * GRID_COLS + col;
}

export function localYInTile(y: number, slotIndex: number): number {
  return y - tileOrigin(slotIndex).y;
}
