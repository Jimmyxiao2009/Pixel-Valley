import type { Presence } from "@pixel-valley/domain";
import { pixelFocusClass } from "../pixel/PixelFocusRing";
import { houseOrigin } from "./mapMetrics";
import { Nameplate } from "./Nameplate";

type HouseSpriteProps = {
  slotIndex: number;
  name: string;
  ai?: boolean;
  self?: boolean;
  overlay?: boolean;
  /** §12.4.2: the house this visit came looking for. */
  focused?: boolean;
  presence: Presence;
  stagger: number;
  reduceMotion: boolean;
  onActivate: () => void;
};

export function HouseSprite({
  slotIndex,
  name,
  ai = false,
  self = false,
  overlay = false,
  focused = false,
  presence,
  stagger,
  reduceMotion,
  onActivate,
}: HouseSpriteProps) {
  const origin = houseOrigin(slotIndex);
  const lampOn = presence === "online" || presence === "writing" || presence === "chatting";
  const className = [
    "map-house",
    self ? "map-house--self" : "",
    ai ? "map-house--ai" : "",
    overlay ? "map-house--overlay" : "",
    focused ? "map-house--focused" : "",
    reduceMotion ? "is-instant" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={pixelFocusClass(className)}
      style={{ left: origin.x, top: origin.y, ["--stagger" as string]: String(stagger) }}
      aria-label={`${name}的家${focused ? "，你要找的就是这家" : ""}${self ? "，回屋里" : ""}`}
      onClick={onActivate}
    >
      <span className="map-house__sprite" aria-hidden="true">
        <span className="map-house__roof" />
        <span className="map-house__wall">
          <span
            className={
              presence === "writing"
                ? "map-house__window map-house__window--writing"
                : lampOn
                  ? "map-house__window is-on"
                  : "map-house__window"
            }
          />
          <span className="map-house__door" />
        </span>
      </span>
      <Nameplate name={name} ai={ai} />
    </button>
  );
}
