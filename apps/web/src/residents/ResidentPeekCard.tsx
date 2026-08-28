import { useEffect, useRef, useState } from "react";
import {
  presenceText,
  residentKindText,
  type ResidentHomeResponse,
} from "@pixel-valley/domain";
import { AiBadge } from "../ai/AiBadge";
import { pixelFocusClass } from "../pixel/PixelFocusRing";
import { ResidentAvatar } from "./ResidentAvatar";

export type PeekAction =
  | { type: "enter"; residentId: string }
  | { type: "message"; residentId: string; via: "knock" | "note" };

type ResidentPeekCardProps = {
  view: ResidentHomeResponse;
  /** null while the relation write is in flight, so the button can say so. */
  pendingNeighbor: boolean;
  neighborError: string | null;
  onAction: (action: PeekAction) => void;
  onToggleNeighbor: () => void;
  onClose: () => void;
};

/** §15.4 copy for the door the server opened. */
const MESSAGE_LABEL: Record<"knock" | "note", string> = {
  knock: "敲门",
  note: "留一张纸条",
};

/**
 * §4.4 refusal lines. The client never recomputes the §5.4 matrix — it only
 * renders whichever verdict the server already returned.
 */
const GATE_REFUSAL: Record<"blocked" | "forbidden" | "dnd", string> = {
  blocked: "这家谢绝访客",
  forbidden: "这家谢绝访客",
  dnd: "门口挂了牌子，先留纸条",
};

export function ResidentPeekCard({
  view,
  pendingNeighbor,
  neighborError,
  onAction,
  onToggleNeighbor,
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
          onClick={() => onAction({ type: "enter", residentId: resident.id })}
        >
          进屋坐坐
        </button>

        {messageGate.ok ? (
          <button
            type="button"
            className={pixelFocusClass("map-sheet__action peek-card__cta")}
            onClick={() =>
              onAction({ type: "message", residentId: resident.id, via: messageGate.via })
            }
          >
            {MESSAGE_LABEL[messageGate.via]}
          </button>
        ) : (
          <p className="peek-card__refusal font-body" role="note">
            {relation.blocking ? "你挡住了 Ta" : GATE_REFUSAL[messageGate.code]}
          </p>
        )}

        {!isAi && !blockedEitherWay ? (
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

      <button type="button" className={pixelFocusClass("peek-card__shut")} onClick={onClose}>
        关门
      </button>
    </div>
  );
}
