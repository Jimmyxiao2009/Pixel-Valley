import { describe, expect, it } from "vitest";
import {
  computeLetterbox,
  HOME_HINT_HEIGHT,
  HOME_LOGICAL_HEIGHT,
  HOME_LOGICAL_WIDTH,
  homeStageScale,
  integerScale,
  MAP_LOGICAL_HEIGHT,
  MAP_LOGICAL_WIDTH,
  MAP_TOP_CHROME_HEIGHT,
  mapStageScale,
  WORLD_NAV_HEIGHT,
} from "./integerScale";

describe("integerScale", () => {
  it("floors the smaller axis ratio", () => {
    expect(integerScale(640, 400, 320, 200)).toBe(2);
    expect(integerScale(959, 400, 320, 200)).toBe(2);
    expect(integerScale(640, 399, 320, 200)).toBe(1);
    expect(integerScale(1600, 1000, 320, 200)).toBe(5);
  });

  it("never returns less than 1", () => {
    expect(integerScale(100, 50, 320, 200)).toBe(1);
    expect(integerScale(0, 0, 320, 200)).toBe(1);
    expect(integerScale(-10, 400, 320, 200)).toBe(1);
  });

  it("only returns integer scales", () => {
    const scale = integerScale(500, 350, 320, 200);
    expect(Number.isInteger(scale)).toBe(true);
    expect(scale).toBe(1);
  });
});

describe("computeLetterbox", () => {
  it("centers remainder around the integer-scaled stage", () => {
    const box = computeLetterbox(1000, 800, 320, 200);
    expect(box.scale).toBe(3);
    expect(box.stageWidth).toBe(960);
    expect(box.stageHeight).toBe(600);
    expect(box.remainderX).toBe(40);
    expect(box.remainderY).toBe(200);
    expect(box.offsetX).toBe(20);
    expect(box.offsetY).toBe(100);
  });

  it("floors odd remainders", () => {
    const box = computeLetterbox(961, 601, 320, 200);
    expect(box.scale).toBe(3);
    expect(box.remainderX).toBe(1);
    expect(box.remainderY).toBe(1);
    expect(box.offsetX).toBe(0);
    expect(box.offsetY).toBe(0);
  });

  it("keeps scale 1 when the stage cannot fit", () => {
    const box = computeLetterbox(400, 50, 320, 200);
    expect(box.scale).toBe(1);
    expect(box.stageWidth).toBe(320);
    expect(box.stageHeight).toBe(200);
    expect(box.offsetX).toBe(40);
    expect(box.offsetY).toBe(-75);
  });
});

describe("home and map viewport formulas", () => {
  it("home subtracts WorldNav 56 and hint 40", () => {
    const vw = 1280;
    const vh = 800;
    expect(homeStageScale(vw, vh)).toBe(
      integerScale(
        vw,
        vh - WORLD_NAV_HEIGHT - HOME_HINT_HEIGHT,
        HOME_LOGICAL_WIDTH,
        HOME_LOGICAL_HEIGHT,
      ),
    );
    expect(homeStageScale(1280, 800)).toBe(3);
  });

  it("map subtracts WorldNav 56 and top chrome 48", () => {
    expect(mapStageScale(1280, 800)).toBe(
      integerScale(
        1280,
        800 - WORLD_NAV_HEIGHT - MAP_TOP_CHROME_HEIGHT,
        MAP_LOGICAL_WIDTH,
        MAP_LOGICAL_HEIGHT,
      ),
    );
    expect(mapStageScale(1280, 800)).toBe(3);
  });
});
