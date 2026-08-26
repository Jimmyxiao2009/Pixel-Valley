import { useRef } from "react";
import { useParams } from "react-router-dom";
import { PixelStage } from "../pixel/PixelStage";
import { computeLetterbox, MAP_LOGICAL_HEIGHT, MAP_LOGICAL_WIDTH } from "../pixel/integerScale";
import { useElementSize } from "../pixel/useElementSize";

type NeighborhoodSceneProps = {
  mode: "mine" | "canonical";
};

const TILE_COUNT = 12;

export function NeighborhoodScene({ mode }: NeighborhoodSceneProps) {
  const { neighborhoodId } = useParams();
  const hostRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(hostRef);
  const box = computeLetterbox(size.width, size.height, MAP_LOGICAL_WIDTH, MAP_LOGICAL_HEIGHT);
  const title = mode === "mine" ? "我的街" : neighborhoodId ? `户籍街 ${neighborhoodId}` : "户籍街";

  return (
    <div className="pv-scene-column">
      <p className="pv-map-chrome font-pixel">
        邻里 · {title} · 缩放 ×{box.scale} · 舞台 {MAP_LOGICAL_WIDTH}×{MAP_LOGICAL_HEIGHT}
      </p>
      <div ref={hostRef} className="pv-stage-host">
        <PixelStage
          logicalWidth={MAP_LOGICAL_WIDTH}
          logicalHeight={MAP_LOGICAL_HEIGHT}
          box={box}
          label={`${title}舞台`}
        >
          <div className="map-stage">
            <div className="map-stage__tiles">
              {Array.from({ length: TILE_COUNT }, (_, index) => (
                <div key={index} className={index >= 8 ? "map-tile map-tile--path" : "map-tile"} />
              ))}
            </div>
          </div>
        </PixelStage>
      </div>
    </div>
  );
}
