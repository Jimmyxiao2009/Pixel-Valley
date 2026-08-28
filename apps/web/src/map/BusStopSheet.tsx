import { pixelFocusClass } from "../pixel/PixelFocusRing";
import { ZONE_ORDER, ZONES } from "../town/zones";
import type { TownZoneId } from "../data/api";

type BusStopSheetProps = {
  stopName: string;
  onRide: (zone: TownZoneId) => void;
  onClose: () => void;
};

/** §3.8 / §4.8: t=0 sheet, ride to the plaza, or pick a stop from the timetable. */
export function BusStopSheet({ stopName, onRide, onClose }: BusStopSheetProps) {
  return (
    <div
      className="map-sheet map-sheet--bus"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bus-title"
    >
      <p id="bus-title" className="map-sheet__title font-pixel">
        {stopName}站
      </p>
      <p className="map-sheet__meta font-pixel">下一班：镇中心 · 广场</p>
      <button
        type="button"
        className={pixelFocusClass("map-sheet__action")}
        onClick={() => onRide("plaza")}
      >
        坐上去
      </button>
      <p className="map-sheet__meta font-pixel" id="bus-timetable">
        也可直接去：
      </p>
      <ul className="bus-timetable" aria-labelledby="bus-timetable">
        {ZONE_ORDER.map((zone) => (
          <li key={zone}>
            <button
              type="button"
              className={pixelFocusClass("bus-timetable__stop")}
              onClick={() => onRide(zone)}
            >
              {ZONES[zone].title}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className={pixelFocusClass("map-sheet__close")} onClick={onClose}>
        关门
      </button>
    </div>
  );
}
