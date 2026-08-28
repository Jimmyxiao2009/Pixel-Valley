import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ResidentHomeResponse } from "@pixel-valley/domain";
import {
  addNeighborEdge,
  fetchResidentHome,
  openConversation,
  recordVisit,
  removeNeighborEdge,
} from "../data/api";
import { pixelFocusClass } from "../pixel/PixelFocusRing";
import { ResidentPeekCard, type PeekAction } from "./ResidentPeekCard";

type PeekCardHostProps = {
  residentId: string;
  onClose: () => void;
  /** Lets the surrounding scene refresh derived layouts after a relation change. */
  onRelationChanged?: () => void;
};

type Status = "loading" | "ready" | "error";

/**
 * §14.2 PeekCard states: loading / ready / blocked / error. "blocked" is not a
 * separate fetch state — the server returns it inside the view as a gate
 * verdict, and the card renders the refusal line.
 */
export function PeekCardHost({ residentId, onClose, onRelationChanged }: PeekCardHostProps) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("loading");
  const [view, setView] = useState<ResidentHomeResponse | null>(null);
  const [pendingNeighbor, setPendingNeighbor] = useState(false);
  const [neighborError, setNeighborError] = useState<string | null>(null);
  const [messageNote, setMessageNote] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setNeighborError(null);
    setMessageNote(null);
    void fetchResidentHome(residentId)
      .then((payload) => {
        if (!cancelled) {
          setView(payload);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [residentId, reloadToken]);

  const onToggleNeighbor = useCallback(async () => {
    if (!view || pendingNeighbor) {
      return;
    }
    const wasNeighbor = view.relation.isNeighbor;
    setPendingNeighbor(true);
    setNeighborError(null);
    try {
      if (wasNeighbor) {
        await removeNeighborEdge(view.resident.id);
      } else {
        await addNeighborEdge(view.resident.id);
      }
      // Re-read rather than assume: the server decides what the relation is now.
      const fresh = await fetchResidentHome(view.resident.id);
      setView(fresh);
      onRelationChanged?.();
    } catch {
      // Never leave a pretend relation behind; the card keeps the old truth.
      setNeighborError(
        wasNeighbor ? "门牌没换下来。再试一次。" : "门牌没挂上去。再试一次。",
      );
    } finally {
      setPendingNeighbor(false);
    }
  }, [view, pendingNeighbor, onRelationChanged]);

  const onAction = useCallback(
    (action: PeekAction) => {
      if (action.type === "enter") {
        // §3.5: your own front door is /home, never a guest room of yourself.
        if (action.isSelf) {
          navigate("/home");
          return;
        }
        // Visits are analytics only, and must not gate the navigation.
        void recordVisit(action.residentId).catch(() => {});
        navigate(`/r/${action.residentId}`);
        return;
      }
      // PR-7 owns the conversation panel; PR-6 only opens the thread so the
      // knock/note actually exists server-side, then points at the mailbox.
      setMessageNote(action.via === "knock" ? "你敲了门。" : "纸条夹进门缝了。");
      void openConversation(action.residentId).catch(() => {
        setMessageNote("这扇门暂时敲不开。");
      });
    },
    [navigate],
  );

  if (status === "loading") {
    return (
      <div className="map-sheet peek-card" role="status" aria-live="polite">
        <p className="map-sheet__meta font-pixel">正在走近…</p>
      </div>
    );
  }

  if (status === "error" || !view) {
    return (
      <div className="map-sheet peek-card" role="alert">
        <p className="map-sheet__meta font-pixel">这家门口暂时靠不近</p>
        <button
          type="button"
          className={pixelFocusClass("map-sheet__close")}
          onClick={() => setReloadToken((value) => value + 1)}
        >
          再试一次
        </button>
        <button type="button" className={pixelFocusClass("peek-card__shut")} onClick={onClose}>
          关门
        </button>
      </div>
    );
  }

  return (
    <>
      <ResidentPeekCard
        view={view}
        pendingNeighbor={pendingNeighbor}
        neighborError={neighborError}
        onAction={onAction}
        onToggleNeighbor={() => void onToggleNeighbor()}
        onClose={onClose}
      />
      {messageNote ? (
        <p className="peek-card__note font-pixel" role="status" aria-live="polite">
          {messageNote}
          <a className={pixelFocusClass("peek-card__note-link")} href="/mail">
            去信箱
          </a>
        </p>
      ) : null}
    </>
  );
}
