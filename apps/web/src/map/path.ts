import { GRID_COLS } from "./mapMetrics";

/** 4-connected Manhattan: column axis, then row. No A* / navmesh / collision. */
export function gridPath(fromSlot: number, toSlot: number): number[] {
  if (fromSlot === toSlot) {
    return [];
  }
  const path: number[] = [];
  let col = fromSlot % GRID_COLS;
  let row = Math.floor(fromSlot / GRID_COLS);
  const toCol = toSlot % GRID_COLS;
  const toRow = Math.floor(toSlot / GRID_COLS);
  while (col !== toCol) {
    col += col < toCol ? 1 : -1;
    path.push(row * GRID_COLS + col);
  }
  while (row !== toRow) {
    row += row < toRow ? 1 : -1;
    path.push(row * GRID_COLS + col);
  }
  return path;
}
