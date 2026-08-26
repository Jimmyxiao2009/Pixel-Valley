import { useRef } from "react";
import { PixelFocusRing } from "../pixel/PixelFocusRing";
import { PixelStage } from "../pixel/PixelStage";
import { computeLetterbox, HOME_LOGICAL_HEIGHT, HOME_LOGICAL_WIDTH } from "../pixel/integerScale";
import { useElementSize } from "../pixel/useElementSize";

type HomeSceneProps = {
  mode?: "owner" | "guest";
};

const HOTSPOTS = [
  { id: "window", label: "窗", className: "home-hotspot home-hotspot--window" },
  { id: "computer", label: "电脑", className: "home-hotspot home-hotspot--computer" },
  { id: "door", label: "门", className: "home-hotspot home-hotspot--door" },
  { id: "bookshelf", label: "书架", className: "home-hotspot home-hotspot--bookshelf" },
  { id: "cushion", label: "伙伴坐垫", className: "home-hotspot home-hotspot--cushion" },
] as const;

export function HomeScene({ mode = "owner" }: HomeSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(hostRef);
  const box = computeLetterbox(size.width, size.height, HOME_LOGICAL_WIDTH, HOME_LOGICAL_HEIGHT);
  const heading = mode === "guest" ? "访客房" : "我的家";

  return (
    <div className="pv-scene-column">
      <div ref={hostRef} className="pv-stage-host">
        <PixelStage
          logicalWidth={HOME_LOGICAL_WIDTH}
          logicalHeight={HOME_LOGICAL_HEIGHT}
          box={box}
          label={`${heading}舞台`}
        >
          <div className="home-room">
            <div className="home-room__wall" />
            <div className="home-room__floor" />
            <p className="home-room__title font-pixel">{heading}</p>
            {HOTSPOTS.map((spot) => (
              <PixelFocusRing key={spot.id} className={spot.className} aria-label={spot.label}>
                {spot.label}
              </PixelFocusRing>
            ))}
          </div>
        </PixelStage>
      </div>
      <p className="pv-hint font-pixel">
        缩放 ×{box.scale} · 舞台 {HOME_LOGICAL_WIDTH}×{HOME_LOGICAL_HEIGHT} · 只使用整数倍
      </p>
    </div>
  );
}
