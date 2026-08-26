import { describe, expect, it } from "vitest";
import { walkAnchor } from "./mapMetrics";
import { snapWalkToSlot, startWalkPlan } from "./walk";

describe("startWalkPlan", () => {
  it("snaps to walkAnchor when the path is empty (re-click / cancelled in place)", () => {
    const dest = 4;
    const mid = { x: walkAnchor(dest).x + 12, y: walkAnchor(dest).y - 8, slot: dest };
    const plan = startWalkPlan(mid, dest, false);
    expect(plan.path).toEqual([]);
    expect(plan.snap).toEqual(snapWalkToSlot(dest));
    expect(plan.snap).not.toEqual(mid);
  });

  it("snaps under reduced motion even when tiles differ", () => {
    const from = snapWalkToSlot(4);
    const plan = startWalkPlan(from, 11, true);
    expect(plan.path).toEqual([]);
    expect(plan.snap).toEqual(snapWalkToSlot(11));
  });

  it("keeps the current pixel when a real path exists", () => {
    const from = { x: 10, y: 20, slot: 4 };
    const plan = startWalkPlan(from, 6, false);
    expect(plan.path).toEqual([5, 6]);
    expect(plan.snap).toBeNull();
  });
});
