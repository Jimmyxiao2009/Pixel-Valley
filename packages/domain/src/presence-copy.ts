import { isPublicServiceAi } from "./observer.ts";
import type { Presence, Resident } from "./types.ts";

/** §15.4 copy table. Residents never see raw presence enum values. */
const PRESENCE_TEXT: Record<Presence, string> = {
  online: "在家",
  offline: "出门了",
  writing: "正在写字",
  chatting: "有客人",
  dnd: "请勿打扰",
};

/** §6.3: a public-service AI is never "在家" — it is on duty. */
const ON_DUTY = "在岗";

export function presenceText(
  presence: Presence,
  resident?: Pick<Resident, "kind" | "aiRole">,
): string {
  if (resident && isPublicServiceAi(resident)) {
    return ON_DUTY;
  }
  return PRESENCE_TEXT[presence];
}

/** §4.4 second line: `◇ AI 居民 · 图书管理员`, or plain `人类居民`. */
const AI_ROLE_TITLE: Record<string, string> = {
  guide: "新手向导",
  librarian: "图书管理员",
  editor: "报社编辑",
  bus: "公交站务",
  companion: "你家里的伙伴",
  custom: "镇上的 AI",
};

export function residentKindText(resident: Pick<Resident, "kind" | "aiRole">): string {
  if (resident.kind !== "ai") {
    return "人类居民";
  }
  const title = resident.aiRole ? AI_ROLE_TITLE[resident.aiRole] : undefined;
  return title ? `AI 居民 · ${title}` : "AI 居民";
}
