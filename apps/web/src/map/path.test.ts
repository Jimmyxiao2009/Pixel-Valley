import { describe, expect, it } from "vitest";
import { gridPath } from "./path";

describe("gridPath", () => {
  it("walks column then row on the 4×3 grid", () => {
    expect(gridPath(4, 4)).toEqual([]);
    expect(gridPath(4, 6)).toEqual([5, 6]);
    expect(gridPath(4, 0)).toEqual([0]);
    expect(gridPath(0, 11)).toEqual([1, 2, 3, 7, 11]);
  });
});
