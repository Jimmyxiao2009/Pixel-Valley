import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { NavLink, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type {
  BubbleView,
  NeighborhoodView,
  ObserverResident,
  StreetMineResponse,
} from "@pixel-valley/domain";
import { BusStopSheet } from "../map/BusStopSheet";
import { BusTransition } from "../town/BusTransition";
import type { TownZoneId } from "../data/api";
import { MapStage } from "../map/MapStage";
import type { MapUi } from "../map/intent";
import { lotsFromCanonical, lotsFromMine, type MapLot } from "../map/lots";
import { PeekCardHost } from "../residents/PeekCardHost";
import { PostDetailSheet } from "../map/PostDetailSheet";
import { fetchNeighborhood, fetchStreetMine } from "../data/api";
import { readWowNavState } from "../posts/wow";
import { pixelFocusClass } from "../pixel/PixelFocusRing";
import { ZONES } from "../town/zones";
import { PixelStage } from "../pixel/PixelStage";
import { computeLetterbox, MAP_LOGICAL_HEIGHT, MAP_LOGICAL_WIDTH } from "../pixel/integerScale";
import { computeFocusPan } from "../map/focusPan";
import { useElementSize } from "../pixel/useElementSize";
import { usePrefersReducedMotion } from "../pixel/usePrefersReducedMotion";
import { useSession } from "../session/SessionProvider";

type NeighborhoodSceneProps = {
  mode: "mine" | "canonical";
};

type StreetSlice = "mine" | "neighbors" | "recommended";

function readSlice(raw: string | null): StreetSlice | null {
  if (raw === "neighbors" || raw === "recommended") {
    return raw;
  }
  return raw === "mine" ? "mine" : null;
}

export function NeighborhoodScene({ mode }: NeighborhoodSceneProps) {
  const { neighborhoodId } = useParams();
  const [params] = useSearchParams();
  const slice = mode === "mine" ? (readSlice(params.get("slice")) ?? "mine") : null;
  const { me } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  // §3.1 wow: arrived straight from the composer, so say so out loud once.
  const wowArrival = mode === "mine" && readWowNavState(location.state);
  const reduceMotion = usePrefersReducedMotion();
  const hostRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(hostRef);
  const box = computeLetterbox(size.width, size.height, MAP_LOGICAL_WIDTH, MAP_LOGICAL_HEIGHT);
  const ignoreClickRef = useRef(false);
  const panDrag = useRef<{
    id: number;
    x: number;
    y: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [reload, setReload] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [mine, setMine] = useState<StreetMineResponse | null>(null);
  const [canonical, setCanonical] = useState<NeighborhoodView | null>(null);
  const [ui, setUi] = useState<MapUi | null>(null);
  const [vacantToast, setVacantToast] = useState(false);
  // §3.8: the ride is a curtain over a navigation that is already decided.
  const [ridingTo, setRidingTo] = useState<TownZoneId | null>(null);
  // §12.4.2 deep link. Only canonical streets consume it — the derived
  // my-street layout is never rebuilt to satisfy a focus (KD-19).
  const focusResidentId = mode === "canonical" ? params.get("focusResidentId") : null;
  const [focusMissing, setFocusMissing] = useState(false);
  const [focusFaded, setFocusFaded] = useState(false);
  const focusAppliedRef = useRef<string | null>(null);

  const homeNeighborhoodId = me?.resident.homeNeighborhoodId ?? null;
  const showMap = slice === null || slice === "mine";

  useEffect(() => {
    if (!showMap) {
      setStatus("ready");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setFocusMissing(false);
    focusAppliedRef.current = null;
    const request =
      mode === "mine"
        ? fetchStreetMine()
        : neighborhoodId
          ? fetchNeighborhood(neighborhoodId, {
              focusResidentId: focusResidentId ?? undefined,
            })
          : Promise.reject(new Error("missing-id"));
    void request
      .then((payload) => {
        if (cancelled) {
          return;
        }
        if (mode === "mine") {
          setMine(payload as StreetMineResponse);
          setCanonical(null);
        } else {
          const view = payload as NeighborhoodView;
          setCanonical(view);
          // §12.4.2: asked for someone who does not live here — say so, and
          // leave the street exactly as it is.
          setFocusMissing(Boolean(focusResidentId) && view.focus === null);
        }
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mode, neighborhoodId, showMap, reload, focusResidentId]);

  useEffect(() => {
    if (!ui) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setUi(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ui]);

  const overflowX = Math.max(0, box.stageWidth - size.width);
  const overflowY = Math.max(0, box.stageHeight - size.height);
  const panX = Math.min(pan.x, overflowX);
  const panY = Math.min(pan.y, overflowY);

  const focus = canonical?.focus ?? null;
  const focusName =
    focus && canonical
      ? (canonical.residents.find((resident) => resident.id === focus.residentId)?.displayName ??
        "这位居民")
      : null;

  // Move the camera onto the slot the server reported. The houses never move
  // (KD-19); only the viewport does. Runs once per focus, and again after a
  // resize, so a re-render cannot fight the resident's own panning.
  useEffect(() => {
    if (!focus || size.width === 0) {
      return;
    }
    const key = `${focus.residentId}:${box.scale}:${size.width}x${size.height}`;
    if (focusAppliedRef.current === key) {
      return;
    }
    focusAppliedRef.current = key;
    setPan(
      computeFocusPan({
        slotIndex: focus.slotIndex,
        scale: box.scale,
        stageWidth: box.stageWidth,
        stageHeight: box.stageHeight,
        viewportWidth: size.width,
        viewportHeight: size.height,
        currentPan: { x: pan.x, y: pan.y },
      }),
    );
  }, [focus, box.scale, box.stageWidth, box.stageHeight, size.width, size.height, pan.x, pan.y]);

  // §15.3: the arrival note fades on its own and changes nothing else.
  useEffect(() => {
    if (!focusName) {
      return;
    }
    const timer = window.setTimeout(() => setFocusFaded(true), 4000);
    setFocusFaded(false);
    return () => window.clearTimeout(timer);
  }, [focusName, focus?.residentId]);

  const onHostPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (overflowX <= 0 && overflowY <= 0) {
      return;
    }
    panDrag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      panX,
      panY,
      moved: false,
    };
  };

  const onHostPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = panDrag.current;
    if (!drag || drag.id !== event.pointerId) {
      return;
    }
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) {
      return;
    }
    if (!drag.moved) {
      drag.moved = true;
      ignoreClickRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const nextX = Math.max(0, Math.min(overflowX, drag.panX - dx));
    const nextY = Math.max(0, Math.min(overflowY, drag.panY - dy));
    setPan({ x: nextX, y: nextY });
  };

  const onHostPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = panDrag.current;
    panDrag.current = null;
    if (drag?.moved) {
      window.setTimeout(() => {
        ignoreClickRef.current = false;
      }, 0);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onUi = useCallback(
    (next: MapUi) => {
      if (next.type === "home") {
        navigate("/home");
        return;
      }
      if (next.type === "vacant") {
        setVacantToast(true);
        return;
      }
      setVacantToast(false);
      setUi(next);
    },
    [navigate],
  );

  const lots: MapLot[] = showMap
    ? mode === "mine" && mine
      ? lotsFromMine(mine.slots)
      : canonical
        ? lotsFromCanonical(canonical)
        : []
    : [];
  const residents: ObserverResident[] =
    (mode === "mine" ? mine?.residents : canonical?.residents) ?? [];
  const houses = (mode === "mine" ? mine?.houses : canonical?.houses) ?? [];
  const bubbles: BubbleView[] = (mode === "mine" ? mine?.bubbles : canonical?.bubbles) ?? [];
  const streetName =
    (mode === "mine" ? mine?.neighborhood.name : canonical?.neighborhood.name) ??
    (homeNeighborhoodId === "wutong" ? "梧桐街" : "户籍街");
  const homeStreetName =
    (mode === "mine" ? mine?.neighborhood.name : null) ??
    (neighborhoodId === homeNeighborhoodId ? canonical?.neighborhood.name : null) ??
    (homeNeighborhoodId === "wutong" ? "梧桐街" : "户籍街");
  const quiet = showMap && status === "ready" && bubbles.length === 0;
  const viewLabel =
    slice === "neighbors"
      ? "邻里的街"
      : slice === "recommended"
        ? "推荐街"
        : mode === "mine"
          ? "我的街"
          : streetName;

  const postBubble =
    ui?.type === "post" ? (bubbles.find((bubble) => bubble.postId === ui.postId) ?? null) : null;
  const postAuthor =
    ui?.type === "post"
      ? (residents.find((resident) => resident.id === ui.residentId)?.displayName ?? "住户")
      : "";

  return (
    <div className="pv-scene-column">
      <div className="pv-map-chrome">
        {/* §3.10: visiting someone else's canonical street needs an explicit way
            home. /street is the derived my-street, never /n/{myHomeStreet}. */}
        {mode === "canonical" && neighborhoodId !== homeNeighborhoodId ? (
          <div className="street-visiting">
            <p className="street-visiting__where font-pixel">在{streetName}做客</p>
            <button
              type="button"
              className={pixelFocusClass("street-visiting__back")}
              onClick={() => navigate("/street")}
            >
              回我的街
            </button>
          </div>
        ) : null}
        <div className="street-tabs" role="tablist" aria-label="街分片">
          <NavLink
            to="/street"
            end
            role="tab"
            aria-selected={mode === "mine" && slice === "mine"}
            className={({ isActive }) =>
              pixelFocusClass(
                isActive && slice === "mine" ? "street-tabs__tab is-active" : "street-tabs__tab",
              )
            }
          >
            我的街
          </NavLink>
          <NavLink
            to={homeNeighborhoodId ? `/n/${homeNeighborhoodId}` : "/street"}
            role="tab"
            aria-selected={mode === "canonical" && neighborhoodId === homeNeighborhoodId}
            className={({ isActive }) =>
              pixelFocusClass(isActive ? "street-tabs__tab is-active" : "street-tabs__tab")
            }
          >
            {homeStreetName}
          </NavLink>
          <NavLink
            to="/street?slice=neighbors"
            role="tab"
            aria-selected={slice === "neighbors"}
            className={() =>
              pixelFocusClass(
                slice === "neighbors" ? "street-tabs__tab is-active" : "street-tabs__tab",
              )
            }
          >
            邻里的街
          </NavLink>
          <NavLink
            to="/street?slice=recommended"
            role="tab"
            aria-selected={slice === "recommended"}
            className={() =>
              pixelFocusClass(
                slice === "recommended" ? "street-tabs__tab is-active" : "street-tabs__tab",
              )
            }
          >
            推荐街
          </NavLink>
        </div>
      </div>

      {slice === "neighbors" ? (
        <p className="street-empty font-body" role="status">
          还没有邻里。在镇上认识人，再结为邻里。
        </p>
      ) : null}
      {slice === "recommended" ? (
        <p className="street-empty font-body" role="status">
          过一阵再来这条巷。
        </p>
      ) : null}

      {showMap ? (
        <div
          ref={hostRef}
          className="pv-stage-host pv-stage-host--map"
          onPointerDown={onHostPointerDown}
          onPointerMove={onHostPointerMove}
          onPointerUp={onHostPointerUp}
          onPointerCancel={onHostPointerUp}
        >
          {status === "error" ? (
            <div className="street-error font-pixel" role="alert">
              <p>这条街暂时走不出去</p>
              <button
                type="button"
                className={pixelFocusClass("map-sheet__close")}
                onClick={() => setReload((n) => n + 1)}
              >
                再走一次
              </button>
            </div>
          ) : (
            <PixelStage
              logicalWidth={MAP_LOGICAL_WIDTH}
              logicalHeight={MAP_LOGICAL_HEIGHT}
              box={box}
              label={`${viewLabel}舞台`}
              panX={panX}
              panY={panY}
            >
              {status === "ready" && lots.length > 0 && me ? (
                <MapStage
                  key={`${mode}-${neighborhoodId ?? "mine"}-${me.resident.id}`}
                  lots={lots}
                  houses={houses}
                  residents={residents}
                  bubbles={bubbles}
                  meId={me.resident.id}
                  focusSlotIndex={focus?.slotIndex ?? null}
                  reduceMotion={reduceMotion}
                  ignoreClickRef={ignoreClickRef}
                  onUi={onUi}
                />
              ) : (
                <div className="map-stage map-stage--ghost" aria-hidden="true">
                  {Array.from({ length: 12 }, (_, index) => (
                    <div
                      key={index}
                      className={
                        index >= 8
                          ? "map-tile map-tile--path map-tile--ghost"
                          : "map-tile map-tile--ghost"
                      }
                      style={{
                        left: 16 + (index % 4) * 48,
                        top: 48 + Math.floor(index / 4) * 48,
                      }}
                    />
                  ))}
                </div>
              )}
            </PixelStage>
          )}
          {wowArrival && status === "ready" ? (
            <p className="map-toast map-toast--wow font-pixel" role="status" aria-live="polite">
              已经贴在房顶上了。
            </p>
          ) : null}
          {focusName && !focusFaded ? (
            <p className="map-toast map-toast--focus font-pixel" role="status" aria-live="polite">
              找到{focusName}的家了。
            </p>
          ) : null}
          {focusMissing ? (
            <p className="map-toast map-toast--focus font-pixel" role="status" aria-live="polite">
              这家不在这条街上。
            </p>
          ) : null}
          {quiet ? (
            <p className="map-toast font-pixel" role="status">
              这条街这会儿很安静
            </p>
          ) : null}
          {vacantToast ? (
            <p className="map-toast map-toast--vacant font-pixel" role="status">
              这块地还空着
            </p>
          ) : null}
        </div>
      ) : null}

      {ui && ui.type !== "vacant" && ui.type !== "home" ? (
        <div className="map-overlay">
          <button
            type="button"
            className="map-overlay__backdrop"
            aria-label="关闭"
            onClick={() => setUi(null)}
          />
          {ui.type === "peek" ? (
            <PeekCardHost
              residentId={ui.residentId}
              currentNeighborhoodId={mode === "canonical" ? (neighborhoodId ?? null) : null}
              onClose={() => setUi(null)}
              onRelationChanged={() => setReload((n) => n + 1)}
            />
          ) : null}
          {ui.type === "post" && postBubble ? (
            <PostDetailSheet
              postId={postBubble.postId}
              excerpt={postBubble.excerpt}
              authorName={postAuthor}
              count24h={postBubble.count24h}
              onClose={() => setUi(null)}
            />
          ) : null}
          {ui.type === "bus" ? (
            <BusStopSheet
              stopName={streetName}
              onRide={(zone) => {
                setUi(null);
                setRidingTo(zone);
              }}
              onClose={() => setUi(null)}
            />
          ) : null}
        </div>
      ) : null}

      {ridingTo ? (
        <BusTransition
          destination={ZONES[ridingTo].title}
          onDone={() => {
            const zone = ridingTo;
            setRidingTo(null);
            navigate(`/town/${zone}`);
          }}
        />
      ) : null}
    </div>
  );
}
