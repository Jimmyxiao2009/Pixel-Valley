import { pixelFocusClass } from "../pixel/PixelFocusRing";
import { tileOrigin } from "./mapMetrics";
import { Nameplate } from "./Nameplate";

type BusStopSpriteProps = {
  slotIndex: number;
  attendantName?: string;
  onStop: () => void;
  onAttendant?: () => void;
};

export function BusStopSprite({
  slotIndex,
  attendantName,
  onStop,
  onAttendant,
}: BusStopSpriteProps) {
  const origin = tileOrigin(slotIndex);
  return (
    <div className="map-bus" style={{ left: origin.x, top: origin.y }}>
      <button
        type="button"
        className={pixelFocusClass("map-bus__stop")}
        aria-label="公交站"
        onClick={onStop}
      >
        <span className="map-bus__pole" aria-hidden="true" />
        <span className="map-bus__sign font-pixel">站</span>
      </button>
      {attendantName ? (
        <button
          type="button"
          className={pixelFocusClass("map-bus__lulu")}
          aria-label={`${attendantName}的门牌`}
          onClick={onAttendant ?? (() => undefined)}
        >
          <Nameplate name={attendantName} ai />
        </button>
      ) : null}
    </div>
  );
}
