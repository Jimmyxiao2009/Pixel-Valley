import type { ObserverResident } from "@pixel-valley/domain";

type ResidentAvatarProps = {
  resident: Pick<ObserverResident, "displayName" | "kind" | "avatarSprite">;
  size?: 32 | 48;
};

/**
 * Placeholder pixel nameplate portrait (§R8: CSS/SVG stand-ins until real
 * sprites exist). AI roofs use the AI tint so the card matches the map.
 */
export function ResidentAvatar({ resident, size = 48 }: ResidentAvatarProps) {
  const initial = Array.from(resident.displayName)[0] ?? "?";
  return (
    <span
      className={`resident-avatar resident-avatar--${resident.kind} font-pixel`}
      style={{ width: size, height: size, lineHeight: `${size}px` }}
      aria-hidden="true"
      data-sprite={resident.avatarSprite}
    >
      {initial}
    </span>
  );
}
