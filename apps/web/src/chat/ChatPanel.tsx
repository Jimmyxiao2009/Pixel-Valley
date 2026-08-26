import { useState, type FormEvent, type KeyboardEvent } from "react";
import { AiBadge } from "../ai/AiBadge";
import { pixelFocusClass } from "../pixel/PixelFocusRing";

type LocalMessage = {
  id: string;
  from: "me" | "peer";
  content: string;
};

type ChatPanelProps = {
  peerName: string;
  onClose: () => void;
};

const MESSAGE_MAX = 2000;

export function ChatPanel({ peerName, onClose }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<LocalMessage[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
  }

  function send() {
    const content = input.trim();
    if (!content) {
      return;
    }
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), from: "me", content: Array.from(content).slice(0, MESSAGE_MAX).join("") },
    ]);
    setInput("");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    send();
  }

  return (
    <div className="chat-panel" role="dialog" aria-modal="true" aria-labelledby="chat-title" onKeyDown={onKeyDown}>
      <header className="chat-panel__head">
        <h2 id="chat-title" className="font-pixel">
          {peerName} <AiBadge />
        </h2>
        <button type="button" className={pixelFocusClass("pv-sheet-close")} onClick={onClose}>
          关上
        </button>
      </header>

      <div className="chat-panel__log">
        {messages.length === 0 ? (
          <p className="font-body">门开了，打个招呼吧。</p>
        ) : (
          <ul className="chat-log">
            {messages.map((message) => (
              <li
                key={message.id}
                className={message.from === "me" ? "chat-bubble chat-bubble--me" : "chat-bubble"}
              >
                <p className="font-body">{message.content}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form className="chat-panel__form" onSubmit={onSubmit}>
        <label className="chat-panel__input-wrap">
          <span className="visually-hidden">消息</span>
          <textarea
            className="chat-panel__input font-body"
            rows={2}
            value={input}
            maxLength={MESSAGE_MAX}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
          />
        </label>
        <button type="submit" className={pixelFocusClass("chat-panel__send")} disabled={input.trim().length === 0}>
          送出
        </button>
      </form>
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
      <div className="companion-teaser" role="dialog" aria-modal="true" aria-labelledby="companion-teaser-title">
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
