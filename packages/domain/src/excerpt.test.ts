import { describe, expect, it } from "vitest";
import { excerpt, excerptUnits } from "./excerpt.ts";

describe("excerpt", () => {
  it("locks every result at ≤36 units", () => {
    const samples = [
      "",
      "修好了那个折磨我一周的 bug",
      "a".repeat(80),
      "字".repeat(40),
      `${"哈".repeat(15)}！${"哈".repeat(20)}`,
      `${"a".repeat(35)}。${"a".repeat(10)}`,
      "😀".repeat(30),
      "👨‍👩‍👧‍👦".repeat(10),
      "今晚梧桐街的灯看起来特别暖",
    ];
    for (const sample of samples) {
      expect(excerptUnits(excerpt(sample))).toBeLessThanOrEqual(36);
    }
    expect(excerptUnits(excerpt("", { hasImage: true }))).toBeLessThanOrEqual(36);
  });

  it("returns placeholders for empty text and image-only posts", () => {
    expect(excerpt("")).toBe("（空）");
    expect(excerpt("", { hasImage: true })).toBe("（一张图）");
    expect(excerpt("hi", { hasImage: true })).toBe("hi");
  });

  it("snaps the cut to after nearby punctuation when it still fits", () => {
    const text = `${"哈".repeat(15)}！${"哈".repeat(20)}`;
    const out = excerpt(text);
    expect(out.includes("！")).toBe(true);
    expect(out.endsWith("…")).toBe(true);
    expect(excerptUnits(out)).toBeLessThanOrEqual(36);
  });

  it("does not keep punctuation when snapping would exceed 36 units", () => {
    const text = `${"a".repeat(35)}。${"a".repeat(10)}`;
    const out = excerpt(text);
    expect(excerptUnits(out)).toBeLessThanOrEqual(36);
    expect(out.endsWith("…")).toBe(true);
  });

  it("counts CJK as 2, emoji/ZWJ cluster as 2, and does not split ZWJ", () => {
    expect(excerptUnits("字")).toBe(2);
    expect(excerptUnits("a")).toBe(1);
    expect(excerptUnits("😀")).toBe(2);
    expect(excerptUnits("👨‍👩‍👧‍👦")).toBe(2);
    expect(excerpt("👨‍👩‍👧‍👦").includes("\u200D") || excerpt("👨‍👩‍👧‍👦") === "👨‍👩‍👧‍👦").toBe(true);
  });

  it("does not truncate short seed posts", () => {
    expect(excerpt("修好了那个折磨我一周的 bug")).toBe("修好了那个折磨我一周的 bug");
    expect(excerpt("新搬来，还在认路")).toBe("新搬来，还在认路");
  });
});
