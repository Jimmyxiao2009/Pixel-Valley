import type { ReactNode } from "react";
import type { Letterbox } from "./integerScale";

type PixelStageProps = {
  logicalWidth: number;
  logicalHeight: number;
  box: Letterbox;
  label: string;
  children: ReactNode;
  panX?: number;
  panY?: number;
};

export function PixelStage({
  logicalWidth,
  logicalHeight,
  box,
  label,
  children,
  panX = 0,
  panY = 0,
}: PixelStageProps) {
  const offsetX = Math.max(0, box.offsetX) - panX;
  const offsetY = Math.max(0, box.offsetY) - panY;

  return (
    <div
      className="pv-stage-slot"
      style={{
        width: box.stageWidth,
        height: box.stageHeight,
        transform: `translate(${offsetX}px, ${offsetY}px)`,
      }}
    >
      <div
        className="pv-stage"
        role="group"
        aria-label={label}
        data-scale={box.scale}
        style={{
          width: logicalWidth,
          height: logicalHeight,
          transform: `scale(${box.scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
