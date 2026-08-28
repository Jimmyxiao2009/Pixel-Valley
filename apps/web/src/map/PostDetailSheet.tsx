import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  presenceText,
  relativeTime,
  REPLY_CONTENT_MAX,
  validateReply,
  type AiRole,
  type Presence,
  type PostDetailResponse,
} from "@pixel-valley/domain";
import { AiBadge } from "../ai/AiBadge";
import { createReply, fetchPost, reactToPost } from "../data/api";
import { pixelFocusClass } from "../pixel/PixelFocusRing";
import { PeekCardHost } from "../residents/PeekCardHost";
import { ResidentAvatar } from "../residents/ResidentAvatar";

type PostDetailSheetProps = {
  postId: string;
  /** Shown while the full text loads, so the sheet is never blank at t=0. */
  excerpt: string;
  authorName: string;
  count24h: number;
  onClose: () => void;
};

type Status = "loading" | "ready" | "error";

type LineAuthor = {
  id: string;
  displayName: string;
  handle: string;
  kind: "human" | "ai";
  aiRole: AiRole | null;
  observerPresence: Presence;
};

function AuthorLine({ author, onOpen }: { author: LineAuthor; onOpen: () => void }) {
  const isAi = author.kind === "ai";
  return (
    <button
      type="button"
      className={pixelFocusClass("post-detail__author")}
      aria-label={`${author.displayName}，${isAi ? "AI 居民" : "人类居民"}`}
      onClick={onOpen}
    >
      <ResidentAvatar resident={{ ...author, avatarSprite: author.id }} size={32} />
      <span className="post-detail__nameplate">
        <span className="post-detail__name font-pixel">
          {author.displayName}
          {isAi ? <AiBadge /> : null}
        </span>
        <span className="post-detail__handle font-pixel">
          @{author.handle}
          <span aria-hidden="true"> · </span>
          {presenceText(author.observerPresence, { kind: author.kind, aiRole: author.aiRole })}
        </span>
      </span>
    </button>
  );
}

/**
 * §4.11: the one post detail in the product. The town feed, roof bubbles and
 * resident post lists all open this same sheet.
 */
export function PostDetailSheet({
  postId,
  excerpt,
  authorName,
  count24h,
  onClose,
}: PostDetailSheetProps) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("loading");
  const [detail, setDetail] = useState<PostDetailResponse | null>(null);
  const [reload, setReload] = useState(0);
  const [reacting, setReacting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [replying, setReplying] = useState(false);
  const [replyNote, setReplyNote] = useState<string | null>(null);
  const [peekResidentId, setPeekResidentId] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);
  const now = new Date();
  const replyInputId = `reply-input-${postId}`;

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const token = ++requestRef.current;
      setStatus("loading");
      try {
        const payload = await fetchPost(postId, { signal });
        // A slower post that resolves after the reader moved on is dropped.
        if (token !== requestRef.current) {
          return;
        }
        setDetail(payload);
        setStatus("ready");
      } catch {
        if (token === requestRef.current) {
          setStatus("error");
        }
      }
    },
    [postId],
  );

  useEffect(() => {
    const controller = new AbortController();
    setDraft("");
    setActionError(null);
    setReplyNote(null);
    setPeekResidentId(null);
    void load(controller.signal);
    return () => controller.abort();
  }, [load, reload]);

  useEffect(() => {
    // Land inside the sheet so the keyboard is not left behind it.
    sheetRef.current?.querySelector<HTMLElement>("button:not([disabled])")?.focus();
  }, [postId]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") {
      return;
    }
    // Only the topmost layer closes.
    event.stopPropagation();
    if (peekResidentId) {
      setPeekResidentId(null);
      return;
    }
    onClose();
  }

  async function onReact() {
    if (!detail || reacting || detail.reacted) {
      return;
    }
    setReacting(true);
    setActionError(null);
    try {
      await reactToPost(postId);
      // Counts are the server's to derive; re-read rather than increment here.
      await load();
    } catch {
      setActionError("这一下没拍上。再试一次。");
    } finally {
      setReacting(false);
    }
  }

  async function onReply(event: FormEvent) {
    event.preventDefault();
    const valid = validateReply(draft);
    if (!valid.ok) {
      setActionError(valid.message);
      return;
    }
    if (replying) {
      return;
    }
    setReplying(true);
    setActionError(null);
    try {
      await createReply(postId, valid.content);
      await load();
      // Only clear once the server stored it, so a refusal keeps the words.
      setDraft("");
      setReplyNote("回复贴上去了。");
    } catch {
      setActionError("这句回复没送出去。再试一次。");
    } finally {
      setReplying(false);
    }
  }

  const post = detail?.post ?? null;
  const author = detail?.author ?? null;
  const replies = detail?.replies ?? [];
  const draftLength = Array.from(draft.trim()).length;

  return (
    <div
      ref={sheetRef}
      className="map-sheet post-detail"
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-title"
      onKeyDown={onKeyDown}
    >
      <header className="post-detail__head">
        {author ? (
          <>
            <span id="post-title" className="visually-hidden">
              {author.displayName}的帖子
            </span>
            <AuthorLine
              author={{
                id: author.id,
                displayName: author.displayName,
                handle: author.handle,
                kind: author.kind,
                aiRole: author.aiRole,
                observerPresence: author.observerPresence,
              }}
              onOpen={() => setPeekResidentId(author.id)}
            />
          </>
        ) : (
          <p id="post-title" className="map-sheet__title font-pixel">
            {authorName}
          </p>
        )}
        <button type="button" className={pixelFocusClass("post-detail__close")} onClick={onClose}>
          关门
        </button>
      </header>

      {status === "loading" ? (
        <div role="status" aria-live="polite">
          <p className="map-sheet__meta font-pixel">正在把这页翻开…</p>
          <p className="map-sheet__body font-body">{excerpt}</p>
        </div>
      ) : status === "error" || !post ? (
        <div role="alert">
          <p className="map-sheet__body font-body">这条帖子现在读不到了。</p>
          <button
            type="button"
            className={pixelFocusClass("map-sheet__action")}
            onClick={() => setReload((value) => value + 1)}
          >
            再试一次
          </button>
        </div>
      ) : (
        <>
          <p className="post-detail__meta font-pixel">
            <time dateTime={post.createdAt}>{relativeTime(post.createdAt, now)}</time>
            {post.tags.length > 0 ? <span className="post-detail__tag">{post.tags[0]}</span> : null}
            {count24h >= 2 ? <span>最近 {count24h} 条</span> : null}
          </p>

          <p className="map-sheet__body font-body">{post.content}</p>

          <div className="post-detail__actions">
            <button
              type="button"
              className={pixelFocusClass("post-detail__react")}
              aria-label={
                detail?.reacted
                  ? `已经拍过了，共 ${post.reactionCount} 人拍过`
                  : `拍一拍，已有 ${post.reactionCount} 人拍过`
              }
              aria-pressed={detail?.reacted}
              disabled={reacting || detail?.reacted}
              onClick={() => void onReact()}
            >
              {detail?.reacted ? "已拍过" : reacting ? "正在拍…" : "拍一拍"}
              <span className="post-detail__count">{post.reactionCount}</span>
            </button>

            {author?.homeNeighborhoodId ? (
              <button
                type="button"
                className={pixelFocusClass("map-sheet__action post-detail__doorstep")}
                onClick={() =>
                  navigate(`/n/${author.homeNeighborhoodId}?focusResidentId=${author.id}`)
                }
              >
                去作者家门口
              </button>
            ) : null}
          </div>

          {actionError ? (
            <p className="post-detail__error font-body" role="alert">
              {actionError}
            </p>
          ) : null}
          {replyNote ? (
            <p className="post-detail__note font-body" role="status" aria-live="polite">
              {replyNote}
            </p>
          ) : null}

          <section className="post-detail__replies" aria-label={`回复，共 ${replies.length} 条`}>
            <h3 className="post-detail__replies-title font-pixel">
              {replies.length > 0 ? `${replies.length} 条回复` : "还没有人接话"}
            </h3>
            {replies.length > 0 ? (
              <ul className="post-detail__reply-list">
                {replies.map((reply) => (
                  <li key={reply.id}>
                    <article
                      className="post-detail__reply"
                      aria-label={`${reply.author?.displayName ?? "住户"}的回复`}
                    >
                      {reply.author ? (
                        <AuthorLine
                          author={{
                            id: reply.author.id,
                            displayName: reply.author.displayName,
                            handle: reply.author.handle,
                            kind: reply.author.kind,
                            aiRole: reply.author.aiRole,
                            observerPresence: reply.author.observerPresence,
                          }}
                          onOpen={() => setPeekResidentId(reply.author!.id)}
                        />
                      ) : (
                        <p className="post-detail__name font-pixel">住户</p>
                      )}
                      <p className="post-detail__reply-body font-body">{reply.content}</p>
                      <p className="post-detail__reply-time font-pixel">
                        <time dateTime={reply.createdAt}>{relativeTime(reply.createdAt, now)}</time>
                      </p>
                    </article>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <form className="post-detail__form" onSubmit={(event) => void onReply(event)}>
            <label className="post-detail__field" htmlFor={replyInputId}>
              <span className="visually-hidden">回一句</span>
              <textarea
                id={replyInputId}
                className="post-detail__input font-body"
                rows={2}
                value={draft}
                maxLength={REPLY_CONTENT_MAX}
                placeholder="回一句…"
                aria-describedby={`${replyInputId}-count`}
                onChange={(event) => setDraft(event.target.value)}
              />
            </label>
            <p id={`${replyInputId}-count`} className="post-detail__count-hint font-pixel">
              {draftLength}/{REPLY_CONTENT_MAX}
            </p>
            <button
              type="submit"
              className={pixelFocusClass("post-detail__send")}
              disabled={replying || draftLength === 0}
            >
              {replying ? "正在接话…" : "接一句"}
            </button>
          </form>
        </>
      )}

      {peekResidentId ? (
        <div className="post-detail__peek">
          <PeekCardHost residentId={peekResidentId} onClose={() => setPeekResidentId(null)} />
        </div>
      ) : null}
    </div>
  );
}
