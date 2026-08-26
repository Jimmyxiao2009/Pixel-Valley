import { describe, expect, it } from "vitest";
import { countUnits, excerpt } from "./excerpt.ts";

describe("excerpt", () => {
  it("returns （空） for blank text", () => {
    expect(excerpt("")).toBe("（空）");
    expect(excerpt("   ")).toBe("（空）");
  });

  it("keeps short Chinese under the 36-unit cap without ellipsis", () => {
    expect(excerpt("修好了那个折磨我一周的 bug")).toBe("修好了那个折磨我一周的 bug");
    expect(countUnits(excerpt("修好了那个折磨我一周的 bug"))).toBeLessThanOrEqual(36);
  });

  it("truncates long CJK so the result is ≤ 36 units including …", () => {
    const text = "这是一句用来测试房顶气泡截断算法的中文句子需要足够长才会被切开";
    const result = excerpt(text);
    expect(result.endsWith("…")).toBe(true);
    expect(countUnits(result)).toBeLessThanOrEqual(36);
    expect(result.length).toBeLessThan(text.length);
  });

  it("counts latin as 1 unit and fits 36 letters", () => {
    const text = "abcdefghijklmnopqrstuvwxyz0123456789XXXX";
    const result = excerpt(text);
    expect(countUnits(result)).toBeLessThanOrEqual(36);
    expect(result.endsWith("…")).toBe(true);
  });

  it("snaps to nearby punctuation when it still fits", () => {
    const text = `${"啊".repeat(16)}。后面还有很多字所以一定会被截断`;
    const result = excerpt(text);
    expect(result.includes("。")).toBe(true);
    expect(countUnits(result)).toBeLessThanOrEqual(36);
  });
});
