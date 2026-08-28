import { tileOrigin } from "./mapMetrics";
import type { MapLot } from "./lots";

type MapTileProps = {
  lot: MapLot;
  stagger: number;
};

export function MapTile({ lot, stagger }: MapTileProps) {
  const origin = tileOrigin(lot.slotIndex);
  const surface =
    lot.kind === "road" || lot.kind === "bus-stop" ? "path" : lot.kind === "tree" ? "tree" : "lot";
  return (
    <div
      className={`map-tile map-tile--${surface}`}
      data-slot={lot.slotIndex}
      style={{ left: origin.x, top: origin.y, ["--stagger" as string]: String(stagger) }}
    >
      {lot.kind === "tree" ? <span className="map-tile__tree" aria-hidden="true" /> : null}
    </div>
  );
}
