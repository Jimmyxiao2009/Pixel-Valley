import { describe, expect, it } from "vitest";
import { dispatchMapIntent, intentFromHit, type MapUi } from "./intent";

describe("dispatchMapIntent", () => {
  it("invokes UI without awaiting the walk promise", async () => {
    const order: string[] = [];
    let release = (): void => {};
    const walkDone = new Promise<void>((resolve) => {
      release = resolve;
    });

    dispatchMapIntent(
      { ui: { type: "peek", residentId: "lin" }, walkTo: 0 },
      {
        openUi: (ui: MapUi) => {
          order.push(`ui:${ui.type}`);
        },
        walkTo: async () => {
          order.push("walk-start");
          await walkDone;
          order.push("walk-end");
        },
      },
    );

    expect(order).toEqual(["ui:peek", "walk-start"]);
    expect(order).not.toContain("walk-end");
    release();
    await walkDone;
    expect(order).toEqual(["ui:peek", "walk-start", "walk-end"]);
  });

  it("still opens UI when walk is omitted", () => {
    const opened: string[] = [];
    dispatchMapIntent(
      { ui: { type: "bus" } },
      {
        openUi: (ui) => opened.push(ui.type),
        walkTo: () => {
          throw new Error("walk should not run");
        },
      },
    );
    expect(opened).toEqual(["bus"]);
  });

  it("routes own house peek to /home and still walks", () => {
    expect(
      intentFromHit("peek", { slotIndex: 4, kind: "self", residentId: "you" }, undefined, "you"),
    ).toEqual({ ui: { type: "home" }, walkTo: 4 });
    expect(
      intentFromHit("peek", { slotIndex: 0, kind: "house", residentId: "lin" }, undefined, "you"),
    ).toEqual({ ui: { type: "peek", residentId: "lin" }, walkTo: 0 });
  });
});
