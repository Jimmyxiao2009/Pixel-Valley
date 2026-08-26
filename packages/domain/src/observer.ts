import type { Presence, Resident } from "./types.ts";

const ONLINE_WINDOW_MS = 90_000;

export function deriveObserverPresence(truePresence: Presence, showOnline: boolean): Presence {
  if (!showOnline) {
    return "offline";
  }
  return truePresence;
}

export function resolveTruePresence(
  resident: Pick<Resident, "truePresence" | "lastSeenAt">,
  now: Date,
  extras: { writing: boolean; chatting: boolean },
): Presence {
  if (resident.truePresence === "dnd") {
    return "dnd";
  }
  if (extras.writing) {
    return "writing";
  }
  if (extras.chatting) {
    return "chatting";
  }
  if (now.getTime() - Date.parse(resident.lastSeenAt) <= ONLINE_WINDOW_MS) {
    return "online";
  }
  return "offline";
}

export function withObserverFields(
  resident: Resident,
  now: Date,
  extras: { writing: boolean; chatting: boolean },
): Resident {
  const truePresence = resolveTruePresence(resident, now, extras);
  return {
    ...resident,
    truePresence,
    observerPresence: deriveObserverPresence(truePresence, resident.privacy.showOnline),
  };
}
