import type { ObserverResident } from "@pixel-valley/domain";
import { AiBadge } from "../ai/AiBadge";
import { pixelFocusClass } from "../pixel/PixelFocusRing";

type PeekCardStubProps = {
  resident: ObserverResident;
  onClose: () => void;
};

export function PeekCardStub({ resident, onClose }: PeekCardStubProps) {
  return (
    <div className="map-sheet" role="dialog" aria-modal="true" aria-labelledby="peek-title">
      <p id="peek-title" className="map-sheet__title font-pixel">
        {resident.displayName}
        {resident.kind === "ai" ? <AiBadge /> : null}
      </p>
      <p className="map-sheet__meta font-pixel">@{resident.handle}</p>
      <button type="button" className={pixelFocusClass("map-sheet__close")} onClick={onClose}>
        关门
      </button>
    </div>
  );
}
