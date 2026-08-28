import { describe, expect, it } from "vitest";
import { computeFocusPan, isSlotVisible, type FocusPanInput } from "./focusPan";
import { STAGE_HEIGHT, STAGE_WIDTH, TILE, tileOrigin } from "./mapMetrics";

/** A phone-sized window: the stage overflows, so panning is meaningful. */
function narrow(slotIndex: number, overrides: Partial<FocusPanInput> = {}): FocusPanInput {
  const scale = 2;
  return {
    slotIndex,
    scale,
    stageWidth: STAGE_WIDTH * scale,
    stageHeight: STAGE_HEIGHT * scale,
    viewportWidth: 320,
    viewportHeight: 320,
    currentPan: { x: 0, y: 0 },
    ...overrides,
  };
}

/** A window larger than the stage: nothing to pan. */
function roomy(slotIndex: number): FocusPanInput {
  const scale = 3;
  return {
    slotIndex,
    scale,
    stageWidth: STAGE_WIDTH * scale,
    stageHeight: STAGE_HEIGHT * scale,
    viewportWidth: 1600,
    viewportHeight: 1200,
    currentPan: { x: 0, y: 0 },
  };
}

describe("computeFocusPan", () => {
  it("centres a middle slot in the visible window", () => {
    const input = narrow(5);
    const pan = computeFocusPan(input);
    const origin = tileOrigin(5);
    const centreX = (origin.x + TILE / 2) * input.scale;
    // The slot's centre lands at the middle of the viewport.
    expect(pan.x + input.viewportWidth / 2).toBeCloseTo(centreX, 5);
  });

  it("clamps at the left edge rather than panning past the stage", () => {
    const pan = computeFocusPan(narrow(0));
    expect(pan.x).toBe(0);
    expect(pan.y).toBe(0);
  });

  it("clamps at the right and bottom edges", () => {
    const input = narrow(11);
    const pan = computeFocusPan(input);
    expect(pan.x).toBeLessThanOrEqual(input.stageWidth - input.viewportWidth);
    expect(pan.y).toBeLessThanOrEqual(input.stageHeight - input.viewportHeight);
    expect(pan.x).toBeGreaterThanOrEqual(0);
    expect(pan.y).toBeGreaterThanOrEqual(0);
  });

  it("never leaves the allowed pan range for any slot", () => {
    const input = narrow(0);
    const maxX = input.stageWidth - input.viewportWidth;
    const maxY = input.stageHeight - input.viewportHeight;
    for (let slot = 0; slot < 12; slot += 1) {
      const pan = computeFocusPan(narrow(slot));
      expect(pan.x).toBeGreaterThanOrEqual(0);
      expect(pan.y).toBeGreaterThanOrEqual(0);
      expect(pan.x).toBeLessThanOrEqual(maxX);
      expect(pan.y).toBeLessThanOrEqual(maxY);
    }
  });

  it("does not move a window that already shows the whole street", () => {
    for (let slot = 0; slot < 12; slot += 1) {
      expect(computeFocusPan(roomy(slot))).toEqual({ x: 0, y: 0 });
    }
  });

  it("pans only on the axis that actually overflows", () => {
    const scale = 2;
    const input: FocusPanInput = {
      slotIndex: 7,
      scale,
      stageWidth: STAGE_WIDTH * scale,
      stageHeight: STAGE_HEIGHT * scale,
      // Tall enough for the whole stage, too narrow for its width.
      viewportWidth: 240,
      viewportHeight: STAGE_HEIGHT * scale + 40,
      currentPan: { x: 0, y: 0 },
    };
    const pan = computeFocusPan(input);
    expect(pan.y).toBe(0);
    expect(pan.x).toBeGreaterThan(0);
  });

  it("brings the target into view from anywhere the resident had panned to", () => {
    for (const start of [
      { x: 0, y: 0 },
      { x: 999, y: 999 },
    ]) {
      const input = narrow(6, { currentPan: start });
      const pan = computeFocusPan(input);
      expect(isSlotVisible({ ...input, currentPan: pan })).toBe(true);
    }
  });

  it("is a pure function of its inputs, so a resize just recomputes", () => {
    const a = computeFocusPan(narrow(5));
    const b = computeFocusPan(narrow(5));
    expect(a).toEqual(b);

    const wider = computeFocusPan(narrow(5, { viewportWidth: 400 }));
    expect(wider.x).toBeLessThan(a.x);
  });
});

describe("isSlotVisible", () => {
  it("knows when a slot is off-screen", () => {
    expect(isSlotVisible(narrow(11))).toBe(false);
    expect(isSlotVisible(narrow(0))).toBe(true);
  });
});
