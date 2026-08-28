import { useCallback, useEffect, useRef, useState } from "react";
import { sendRefusalText, type GateDenialCode, type Message } from "@pixel-valley/domain";
import {
  ApiError,
  fetchConversationMessages,
  sendConversationMessage,
  setConversationFocus,
} from "../data/api";

type Status = "loading" | "ready" | "error";

const GATE_CODES = new Set(["blocked", "forbidden", "dnd"]);

function isGateCode(code: string): code is GateDenialCode {
  return GATE_CODES.has(code);
}

export type ConversationState = {
  status: Status;
  messages: Message[];
  sending: boolean;
  sendError: string | null;
  send: (content: string) => Promise<boolean>;
  reload: () => void;
};

/**
 * Owns one conversation's server state: history, sending, and the §5.2 focus
 * signal. Focus is opened on mount and closed on unmount / id change, so the
 * server never keeps believing a resident is still reading a thread they left.
 */
export function useConversation(
  conversationId: string | null,
  options: { blocking?: boolean; onRead?: () => void } = {},
): ConversationState {
  const [status, setStatus] = useState<Status>("loading");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const blockingRef = useRef(options.blocking ?? false);
  blockingRef.current = options.blocking ?? false;
  const onReadRef = useRef(options.onRead);
  onReadRef.current = options.onRead;

  useEffect(() => {
    if (!conversationId) {
      setStatus("ready");
      setMessages([]);
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setSendError(null);
    // Reading marks the thread read server-side; unread truth stays there.
    void fetchConversationMessages(conversationId)
      .then((payload) => {
        if (!cancelled) {
          setMessages(payload.messages);
          setStatus("ready");
          // The GET marked the thread read server-side; let the shell re-read
          // the unread total instead of guessing at it.
          onReadRef.current?.();
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
  }, [conversationId, reloadToken]);

  useEffect(() => {
    if (!conversationId) {
      return;
    }
    void setConversationFocus(conversationId, true).catch(() => {});
    return () => {
      // Fire-and-forget: leaving must not be blocked by the network, but the
      // server must still learn the panel closed.
      void setConversationFocus(conversationId, false).catch(() => {});
    };
  }, [conversationId]);

  const send = useCallback(
    async (content: string): Promise<boolean> => {
      const trimmed = content.trim();
      if (!conversationId || trimmed.length === 0 || sending) {
        return false;
      }
      setSending(true);
      setSendError(null);
      try {
        const message = await sendConversationMessage(conversationId, trimmed);
        // Append what the server stored, never what we typed.
        setMessages((current) => [...current, message]);
        return true;
      } catch (error) {
        if (error instanceof ApiError && isGateCode(error.code)) {
          setSendError(sendRefusalText(error.code, { blocking: blockingRef.current }));
        } else if (error instanceof ApiError && error.code === "rate_limited") {
          setSendError("说得太快了，喘口气再说。");
        } else {
          setSendError("这句话没送出去。再试一次。");
        }
        return false;
      } finally {
        setSending(false);
      }
    },
    [conversationId, sending],
  );

  return {
    status,
    messages,
    sending,
    sendError,
    send,
    reload: () => setReloadToken((value) => value + 1),
  };
}
