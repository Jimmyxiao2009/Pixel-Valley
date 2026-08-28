import { useEffect, useRef, type KeyboardEvent } from "react";
import { pixelFocusClass } from "../pixel/PixelFocusRing";
import {
  ConversationView,
  type ConversationPeer,
  type ConversationSkin,
} from "./ConversationView";

type ChatPanelProps = {
  conversationId: string;
  peer: ConversationPeer;
  skin: ConversationSkin;
  blocking?: boolean;
  blockedBy?: boolean;
  onBlockToggle?: () => void;
  onClose: () => void;
};

/**
 * §4.5 / §4.6: the drawer a knock or a note opens in place. It is only a
 * shell — the thread is the same ConversationView the mailbox renders, against
 * the same server conversation. Nothing here keeps local messages.
 */
export function ChatPanel({
  conversationId,
  peer,
  skin,
  blocking,
  blockedBy,
  onBlockToggle,
  onClose,
}: ChatPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const first = panelRef.current?.querySelector<HTMLElement>(
      "textarea:not([disabled]), button:not([disabled])",
    );
    first?.focus();
  }, [conversationId]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
  }

  return (
    <div
      ref={panelRef}
      className={`chat-panel chat-panel--${skin}`}
      role="dialog"
      aria-modal="true"
      aria-label={`与${peer.displayName}的对话`}
      onKeyDown={onKeyDown}
    >
      <ConversationView
        conversationId={conversationId}
        peer={peer}
        skin={skin}
        blocking={blocking}
        blockedBy={blockedBy}
        onBlockToggle={onBlockToggle}
        onClose={onClose}
        closeLabel="关上"
      />
    </div>
  );
}

export function CompanionTeaser({ onClose }: { onClose: () => void }) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
  }

  return (
    <div className="pv-overlay" onKeyDown={onKeyDown}>
      <div
        className="companion-teaser"
        role="dialog"
        aria-modal="true"
        aria-labelledby="companion-teaser-title"
      >
        <h2 id="companion-teaser-title" className="font-pixel">
          伙伴坐垫
        </h2>
        <p className="font-body">以后在这里养一个伙伴</p>
        <button type="button" className={pixelFocusClass("composer-submit")} onClick={onClose}>
          关上
        </button>
      </div>
    </div>
  );
}
