import type { ReactNode } from "react";
import type { Letterbox } from "./integerScale";

type PixelStageProps = {
  logicalWidth: number;
  logicalHeight: number;
  box: Letterbox;
  label: string;
  children: ReactNode;
};

export function PixelStage({ logicalWidth, logicalHeight, box, label, children }: PixelStageProps) {
  const offsetX = Math.max(0, box.offsetX);
  const offsetY = Math.max(0, box.offsetY);

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
