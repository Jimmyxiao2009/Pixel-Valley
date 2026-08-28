import { useCallback, useEffect, useRef, useState } from "react";
import type { ClosedTag, FeedPost } from "@pixel-valley/domain";
import { fetchTownZone, type TownZoneId } from "../data/api";

type Status = "loading" | "ready" | "error";

export type TownFeedState = {
  status: Status;
  items: FeedPost[];
  pinned: FeedPost[];
  topics: { tag: ClosedTag; count24h: number }[];
  writingCount: number;
  nextCursor: string | null;
  loadingMore: boolean;
  moreError: boolean;
  loadMore: () => void;
  retry: () => void;
};

function dedupe(existing: readonly FeedPost[], incoming: readonly FeedPost[]): FeedPost[] {
  const seen = new Set(existing.map((post) => post.id));
  return [...existing, ...incoming.filter((post) => !seen.has(post.id))];
}

/**
 * One zone's feed. Every request carries a token: a slow /plaza that resolves
 * after the resident has moved to /cafe is dropped instead of overwriting the
 * cafe, and switching zone resets the cursor and the list.
 */
export function useTownFeed(zone: TownZoneId, sort: string | undefined): TownFeedState {
  const [status, setStatus] = useState<Status>("loading");
  const [items, setItems] = useState<FeedPost[]>([]);
  const [pinned, setPinned] = useState<FeedPost[]>([]);
  const [topics, setTopics] = useState<{ tag: ClosedTag; count24h: number }[]>([]);
  const [writingCount, setWritingCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const requestRef = useRef(0);

  useEffect(() => {
    const token = ++requestRef.current;
    const controller = new AbortController();
    setStatus("loading");
    setMoreError(false);

    void fetchTownZone(zone, { sort, signal: controller.signal })
      .then((payload) => {
        // A stale zone's answer never lands.
        if (token !== requestRef.current) {
          return;
        }
        if (zone === "board") {
          const board = payload as Awaited<ReturnType<typeof fetchTownZone<"board">>>;
          setPinned(board.pinned);
          setTopics(board.topics);
          setItems(board.latest.items);
          setNextCursor(board.latest.nextCursor);
          setWritingCount(0);
        } else {
          const page = payload as { items: FeedPost[]; nextCursor: string | null; writingCount?: number };
          setPinned([]);
          setTopics([]);
          setItems(page.items);
          setNextCursor(page.nextCursor);
          setWritingCount(page.writingCount ?? 0);
        }
        setStatus("ready");
      })
      .catch(() => {
        if (token === requestRef.current) {
          setStatus("error");
        }
      });

    return () => {
      controller.abort();
    };
  }, [zone, sort, retryToken]);

  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMore) {
      return;
    }
    const token = requestRef.current;
    setLoadingMore(true);
    setMoreError(false);
    void fetchTownZone(zone, { sort, cursor: nextCursor })
      .then((payload) => {
        if (token !== requestRef.current) {
          return;
        }
        const page =
          zone === "board"
            ? (payload as Awaited<ReturnType<typeof fetchTownZone<"board">>>).latest
            : (payload as { items: FeedPost[]; nextCursor: string | null });
        // Append, deduped, order preserved.
        setItems((current) => dedupe(current, page.items));
        setNextCursor(page.nextCursor);
      })
      .catch(() => {
        if (token === requestRef.current) {
          // Keep whatever is already on screen.
          setMoreError(true);
        }
      })
      .finally(() => {
        if (token === requestRef.current) {
          setLoadingMore(false);
        }
      });
  }, [zone, sort, nextCursor, loadingMore]);

  return {
    status,
    items,
    pinned,
    topics,
    writingCount,
    nextCursor,
    loadingMore,
    moreError,
    loadMore,
    retry: () => setRetryToken((value) => value + 1),
  };
}
