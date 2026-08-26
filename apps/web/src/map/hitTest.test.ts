import { describe, expect, it } from "vitest";
import { hitTestLot, tileBand } from "./hitTest";

describe("tileBand order", () => {
  it("splits a tile top-to-bottom: bubble, roof, wall, edge", () => {
    expect(tileBand(0)).toBe("bubble");
    expect(tileBand(15)).toBe("bubble");
    expect(tileBand(16)).toBe("roof");
    expect(tileBand(27)).toBe("roof");
    expect(tileBand(28)).toBe("wall");
    expect(tileBand(43)).toBe("wall");
    expect(tileBand(44)).toBe("edge");
    expect(tileBand(47)).toBe("edge");
    expect(tileBand(-1)).toBeNull();
    expect(tileBand(48)).toBeNull();
  });
});

describe("hitTestLot", () => {
  it("hits bubble before roof/wall, and lot edge last", () => {
    const house = { kind: "house" as const, hasBubble: true };
    expect(hitTestLot(4, house)).toBe("post");
    expect(hitTestLot(20, house)).toBe("peek");
    expect(hitTestLot(36, house)).toBe("peek");
    expect(hitTestLot(46, house)).toBe("peek");
  });

  it("lets a missing bubble pass through, then vacant copy only on the edge", () => {
    const vacant = { kind: "vacant" as const, hasBubble: false };
    expect(hitTestLot(8, vacant)).toBe("walk");
    expect(hitTestLot(20, vacant)).toBe("walk");
    expect(hitTestLot(36, vacant)).toBe("walk");
    expect(hitTestLot(46, vacant)).toBe("vacant");
  });

  it("walks roads/trees and opens the bus on any non-bubble band", () => {
    expect(hitTestLot(30, { kind: "road", hasBubble: false })).toBe("walk");
    expect(hitTestLot(30, { kind: "tree", hasBubble: false })).toBe("walk");
    expect(hitTestLot(8, { kind: "bus-stop", hasBubble: false })).toBe("walk");
    expect(hitTestLot(30, { kind: "bus-stop", hasBubble: false })).toBe("bus");
  });

  it("treats overlay AI like a house peek", () => {
    expect(hitTestLot(20, { kind: "overlay-ai", hasBubble: true })).toBe("peek");
    expect(hitTestLot(8, { kind: "overlay-ai", hasBubble: true })).toBe("post");
  });
});
