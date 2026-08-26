import type { AiRole, Presence, Resident } from "./types.ts";

const ONLINE_WINDOW_MS = 90_000;

const PUBLIC_AI_ROLES = new Set<AiRole>(["guide", "librarian", "editor", "bus"]);

export function isPublicServiceAi(resident: Pick<Resident, "kind" | "aiRole">): boolean {
  return resident.kind === "ai" && resident.aiRole !== null && PUBLIC_AI_ROLES.has(resident.aiRole);
}

export function deriveObserverPresence(
  truePresence: Presence,
  showOnline: boolean,
  resident?: Pick<Resident, "kind" | "aiRole">,
): Presence {
  if (resident && isPublicServiceAi(resident)) {
    return "online";
  }
  if (!showOnline) {
    return "offline";
  }
  return truePresence;
}

export function resolveTruePresence(
  resident: Pick<Resident, "truePresence" | "lastSeenAt" | "kind" | "aiRole">,
  now: Date,
  extras: { writing: boolean; chatting: boolean },
): Presence {
  if (isPublicServiceAi(resident)) {
    return "online";
  }
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
    observerPresence: deriveObserverPresence(truePresence, resident.privacy.showOnline, resident),
  };
}
