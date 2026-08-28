import type { BubbleView } from "@pixel-valley/domain";
import { pixelFocusClass } from "../pixel/PixelFocusRing";
import { bubbleAnchor } from "./mapMetrics";

const lastRiseAt = new Map<string, number>();
const RISE_COOLDOWN_MS = 30_000;

export function shouldPlayBubbleRise(
  residentId: string,
  now: number,
  reduceMotion: boolean,
): boolean {
  if (reduceMotion) {
    return false;
  }
  const last = lastRiseAt.get(residentId);
  if (last !== undefined && now - last < RISE_COOLDOWN_MS) {
    return false;
  }
  lastRiseAt.set(residentId, now);
  return true;
}

type RoofBubbleProps = {
  slotIndex: number;
  bubble: BubbleView;
  authorName: string;
  rise: boolean;
  onActivate: () => void;
};

export function RoofBubble({ slotIndex, bubble, authorName, rise, onActivate }: RoofBubbleProps) {
  const anchor = bubbleAnchor(slotIndex);
  const collapsed = bubble.collapsed;
  const badge = !collapsed && bubble.count24h >= 2 && bubble.count24h <= 5 ? bubble.count24h : null;
  const label = collapsed
    ? `${authorName}最近 ${bubble.count24h} 条`
    : `${authorName}的帖子：${bubble.excerpt}`;

  return (
    <button
      type="button"
      className={pixelFocusClass(
        [
          "roof-bubble",
          collapsed ? "roof-bubble--count" : "",
          bubble.hot ? "roof-bubble--hot" : "",
          rise ? "roof-bubble--rise" : "",
        ]
          .filter(Boolean)
          .join(" "),
      )}
      style={{ left: anchor.x, top: anchor.y }}
      aria-label={label}
      title={collapsed ? `${bubble.count24h} 条近况` : bubble.excerpt}
      onClick={onActivate}
    >
      <span className="roof-bubble__visual">
        {collapsed ? (
          <span className="roof-bubble__block font-pixel">{bubble.count24h}</span>
        ) : (
          <>
            <span className="roof-bubble__text font-pixel">{bubble.excerpt}</span>
            {badge !== null ? <span className="roof-bubble__badge font-pixel">{badge}</span> : null}
          </>
        )}
        <span className="roof-bubble__tail" aria-hidden="true" />
      </span>
    </button>
  );
}
