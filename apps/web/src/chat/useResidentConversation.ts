import { useCallback, useState } from "react";
import { ApiError, openConversation } from "../data/api";
import type { ConversationSkin } from "./ConversationView";

export type OpenedConversation = {
  conversationId: string;
  skin: ConversationSkin;
};

export type ResidentConversationEntry = {
  opened: OpenedConversation | null;
  opening: boolean;
  error: string | null;
  /** Knock, note, visitor room, companion cushion — all land here. */
  open: (residentId: string) => Promise<OpenedConversation | null>;
  close: () => void;
};

/**
 * The single door into a conversation. §3.6 / §3.7 / KD-9: knocking and
 * leaving a note are one thread, and the server decides which it is, so no
 * caller passes `via` and no caller creates its own entry logic.
 */
export function useResidentConversation(): ResidentConversationEntry {
  const [opened, setOpened] = useState<OpenedConversation | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(async (residentId: string) => {
    setOpening(true);
    setError(null);
    try {
      const result = await openConversation(residentId);
      const next: OpenedConversation = {
        conversationId: result.conversation.id,
        // Skin is frozen at open time (§4.6); presence may change later.
        skin: result.via,
      };
      setOpened(next);
      return next;
    } catch (caught) {
      // A refused gate must not leave a chat window standing open.
      setError(
        caught instanceof ApiError && caught.code === "blocked"
          ? "这扇门关着。"
          : caught instanceof ApiError && caught.code === "dnd"
            ? "门口挂了牌子，先留纸条。"
            : caught instanceof ApiError && caught.code === "forbidden"
              ? "这家谢绝访客。"
              : "这扇门暂时敲不开。",
      );
      setOpened(null);
      return null;
    } finally {
      setOpening(false);
    }
  }, []);

  const close = useCallback(() => {
    setOpened(null);
    setError(null);
  }, []);

  return { opened, opening, error, open, close };
}
