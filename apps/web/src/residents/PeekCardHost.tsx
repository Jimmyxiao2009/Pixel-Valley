import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ResidentHomeResponse } from "@pixel-valley/domain";
import {
  addNeighborEdge,
  blockResident,
  fetchResidentHome,
  recordVisit,
  removeNeighborEdge,
  unblockResident,
} from "../data/api";
import { ChatPanel } from "../chat/ChatPanel";
import { useResidentConversation } from "../chat/useResidentConversation";
import { pixelFocusClass } from "../pixel/PixelFocusRing";
import { ResidentPeekCard, type PeekAction } from "./ResidentPeekCard";

type PeekCardHostProps = {
  residentId: string;
  /** Canonical street currently on screen, so the card can hide a no-op. */
  currentNeighborhoodId?: string | null;
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
export function PeekCardHost({
  residentId,
  currentNeighborhoodId = null,
  onClose,
  onRelationChanged,
}: PeekCardHostProps) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("loading");
  const [view, setView] = useState<ResidentHomeResponse | null>(null);
  const [pendingNeighbor, setPendingNeighbor] = useState(false);
  const [neighborError, setNeighborError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const conversation = useResidentConversation();

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setNeighborError(null);
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
      if (action.type === "doorstep") {
        // §3.10 / §12.4.2: their canonical street, camera on their real slot.
        navigate(`/n/${action.neighborhoodId}?focusResidentId=${action.residentId}`);
        return;
      }
      // §3.6.3: the panel opens right here, on the real thread. The server
      // decides knock vs note, so the caller passes no `via`.
      void conversation.open(action.residentId);
    },
    [navigate, conversation],
  );

  const onBlockToggle = useCallback(async () => {
    if (!view) {
      return;
    }
    setConfirmBlock(false);
    try {
      if (view.relation.blocking) {
        await unblockResident(view.resident.id);
      } else {
        await blockResident(view.resident.id);
        // A block closes the thread that is open right now, not just later ones.
        conversation.close();
      }
    } finally {
      // Re-read: the gate verdict is the server's to recompute.
      setReloadToken((value) => value + 1);
      onRelationChanged?.();
    }
  }, [view, conversation, onRelationChanged]);

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
        onBlockRequest={() => setConfirmBlock(true)}
        onTheirStreet={
          currentNeighborhoodId !== null &&
          currentNeighborhoodId === view.resident.homeNeighborhoodId
        }
        onClose={onClose}
      />
      {conversation.error ? (
        <p className="peek-card__note font-pixel" role="alert">
          {conversation.error}
        </p>
      ) : null}
      {confirmBlock ? (
        <div
          className="mail__confirm"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="peek-confirm-title"
        >
          <p id="peek-confirm-title" className="font-body">
            {view.relation.blocking
              ? `不再挡住${view.resident.displayName}？`
              : `挡住${view.resident.displayName}？Ta 就不能再敲门或留纸条了。`}
          </p>
          <button
            type="button"
            className={pixelFocusClass("mail__confirm-yes")}
            onClick={() => void onBlockToggle()}
          >
            {view.relation.blocking ? "取消挡住" : "挡住 Ta"}
          </button>
          <button
            type="button"
            className={pixelFocusClass("mail__confirm-no")}
            onClick={() => setConfirmBlock(false)}
          >
            算了
          </button>
        </div>
      ) : null}
      {conversation.opened ? (
        <ChatPanel
          conversationId={conversation.opened.conversationId}
          peer={{
            id: view.resident.id,
            displayName: view.resident.displayName,
            handle: view.resident.handle,
            kind: view.resident.kind,
            aiRole: view.resident.aiRole,
            observerPresence: view.resident.observerPresence,
          }}
          skin={conversation.opened.skin}
          blocking={view.relation.blocking}
          blockedBy={view.relation.blockedBy}
          onClose={conversation.close}
        />
      ) : null}
    </>
  );
}
