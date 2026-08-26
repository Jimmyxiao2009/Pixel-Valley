import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { ObserverResident } from "@pixel-valley/domain";
import { ChatPanel, CompanionTeaser } from "../chat/ChatPanel";
import { fetchNeighborhood, fetchResident } from "../data/api";
import { PixelFocusRing } from "../pixel/PixelFocusRing";
import { PixelStage } from "../pixel/PixelStage";
import { computeLetterbox, HOME_LOGICAL_HEIGHT, HOME_LOGICAL_WIDTH } from "../pixel/integerScale";
import { useElementSize } from "../pixel/useElementSize";
import { ComposerDialog } from "../posts/ComposerDialog";
import { useSession } from "../session/SessionProvider";
import { BookshelfSheet } from "./BookshelfSheet";

type HomeSceneProps = {
  mode?: "owner" | "guest";
};

type Overlay = "composer" | "bookshelf" | "chat" | "teaser" | null;

type HotspotId = "window" | "computer" | "door" | "bookshelf" | "cushion";

const HOTSPOTS: { id: HotspotId; label: string; className: string }[] = [
  { id: "window", label: "窗", className: "home-hotspot home-hotspot--window" },
  { id: "computer", label: "电脑", className: "home-hotspot home-hotspot--computer" },
  { id: "door", label: "门", className: "home-hotspot home-hotspot--door" },
  { id: "bookshelf", label: "书架", className: "home-hotspot home-hotspot--bookshelf" },
  { id: "cushion", label: "伙伴坐垫", className: "home-hotspot home-hotspot--cushion" },
];

export function HomeScene({ mode = "owner" }: HomeSceneProps) {
  const isGuest = mode === "guest";
  const { me, refresh } = useSession();
  const { residentId } = useParams();
  const navigate = useNavigate();
  const hostRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(hostRef);
  const box = computeLetterbox(size.width, size.height, HOME_LOGICAL_WIDTH, HOME_LOGICAL_HEIGHT);

  const [host, setHost] = useState<ObserverResident | null>(null);
  const [neighborhoodName, setNeighborhoodName] = useState<string | null>(null);
  const [hostNeighborhoodId, setHostNeighborhoodId] = useState<string | null>(null);
  const [roomError, setRoomError] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [hintSpot, setHintSpot] = useState<HotspotId | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [computerFlash, setComputerFlash] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const self = me?.resident ?? null;
  const roomResident = isGuest ? host : self;
  const heading = isGuest ? "访客房" : "我的家";
  const needsGuide = !isGuest && self?.onboarding.firstPostAt === null;
  const hasCompanion = !isGuest && Boolean(self?.companionResidentId);
  const windowName = neighborhoodName ? `窗外是${neighborhoodName}` : "窗";

  useEffect(() => {
    const resident = self;
    if (!resident) {
      return;
    }
    let cancelled = false;
    setRoomError(false);

    const load = async () => {
      try {
        if (isGuest) {
          if (!residentId) {
            setRoomError(true);
            return;
          }
          const person = await fetchResident(residentId);
          if (cancelled) {
            return;
          }
          setHost(person);
          setHostNeighborhoodId(person.homeNeighborhoodId);
          if (person.homeNeighborhoodId) {
            const view = await fetchNeighborhood(person.homeNeighborhoodId);
            if (!cancelled) {
              setNeighborhoodName(view.neighborhood.name);
            }
          }
          return;
        }
        if (resident.homeNeighborhoodId) {
          const view = await fetchNeighborhood(resident.homeNeighborhoodId);
          if (!cancelled) {
            setNeighborhoodName(view.neighborhood.name);
            setHostNeighborhoodId(resident.homeNeighborhoodId);
          }
        }
      } catch {
        if (!cancelled) {
          setRoomError(true);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [isGuest, residentId, self, reloadToken]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function openOverlay(next: Overlay) {
    setOverlay(next);
  }

  function onComputer() {
    // t=0: open UI immediately; any character lerp must not gate this.
    if (isGuest) {
      if (host) {
        openOverlay("bookshelf");
      }
      return;
    }
    openOverlay("composer");
  }

  function onDoor() {
    if (isGuest && hostNeighborhoodId) {
      navigate(`/n/${hostNeighborhoodId}`);
      return;
    }
    navigate("/street");
  }

  function onBookshelf() {
    if (isGuest && !host) {
      return;
    }
    openOverlay("bookshelf");
  }

  function onCushion() {
    if (hasCompanion) {
      openOverlay("chat");
      return;
    }
    openOverlay("teaser");
  }

  function onPublished() {
    setOverlay(null);
    setToast("已经贴在房顶上了。出门就能看见。");
    setComputerFlash(true);
    window.setTimeout(() => setComputerFlash(false), 200);
    void refresh();
  }

  function hotspotLabel(id: HotspotId): string {
    if (id === "window") {
      return windowName;
    }
    if (id === "computer" && isGuest) {
      return "看看 Ta 最近写了什么";
    }
    const spot = HOTSPOTS.find((item) => item.id === id);
    return spot?.label ?? id;
  }

  function hotspotHint(id: HotspotId): string {
    switch (id) {
      case "computer":
        return isGuest ? "看看 Ta 最近写了什么" : needsGuide ? "点击电脑写一句话" : "坐下来，写一句今天想说的话";
      case "door":
        return isGuest ? "你是客人。出门回到街上。" : "出门到街上";
      case "bookshelf":
        return "打开书架";
      case "cushion":
        return hasCompanion ? "和豆苗打个招呼" : "以后在这里养一个伙伴";
      case "window":
        return windowName;
    }
  }

  const defaultHint = isGuest
    ? "你是客人。出门回到街上。"
    : needsGuide
      ? "点击电脑写一句话"
      : `缩放 ×${box.scale} · 舞台 ${HOME_LOGICAL_WIDTH}×${HOME_LOGICAL_HEIGHT} · 只使用整数倍`;
  const hint = hintSpot ? hotspotHint(hintSpot) : defaultHint;

  if (!self) {
    return null;
  }

  return (
    <div className={overlay === "composer" ? "pv-scene-column is-composing" : "pv-scene-column"}>
      {roomError ? (
        <p className="pv-banner font-pixel" role="alert">
          房间暂时进不去
          <button
            type="button"
            className="pv-banner__retry"
            onClick={() => setReloadToken((value) => value + 1)}
          >
            重试
          </button>
        </p>
      ) : null}

      <div ref={hostRef} className={overlay === "composer" ? "pv-stage-host is-dim" : "pv-stage-host"}>
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
            {HOTSPOTS.map((spot) => {
              const extra = [
                spot.className,
                spot.id === "computer" && needsGuide ? "is-guide" : "",
                spot.id === "computer" && computerFlash ? "is-flash" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <PixelFocusRing
                  key={spot.id}
                  className={extra}
                  aria-label={hotspotLabel(spot.id)}
                  onFocus={() => setHintSpot(spot.id)}
                  onBlur={() => setHintSpot((current) => (current === spot.id ? null : current))}
                  onMouseEnter={() => setHintSpot(spot.id)}
                  onMouseLeave={() => setHintSpot((current) => (current === spot.id ? null : current))}
                  onClick={() => {
                    if (spot.id === "computer") {
                      onComputer();
                    } else if (spot.id === "door") {
                      onDoor();
                    } else if (spot.id === "bookshelf") {
                      onBookshelf();
                    } else if (spot.id === "cushion") {
                      onCushion();
                    }
                  }}
                >
                  {spot.label}
                </PixelFocusRing>
              );
            })}
          </div>
        </PixelStage>
      </div>

      <p className="pv-hint font-pixel">{hint}</p>

      {overlay === "composer" && !isGuest ? (
        <ComposerDialog residentId={self.id} onClose={() => setOverlay(null)} onPublished={onPublished} />
      ) : null}
      {overlay === "bookshelf" && roomResident ? (
        <BookshelfSheet
          resident={roomResident}
          initialTab="posts"
          onClose={() => setOverlay(null)}
        />
      ) : null}
      {overlay === "chat" ? <ChatPanel peerName="豆苗" onClose={() => setOverlay(null)} /> : null}
      {overlay === "teaser" ? <CompanionTeaser onClose={() => setOverlay(null)} /> : null}

      {toast ? (
        <p className="pv-toast font-pixel" role="status">
          {toast}
        </p>
      ) : null}
    </div>
  );
}
