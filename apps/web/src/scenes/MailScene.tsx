import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ConversationListItem } from "@pixel-valley/domain";
import { ConversationView, type ConversationPeer } from "../chat/ConversationView";
import { blockResident, fetchConversations, fetchResidentHome, unblockResident } from "../data/api";
import { pixelFocusClass } from "../pixel/PixelFocusRing";
import { ResidentAvatar } from "../residents/ResidentAvatar";
import { AiBadge } from "../ai/AiBadge";

type Status = "loading" | "ready" | "error";

type Relation = { blocking: boolean; blockedBy: boolean };

function relativeDay(iso: string, today: string): string {
  const key = iso.slice(0, 10);
  if (key === today) {
    return iso.slice(11, 16);
  }
  const yesterday = new Date(Date.parse(`${today}T00:00:00.000Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);
  return key === yesterday ? "昨天" : key.slice(5);
}

/**
 * §4.12: one inbox. Knocks and notes are the same threads, so the list never
 * splits them. Narrow screens swap between list and thread instead of
 * squeezing two columns.
 */
export function MailScene() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("c");
  const [status, setStatus] = useState<Status>("loading");
  const [items, setItems] = useState<ConversationListItem[]>([]);
  const [relation, setRelation] = useState<Relation>({ blocking: false, blockedBy: false });
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const today = new Date().toISOString().slice(0, 10);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    void fetchConversations()
      .then((payload) => {
        if (!cancelled) {
          setItems(payload.items);
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
  }, [reloadToken]);

  const selected = items.find((item) => item.conversation.id === selectedId) ?? null;
  const peerId = selected?.peer.id ?? null;

  // Block state is the server's; re-read whenever the thread or the block changes.
  useEffect(() => {
    if (!peerId) {
      setRelation({ blocking: false, blockedBy: false });
      return;
    }
    let cancelled = false;
    void fetchResidentHome(peerId)
      .then((view) => {
        if (!cancelled) {
          setRelation({ blocking: view.relation.blocking, blockedBy: view.relation.blockedBy });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRelation({ blocking: false, blockedBy: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [peerId, reloadToken]);

  function select(conversationId: string | null) {
    const next = new URLSearchParams(params);
    if (conversationId) {
      next.set("c", conversationId);
    } else {
      next.delete("c");
    }
    setConfirmBlock(false);
    // Replace so reading six letters does not leave six history entries.
    setParams(next, { replace: true });
  }

  async function applyBlockToggle() {
    if (!peerId) {
      return;
    }
    setConfirmBlock(false);
    try {
      if (relation.blocking) {
        await unblockResident(peerId);
      } else {
        await blockResident(peerId);
      }
    } finally {
      // Whatever happened, re-read the server rather than assume.
      reload();
    }
  }

  const peer: ConversationPeer | null = selected
    ? {
        id: selected.peer.id,
        displayName: selected.peer.displayName,
        handle: selected.peer.handle,
        kind: selected.peer.kind,
        observerPresence: selected.peer.observerPresence,
      }
    : null;

  return (
    <div className={selected ? "mail mail--thread-open" : "mail"}>
      <section className="mail__list-pane" aria-label="信箱">
        <h1 className="mail__title font-pixel">信箱</h1>

        {status === "loading" ? (
          <ul className="mail__list" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => (
              <li key={index} className="mail__row mail__row--skeleton" />
            ))}
          </ul>
        ) : status === "error" ? (
          <div role="alert">
            <p className="font-body">信箱暂时打不开</p>
            <button type="button" className={pixelFocusClass("mail__retry")} onClick={reload}>
              再试一次
            </button>
          </div>
        ) : items.length === 0 ? (
          <p className="mail__empty font-body">信箱里还没有纸条</p>
        ) : (
          <ul className="mail__list">
            {items.map((item) => {
              const active = item.conversation.id === selectedId;
              return (
                <li key={item.conversation.id}>
                  <button
                    type="button"
                    className={pixelFocusClass(active ? "mail__row is-active" : "mail__row")}
                    aria-current={active ? "true" : undefined}
                    onClick={() => select(item.conversation.id)}
                  >
                    <ResidentAvatar
                      resident={{ ...item.peer, avatarSprite: item.peer.id }}
                      size={32}
                    />
                    <span className="mail__row-body">
                      <span className="mail__row-name font-pixel">
                        {item.peer.displayName}
                        {item.peer.kind === "ai" ? <AiBadge /> : null}
                      </span>
                      <span className="mail__row-preview font-body">
                        {item.conversation.lastMessagePreview || "还没有话"}
                      </span>
                    </span>
                    <span className="mail__row-meta font-pixel">
                      <span>{relativeDay(item.conversation.lastMessageAt, today)}</span>
                      {/* Unread is words, not just a dot. */}
                      {item.unreadCount > 0 ? (
                        <span className="mail__unread">{item.unreadCount} 条未读</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mail__thread-pane" aria-label="对话">
        {selected && peer ? (
          <>
            <button
              type="button"
              className={pixelFocusClass("mail__back")}
              onClick={() => select(null)}
            >
              回到信箱
            </button>
            <ConversationView
              key={selected.conversation.id}
              conversationId={selected.conversation.id}
              peer={peer}
              skin={peer.observerPresence === "offline" ? "note" : "knock"}
              blocking={relation.blocking}
              blockedBy={relation.blockedBy}
              onBlockToggle={() => setConfirmBlock(true)}
            />
            {confirmBlock ? (
              <div
                className="mail__confirm"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="mail-confirm-title"
              >
                <p id="mail-confirm-title" className="font-body">
                  {relation.blocking
                    ? `不再挡住${peer.displayName}？`
                    : `挡住${peer.displayName}？Ta 就不能再敲门或留纸条了。`}
                </p>
                <button
                  type="button"
                  className={pixelFocusClass("mail__confirm-yes")}
                  onClick={() => void applyBlockToggle()}
                >
                  {relation.blocking ? "取消挡住" : "挡住 Ta"}
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
          </>
        ) : (
          <p className="mail__placeholder font-body">挑一封信读读。</p>
        )}
      </section>
    </div>
  );
}
