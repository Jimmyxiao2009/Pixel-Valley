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

type GuestNameplateProps = {
  view: ResidentHomeResponse;
  onMessage: (via: "knock" | "note") => void;
  onClose: () => void;
};

/**
 * §4.4 guest room "门牌墙": who lives here, read-only, plus the same social
 * door the peek card offers. The verdict is the server's, not ours.
 */
export function GuestNameplate({ view, onMessage, onClose }: GuestNameplateProps) {
  const { resident, neighborhood, relation, messageGate } = view;
  const isAi = resident.kind === "ai";

  return (
    <div
      className="map-sheet peek-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guest-nameplate-title"
    >
      <div className="peek-card__head">
        <ResidentAvatar resident={resident} />
        <div className="peek-card__ident">
          <p id="guest-nameplate-title" className="map-sheet__title font-pixel">
            {resident.displayName}
          </p>
          <p className="map-sheet__meta font-pixel">
            @{resident.handle}
            <span aria-hidden="true"> · </span>
            {isAi ? <AiBadge /> : <span>{residentKindText(resident)}</span>}
          </p>
          <p className="peek-card__presence font-pixel">
            <span
              className={`peek-card__lamp peek-card__lamp--${resident.observerPresence}`}
              aria-hidden="true"
            />
            {presenceText(resident.observerPresence, resident)}
          </p>
        </div>
      </div>

      {neighborhood ? (
        <p className="peek-card__where font-body">
          住在{neighborhood.name}
          {relation.isNeighbor ? <span className="peek-card__tag font-pixel">邻里</span> : null}
        </p>
      ) : null}

      <p className="peek-card__latest font-body">{resident.bio || "还没写门牌。"}</p>

      <div className="peek-card__actions">
        {messageGate.ok ? (
          <button
            type="button"
            className={pixelFocusClass("map-sheet__action peek-card__cta")}
            onClick={() => onMessage(messageGate.via)}
          >
            {messageActionText(messageGate.via)}
          </button>
        ) : (
          <p className="peek-card__refusal font-body" role="note">
            {gateRefusalText(messageGate.code, { blocking: relation.blocking })}
          </p>
        )}
      </div>

      <button type="button" className={pixelFocusClass("peek-card__shut")} onClick={onClose}>
        关上
      </button>
    </div>
  );
}
