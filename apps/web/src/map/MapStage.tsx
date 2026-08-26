import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { BubbleView, House, ObserverResident, Presence } from "@pixel-valley/domain";
import { BusStopSprite } from "./BusStopSprite";
import { CharacterSprite } from "./CharacterSprite";
import { HouseSprite } from "./HouseSprite";
import { hitTestLot } from "./hitTest";
import {
  bubbleIntent,
  dispatchMapIntent,
  intentFromHit,
  occupiedIntent,
  type MapIntentHandlers,
  type MapUi,
} from "./intent";
import { fillSlots, selfSlotIndex, type MapLot } from "./lots";
import {
  localYInTile,
  slotFromPoint,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  walkAnchor,
  WALK_MS_PER_TILE,
} from "./mapMetrics";
import { MapTile } from "./MapTile";
import { gridPath } from "./path";
import { RoofBubble, shouldPlayBubbleRise } from "./RoofBubble";
import { VacantLot } from "./VacantLot";

type MapStageProps = {
  lots: readonly MapLot[];
  houses: readonly House[];
  residents: readonly ObserverResident[];
  bubbles: readonly BubbleView[];
  meId: string;
  reduceMotion: boolean;
  ignoreClickRef: { current: boolean };
  onUi: (ui: MapUi) => void;
};

type WalkPos = { x: number; y: number; slot: number };

export function MapStage({
  lots: rawLots,
  houses,
  residents,
  bubbles,
  meId,
  reduceMotion,
  ignoreClickRef,
  onUi,
}: MapStageProps) {
  const lots = fillSlots(rawLots);
  const stageRef = useRef<HTMLDivElement>(null);
  const homeSlot = selfSlotIndex(lots, meId);
  const start = walkAnchor(homeSlot);
  const posRef = useRef<WalkPos>({ ...start, slot: homeSlot });
  const [pos, setPos] = useState<WalkPos>(posRef.current);
  const walkGen = useRef(0);
  const riseSeen = useRef(new Set<string>());
  const riseIds = useRef(new Set<string>());

  const residentsById = new Map(residents.map((resident) => [resident.id, resident]));
  const housesById = new Map(houses.map((house) => [house.id, house]));
  const bubblesByResident = new Map(bubbles.map((bubble) => [bubble.residentId, bubble]));

  for (const bubble of bubbles) {
    if (!riseSeen.current.has(bubble.residentId)) {
      riseSeen.current.add(bubble.residentId);
      if (shouldPlayBubbleRise(bubble.residentId, Date.now(), reduceMotion)) {
        riseIds.current.add(bubble.residentId);
      }
    }
  }

  useEffect(() => {
    const next = walkAnchor(homeSlot);
    posRef.current = { ...next, slot: homeSlot };
    setPos(posRef.current);
    walkGen.current += 1;
  }, [homeSlot]);

  useEffect(() => {
    return () => {
      walkGen.current += 1;
    };
  }, []);

  function startWalk(slotIndex: number): Promise<void> {
    const gen = ++walkGen.current;
    if (reduceMotion) {
      const snap = walkAnchor(slotIndex);
      posRef.current = { ...snap, slot: slotIndex };
      setPos(posRef.current);
      return Promise.resolve();
    }
    const path = gridPath(posRef.current.slot, slotIndex);
    if (path.length === 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let step = 0;
      let from = { x: posRef.current.x, y: posRef.current.y };
      let startedAt = performance.now();

      const tick = (now: number) => {
        if (gen !== walkGen.current) {
          resolve();
          return;
        }
        const destSlot = path[step];
        if (destSlot === undefined) {
          resolve();
          return;
        }
        const dest = walkAnchor(destSlot);
        const t = Math.min(1, (now - startedAt) / WALK_MS_PER_TILE);
        const x = from.x + (dest.x - from.x) * t;
        const y = from.y + (dest.y - from.y) * t;
        posRef.current = { x, y, slot: t === 1 ? destSlot : posRef.current.slot };
        setPos({ ...posRef.current });
        if (t < 1) {
          requestAnimationFrame(tick);
          return;
        }
        step += 1;
        from = dest;
        startedAt = now;
        if (step >= path.length) {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  const handlers: MapIntentHandlers = {
    openUi: onUi,
    walkTo: startWalk,
  };

  function activate(intent: ReturnType<typeof occupiedIntent>) {
    if (ignoreClickRef.current) {
      return;
    }
    dispatchMapIntent(intent, handlers);
  }

  function onStagePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (ignoreClickRef.current) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, a")) {
      return;
    }
    const root = stageRef.current;
    if (!root) {
      return;
    }
    const rect = root.getBoundingClientRect();
    const scaleX = rect.width / STAGE_WIDTH;
    const scaleY = rect.height / STAGE_HEIGHT;
    const x = (event.clientX - rect.left) / scaleX;
    const y = (event.clientY - rect.top) / scaleY;
    const slotIndex = slotFromPoint(x, y);
    if (slotIndex === null) {
      return;
    }
    const lot = lots[slotIndex];
    if (!lot) {
      return;
    }
    const bubble = lot.residentId ? bubblesByResident.get(lot.residentId) : undefined;
    const action = hitTestLot(localYInTile(y, slotIndex), {
      kind: lot.kind,
      hasBubble: Boolean(bubble),
    });
    dispatchMapIntent(intentFromHit(action, lot, bubble, meId), handlers);
  }

  const occupied = lots
    .filter((lot) => lot.kind === "house" || lot.kind === "self" || lot.kind === "overlay-ai")
    .sort((a, b) => {
      const aSelf = a.kind === "self" || a.residentId === meId ? 0 : 1;
      const bSelf = b.kind === "self" || b.residentId === meId ? 0 : 1;
      if (aSelf !== bSelf) {
        return aSelf - bSelf;
      }
      return a.slotIndex - b.slotIndex;
    });

  const bubbleLots = lots
    .map((lot) => {
      const bubble = lot.residentId ? bubblesByResident.get(lot.residentId) : undefined;
      return bubble ? { lot, bubble } : null;
    })
    .filter((entry): entry is { lot: MapLot; bubble: BubbleView } => entry !== null);

  const busLot = lots.find((lot) => lot.kind === "bus-stop");

  return (
    <div ref={stageRef} className="map-stage" onPointerUp={onStagePointerUp}>
      {lots.map((lot) => (
        <MapTile key={`tile-${lot.slotIndex}`} lot={lot} stagger={lot.slotIndex} />
      ))}

      {lots
        .filter((lot) => lot.kind === "vacant")
        .map((lot) => (
          <VacantLot
            key={`vacant-${lot.slotIndex}`}
            slotIndex={lot.slotIndex}
            onActivate={() => activate({ ui: { type: "vacant" }, walkTo: lot.slotIndex })}
          />
        ))}

      {occupied.map((lot) => {
        const resident = lot.residentId ? residentsById.get(lot.residentId) : undefined;
        const house = lot.houseId ? housesById.get(lot.houseId) : undefined;
        const name = house?.nameplate ?? resident?.displayName ?? "住户";
        const presence: Presence = resident?.observerPresence ?? "offline";
        return (
          <HouseSprite
            key={`house-${lot.slotIndex}`}
            slotIndex={lot.slotIndex}
            name={name}
            ai={resident?.kind === "ai"}
            self={lot.kind === "self" || lot.residentId === meId}
            overlay={lot.kind === "overlay-ai" || lot.overlay}
            presence={presence}
            stagger={lot.slotIndex}
            reduceMotion={reduceMotion}
            onActivate={() => activate(occupiedIntent(lot, meId))}
          />
        );
      })}

      <CharacterSprite x={pos.x} y={pos.y} />

      {bubbleLots.map(({ lot, bubble }) => {
        const resident = lot.residentId ? residentsById.get(lot.residentId) : undefined;
        return (
          <RoofBubble
            key={`bubble-${bubble.residentId}`}
            slotIndex={lot.slotIndex}
            bubble={bubble}
            authorName={resident?.displayName ?? "住户"}
            rise={riseIds.current.has(bubble.residentId)}
            onActivate={() => activate(bubbleIntent(lot, bubble))}
          />
        );
      })}

      {busLot ? (
        <BusStopSprite
          slotIndex={busLot.slotIndex}
          attendantName={
            busLot.residentId
              ? (residentsById.get(busLot.residentId)?.displayName ?? "路路")
              : undefined
          }
          onStop={() => activate({ ui: { type: "bus" }, walkTo: busLot.slotIndex })}
          onAttendant={
            busLot.residentId
              ? () => {
                  const attendantId = busLot.residentId;
                  if (attendantId) {
                    activate({
                      ui: { type: "peek", residentId: attendantId },
                      walkTo: busLot.slotIndex,
                    });
                  }
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
