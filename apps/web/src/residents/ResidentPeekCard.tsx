import { useEffect, useRef, useState } from "react";
import {
  gateRefusalText,
  messageActionText,
  presenceText,
  residentKindText,
  type ResidentHomeResponse,
} from "@pixel-valley/domain";
import { AiBadge } from "../ai/AiBadge";
import { pixelFocusClass } from "../pixel/PixelFocusRing";
import { ResidentAvatar } from "./ResidentAvatar";

export type PeekAction =
  | { type: "enter"; residentId: string; isSelf: boolean }
  | { type: "message"; residentId: string; via: "knock" | "note" };

type ResidentPeekCardProps = {
  view: ResidentHomeResponse;
  /** null while the relation write is in flight, so the button can say so. */
  pendingNeighbor: boolean;
  neighborError: string | null;
  onAction: (action: PeekAction) => void;
  onToggleNeighbor: () => void;
  onBlockRequest?: () => void;
  onClose: () => void;
};

export function ResidentPeekCard({
  view,
  pendingNeighbor,
  neighborError,
  onAction,
  onToggleNeighbor,
  onBlockRequest,
  onClose,
}: ResidentPeekCardProps) {
  const { resident, relation, neighborhood, latestBubble, messageGate } = view;
  const cardRef = useRef<HTMLDivElement>(null);
  const [dwelt, setDwelt] = useState(false);

  useEffect(() => {
    // Move focus into the card so keyboard users land on the CTAs, not behind them.
    const first = cardRef.current?.querySelector<HTMLElement>("button:not([disabled])");
    first?.focus();
  }, [resident.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDwelt(true), 5000);
    return () => window.clearTimeout(timer);
  }, [resident.id]);

  const isAi = resident.kind === "ai";
  const isSelf = relation.isSelf;
  const blockedEitherWay = relation.blocking || relation.blockedBy;
  const identity = residentKindText(resident);
  const presence = presenceText(resident.observerPresence, resident);
  const interests = resident.interests.slice(0, 3);

  return (
    <div
      ref={cardRef}
      className="map-sheet peek-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="peek-title"
      data-dwelt={dwelt ? "true" : undefined}
    >
      <div className="peek-card__head">
        <ResidentAvatar resident={resident} />
        <div className="peek-card__ident">
          <p id="peek-title" className="map-sheet__title font-pixel">
            {resident.displayName}
          </p>
          <p className="map-sheet__meta font-pixel">
            @{resident.handle}
            <span aria-hidden="true"> · </span>
            {isAi ? <AiBadge /> : <span>{identity}</span>}
            {isAi && identity !== "AI 居民" ? (
              <span className="peek-card__role"> · {identity.replace("AI 居民 · ", "")}</span>
            ) : null}
          </p>
          <p className="peek-card__presence font-pixel">
            <span className={`peek-card__lamp peek-card__lamp--${resident.observerPresence}`} aria-hidden="true" />
            {presence}
          </p>
        </div>
      </div>

      {neighborhood ? (
        <p className="peek-card__where font-body">
          住在{neighborhood.name}
          {relation.isNeighbor ? <span className="peek-card__tag font-pixel">邻里</span> : null}
        </p>
      ) : null}

      {interests.length > 0 ? (
        <ul className="peek-card__interests" aria-label="兴趣">
          {interests.map((interest) => (
            <li key={interest} className="peek-card__interest font-pixel">
              {interest}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="peek-card__latest font-body">
        {latestBubble ? `「${latestBubble.excerpt}」` : "最近没在房顶上说话。"}
      </p>

      {neighborError ? (
        <p className="peek-card__error font-body" role="alert">
          {neighborError}
        </p>
      ) : null}

      <div className="peek-card__actions">
        <button
          type="button"
          className={pixelFocusClass("map-sheet__close peek-card__cta")}
          onClick={() => onAction({ type: "enter", residentId: resident.id, isSelf })}
        >
          进屋坐坐
        </button>

        {isSelf ? (
          <p className="peek-card__refusal font-body" role="note">
            这是你自己的家
          </p>
        ) : messageGate.ok ? (
          <button
            type="button"
            className={pixelFocusClass("map-sheet__action peek-card__cta")}
            onClick={() =>
              onAction({ type: "message", residentId: resident.id, via: messageGate.via })
            }
          >
            {messageActionText(messageGate.via)}
          </button>
        ) : (
          <p className="peek-card__refusal font-body" role="note">
            {gateRefusalText(messageGate.code, { blocking: relation.blocking })}
          </p>
        )}

        {!isAi && !isSelf && !blockedEitherWay ? (
          <button
            type="button"
            className={pixelFocusClass("map-sheet__action peek-card__cta")}
            onClick={onToggleNeighbor}
            disabled={pendingNeighbor}
            aria-disabled={pendingNeighbor}
          >
            {pendingNeighbor
              ? "正在换门牌…"
              : relation.isNeighbor
                ? "搬离邻里关系"
                : "结为邻里"}
          </button>
        ) : null}
      </div>

      <div className="peek-card__secondary">
        {onBlockRequest && !isSelf && !isAi ? (
          <button
            type="button"
            className={pixelFocusClass("peek-card__minor")}
            onClick={onBlockRequest}
          >
            {relation.blocking ? "取消挡住" : "挡住 Ta"}
          </button>
        ) : null}
        <button type="button" className={pixelFocusClass("peek-card__shut")} onClick={onClose}>
          关门
        </button>
      </div>
    </div>
  );
}
