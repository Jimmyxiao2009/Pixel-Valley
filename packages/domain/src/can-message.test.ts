import { describe, expect, it } from "vitest";
import { assertCanMessage } from "./can-message.ts";
import { createSeed, RESIDENT_DOUMIAO, RESIDENT_LIN, RESIDENT_YOU } from "./seed.ts";

const now = new Date("2026-08-26T12:00:00.000Z");

describe("assertCanMessage", () => {
  const world = createSeed(now);
  const you = world.residents.find((resident) => resident.id === RESIDENT_YOU)!;
  const lin = world.residents.find((resident) => resident.id === RESIDENT_LIN)!;
  const doumiao = world.residents.find((resident) => resident.id === RESIDENT_DOUMIAO)!;

  it("lets the owner knock the companion without the public matrix", () => {
    const result = assertCanMessage({
      actor: you,
      peer: doumiao,
      peerObserverPresence: "online",
      blocked: true,
      companionOwner: you,
    });
    expect(result).toEqual({ ok: true, via: "knock" });
  });

  it("blocks a visitor when the companion is hidden", () => {
    const hidden = {
      ...you,
      privacy: { ...you.privacy, companionVisible: false },
    };
    const result = assertCanMessage({
      actor: lin,
      peer: doumiao,
      peerObserverPresence: "online",
      blocked: false,
      companionOwner: hidden,
    });
    expect(result).toEqual({ ok: false, code: "forbidden" });
  });

  it("returns blocked before privacy when either side blocked", () => {
    const result = assertCanMessage({
      actor: you,
      peer: lin,
      peerObserverPresence: "online",
      blocked: true,
      companionOwner: null,
    });
    expect(result).toEqual({ ok: false, code: "blocked" });
  });

  it("writes knock when the peer looks in and allows it", () => {
    const result = assertCanMessage({
      actor: you,
      peer: lin,
      peerObserverPresence: "online",
      blocked: false,
      companionOwner: null,
    });
    expect(result).toEqual({ ok: true, via: "knock" });
  });

  it("forces note when the observer view is offline", () => {
    const result = assertCanMessage({
      actor: you,
      peer: lin,
      peerObserverPresence: "offline",
      blocked: false,
      companionOwner: null,
    });
    expect(result).toEqual({ ok: true, via: "note" });
  });

  it("returns dnd when the peer is dnd and notes are closed", () => {
    const dnd = {
      ...lin,
      truePresence: "dnd" as const,
      privacy: { ...lin.privacy, note: "nobody" as const },
    };
    const result = assertCanMessage({
      actor: you,
      peer: dnd,
      peerObserverPresence: "dnd",
      blocked: false,
      companionOwner: null,
    });
    expect(result).toEqual({ ok: false, code: "dnd" });
  });
});
