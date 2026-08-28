import { describe, expect, it } from "vitest";
import { deriveObserverPresence, resolveTruePresence, withObserverFields } from "./observer.ts";
import { createSeed, RESIDENT_LIN, RESIDENT_LULU, RESIDENT_QINGHE, RESIDENT_YOU } from "./seed.ts";

const now = new Date("2026-08-26T12:00:00.000Z");

describe("resolveTruePresence", () => {
  const world = createSeed(now);

  it("keeps public-service AI online without a lastSeen heartbeat", () => {
    const qinghe = world.residents.find((resident) => resident.id === RESIDENT_QINGHE)!;
    const stale = { ...qinghe, lastSeenAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString() };
    expect(resolveTruePresence(stale, now, { writing: false, chatting: false })).toBe("online");
    expect(withObserverFields(stale, now, { writing: false, chatting: false }).observerPresence).toBe("online");

    const lulu = world.residents.find((resident) => resident.id === RESIDENT_LULU)!;
    expect(
      resolveTruePresence(
        { ...lulu, lastSeenAt: "2020-01-01T00:00:00.000Z" },
        now,
        { writing: false, chatting: false },
      ),
    ).toBe("online");
  });

  it("applies the 90s timeout to humans", () => {
    const lin = world.residents.find((resident) => resident.id === RESIDENT_LIN)!;
    expect(resolveTruePresence(lin, now, { writing: false, chatting: false })).toBe("offline");
    const fresh = { ...lin, lastSeenAt: now.toISOString() };
    expect(resolveTruePresence(fresh, now, { writing: false, chatting: false })).toBe("online");
  });

  it("honors showOnline=false for humans only", () => {
    const you = world.residents.find((resident) => resident.id === RESIDENT_YOU)!;
    const hidden = {
      ...you,
      lastSeenAt: now.toISOString(),
      privacy: { ...you.privacy, showOnline: false },
    };
    const presented = withObserverFields(hidden, now, { writing: false, chatting: false });
    expect(presented.truePresence).toBe("online");
    expect(presented.observerPresence).toBe("offline");
    expect(deriveObserverPresence("dnd", false, hidden)).toBe("offline");

    const qinghe = world.residents.find((resident) => resident.id === RESIDENT_QINGHE)!;
    expect(deriveObserverPresence("offline", false, qinghe)).toBe("online");
  });
});
