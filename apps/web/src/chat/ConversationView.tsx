import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  presenceText,
  residentKindText,
  type AiRole,
  type Message,
  type Presence,
} from "@pixel-valley/domain";
import { AiBadge } from "../ai/AiBadge";
import { pixelFocusClass } from "../pixel/PixelFocusRing";
import { ResidentAvatar } from "../residents/ResidentAvatar";
import { useConversation } from "./useConversation";

const MESSAGE_MAX = 2000;

export type ConversationPeer = {
  id: string;
  displayName: string;
  handle: string;
  kind: "human" | "ai";
  aiRole?: AiRole | null;
  observerPresence: Presence;
};

export type ConversationSkin = "knock" | "note";

type ConversationViewProps = {
  conversationId: string;
  peer: ConversationPeer;
  /** §4.6: chosen when the panel opens and frozen; presence changes only warn. */
  skin: ConversationSkin;
  blocking?: boolean;
  blockedBy?: boolean;
  onBlockToggle?: () => void;
  onClose?: () => void;
  closeLabel?: string;
};

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function dayLabel(iso: string, today: string): string {
  const key = dayKey(iso);
  if (key === today) {
    return "今天";
  }
  const yesterday = new Date(Date.parse(`${today}T00:00:00.000Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);
  return key === yesterday ? "昨天" : key;
}

export function ConversationView({
  conversationId,
  peer,
  skin,
  blocking = false,
  blockedBy = false,
  onBlockToggle,
  onClose,
  closeLabel = "关上",
}: ConversationViewProps) {
  const { status, messages, sending, sendError, send } = useConversation(conversationId, {
    blocking,
  });
  const [input, setInput] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const inputId = `conversation-input-${conversationId}`;
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    setInput("");
    setMenuOpen(false);
  }, [conversationId]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages.length]);

  // The server is the gate; this only avoids offering an action that must fail.
  const sendingShut = blocking || blockedBy;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const ok = await send(input);
    if (ok) {
      // Only clear once the server stored it, so a refusal keeps the words.
      setInput("");
    }
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit(event as unknown as FormEvent);
    }
  }

  let previousDay = "";

  return (
    <section className="conversation" aria-label={`与${peer.displayName}的对话`}>
      <header className="conversation__head">
        <ResidentAvatar resident={{ ...peer, avatarSprite: peer.id }} size={32} />
        <div className="conversation__who">
          <p className="conversation__name font-pixel">
            {skin === "knock" ? `在${peer.displayName}家做客` : `给${peer.displayName}留一张纸条`}
            {peer.kind === "ai" ? <AiBadge /> : null}
          </p>
          <p className="conversation__presence font-pixel">
            {presenceText(peer.observerPresence, { kind: peer.kind, aiRole: peer.aiRole ?? null })}
            {peer.kind === "ai" ? (
              <span aria-hidden="true"> · </span>
            ) : null}
            {peer.kind === "ai" ? <span>{residentKindText({ kind: peer.kind, aiRole: peer.aiRole ?? null })}</span> : null}
          </p>
        </div>
        {onBlockToggle ? (
          <div className="conversation__menu">
            <button
              type="button"
              className={pixelFocusClass("conversation__menu-btn")}
              aria-expanded={menuOpen}
              aria-haspopup="true"
              onClick={() => setMenuOpen((open) => !open)}
            >
              更多
            </button>
            {menuOpen ? (
              <button
                type="button"
                className={pixelFocusClass("conversation__menu-item")}
                onClick={() => {
                  setMenuOpen(false);
                  onBlockToggle();
                }}
              >
                {blocking ? "取消挡住" : "挡住 Ta"}
              </button>
            ) : null}
          </div>
        ) : null}
        {onClose ? (
          <button
            type="button"
            className={pixelFocusClass("conversation__close")}
            onClick={onClose}
          >
            {closeLabel}
          </button>
        ) : null}
      </header>

      <div className="conversation__log" ref={logRef} role="log" aria-live="polite">
        {status === "loading" ? (
          <p className="font-body" role="status">
            正在翻开这封信…
          </p>
        ) : status === "error" ? (
          <p className="font-body" role="alert">
            这封信暂时打不开
          </p>
        ) : messages.length === 0 ? (
          <p className="font-body">
            {skin === "knock" ? "门开了，打个招呼吧。" : "Ta 不在家。把话留在门上吧。"}
          </p>
        ) : (
          <ul className="conversation__list">
            {messages.map((message: Message) => {
              const label = dayLabel(message.createdAt, today);
              const showDay = label !== previousDay;
              previousDay = label;
              const mine = message.senderResidentId !== peer.id;
              if (message.via === "system") {
                return (
                  <li key={message.id} className="conversation__system font-pixel">
                    {showDay ? <span className="conversation__day">{label}</span> : null}
                    {message.content}
                  </li>
                );
              }
              return (
                <li
                  key={message.id}
                  className={mine ? "conversation__row conversation__row--mine" : "conversation__row"}
                >
                  {showDay ? <span className="conversation__day font-pixel">{label}</span> : null}
                  <p className="conversation__bubble font-body">{message.content}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {sendError ? (
        <p className="conversation__error font-body" role="alert">
          {sendError}
        </p>
      ) : null}

      <form className="conversation__form" onSubmit={(event) => void submit(event)}>
        <label className="conversation__field" htmlFor={inputId}>
          <span className="visually-hidden">
            {skin === "knock" ? "说点什么" : "写在纸条上"}
          </span>
          <textarea
            id={inputId}
            className="conversation__input font-body"
            rows={2}
            value={input}
            maxLength={MESSAGE_MAX}
            disabled={sendingShut}
            placeholder={
              sendingShut
                ? blocking
                  ? "你挡住了 Ta。"
                  : "这家谢绝访客。"
                : skin === "knock"
                  ? "进门打个招呼…"
                  : "Ta 不在家。把话留在门上吧。"
            }
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onInputKeyDown}
          />
        </label>
        <button
          type="submit"
          className={pixelFocusClass("conversation__send")}
          disabled={sendingShut || sending || input.trim().length === 0}
        >
          {sending ? "正在送出…" : skin === "knock" ? "说出去" : "夹进门缝"}
        </button>
      </form>
    </section>
  );
}
