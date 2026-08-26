import { pixelFocusClass } from "../pixel/PixelFocusRing";
import { tileOrigin, TILE } from "./mapMetrics";

type VacantLotProps = {
  slotIndex: number;
  onActivate: () => void;
};

export function VacantLot({ slotIndex, onActivate }: VacantLotProps) {
  const origin = tileOrigin(slotIndex);
  return (
    <button
      type="button"
      className={pixelFocusClass("map-vacant")}
      style={{ left: origin.x, top: origin.y + 44, width: TILE, height: 4 }}
      aria-label="这块地还空着"
      onClick={onActivate}
    />
  );
}
