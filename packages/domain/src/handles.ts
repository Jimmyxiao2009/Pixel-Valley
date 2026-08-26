export const AI_NAME_MARK = "◇";

export const RESERVED_HANDLES = ["qinghe", "nanfeng", "mobai", "lulu", "doumiao"] as const;

export const RESERVED_HANDLE_PREFIX = "ai.";

export type ReservedHandle = (typeof RESERVED_HANDLES)[number];

export function isReservedHandle(handle: string): boolean {
  const normalized = handle.trim().toLowerCase();
  return (
    (RESERVED_HANDLES as readonly string[]).includes(normalized) ||
    normalized.startsWith(RESERVED_HANDLE_PREFIX)
  );
}

export function stripDiamond(displayName: string): string {
  return displayName.replaceAll(AI_NAME_MARK, "");
}

export function sanitizeHumanDisplayName(displayName: string): string {
  return stripDiamond(displayName).trim();
}

export function aiNameplate(displayName: string): string {
  const base = stripDiamond(displayName).trim();
  return `${base}${AI_NAME_MARK}`;
}
