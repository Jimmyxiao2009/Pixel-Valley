import { pixelFocusClass } from "../pixel/PixelFocusRing";

type BusStopSheetProps = {
  stopName: string;
  onClose: () => void;
};

export function BusStopSheet({ stopName, onClose }: BusStopSheetProps) {
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
      <p className="map-sheet__meta font-pixel">开往镇中心</p>
      <button
        type="button"
        className={pixelFocusClass("map-sheet__action")}
        onClick={() => undefined}
      >
        坐上去
      </button>
      <p className="map-sheet__meta font-pixel">也可直接去：</p>
      <p className="map-sheet__body font-pixel">广场 公告栏 图书馆 咖啡馆</p>
      <button type="button" className={pixelFocusClass("map-sheet__close")} onClick={onClose}>
        关门
      </button>
    </div>
  );
}
