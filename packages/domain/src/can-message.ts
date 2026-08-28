import type { MessageVia, Presence, Resident } from "./types.ts";

export type CanMessageOk = { ok: true; via: Exclude<MessageVia, "system"> };
export type CanMessageErr = { ok: false; code: "blocked" | "forbidden" | "dnd" };
export type CanMessageResult = CanMessageOk | CanMessageErr;

const KNOCK_PRESENCE = new Set<Presence>(["online", "writing", "chatting"]);

export function assertCanMessage(input: {
  actor: Resident;
  peer: Resident;
  peerObserverPresence: Presence;
  blocked: boolean;
  companionOwner: Pick<Resident, "id" | "privacy"> | null;
}): CanMessageResult {
  const { actor, peer, peerObserverPresence, blocked, companionOwner } = input;

  if (peer.aiRole === "companion") {
    if (actor.id === peer.ownerResidentId) {
      return { ok: true, via: "knock" };
    }
    if (companionOwner?.privacy.companionVisible) {
      return { ok: true, via: "knock" };
    }
    return { ok: false, code: "forbidden" };
  }

  if (blocked) {
    return { ok: false, code: "blocked" };
  }

  if (peer.privacy.knock === "nobody" && peer.privacy.note === "nobody") {
    return { ok: false, code: "forbidden" };
  }

  const knockLegal =
    KNOCK_PRESENCE.has(peerObserverPresence) &&
    peer.privacy.knock === "anyone" &&
    peer.truePresence !== "dnd";

  if (knockLegal) {
    return { ok: true, via: "knock" };
  }

  if (peer.privacy.note === "anyone") {
    return { ok: true, via: "note" };
  }

  if (peer.truePresence === "dnd") {
    return { ok: false, code: "dnd" };
  }

  return { ok: false, code: "forbidden" };
}
