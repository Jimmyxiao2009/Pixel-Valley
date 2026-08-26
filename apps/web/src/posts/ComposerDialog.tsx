import { useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  CLOSED_TAGS,
  clampPostContent,
  countPlainTextChars,
  isClosedTag,
  POST_CONTENT_MAX,
  type ClosedTag,
  type Post,
} from "@pixel-valley/domain";
import { createPost } from "../data/api";
import { pixelFocusClass } from "../pixel/PixelFocusRing";
import { clearComposerDraft, loadComposerDraft, saveComposerDraft } from "./drafts";

type ComposerDialogProps = {
  residentId: string;
  onClose: () => void;
  onPublished: (post: Post) => void;
};

export function ComposerDialog({ residentId, onClose, onPublished }: ComposerDialogProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initial = loadComposerDraft(residentId);
  const [content, setContent] = useState(initial.content);
  const [tag, setTag] = useState<ClosedTag | null>(initial.tag);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const charCount = countPlainTextChars(content);
  const empty = countPlainTextChars(content.trim()) < 1;
  const cannotSubmit = empty || publishing;

  function persist(nextContent: string, nextTag: ClosedTag | null) {
    saveComposerDraft(residentId, { content: nextContent, tag: nextTag });
  }

  function closeAndKeepDraft() {
    persist(content, tag);
    onClose();
  }

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (cannotSubmit) {
      return;
    }
    persist(content, tag);
    setPublishing(true);
    setError(null);
    try {
      const post = await createPost({ content, tag });
      clearComposerDraft(residentId);
      onPublished(post);
    } catch {
      persist(content, tag);
      setError("这次没贴上去。草稿还在。");
      setPublishing(false);
      textareaRef.current?.focus();
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      if (!publishing) {
        closeAndKeepDraft();
      }
    }
  }

  return (
    <div className="pv-overlay" onKeyDown={onKeyDown}>
      <div
        className="composer-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="composer-title"
      >
        <h2 id="composer-title" className="font-pixel">
          家里的电脑
        </h2>
        <form onSubmit={(event) => void publish(event)}>
          <label className="composer-field">
            <span className="visually-hidden">正文</span>
            <textarea
              ref={textareaRef}
              className="composer-textarea font-body"
              rows={4}
              value={content}
              placeholder="坐下来，写一句今天想说的话…"
              onChange={(event) => {
                const next = clampPostContent(event.target.value);
                setContent(next);
                persist(next, tag);
              }}
            />
          </label>

          <label className="composer-tag font-body" htmlFor="composer-tag">
            给镇上的公告栏选个路牌（可不选）
            <select
              id="composer-tag"
              className="composer-tag__select font-pixel"
              value={tag ?? ""}
              onChange={(event) => {
                const next = isClosedTag(event.target.value) ? event.target.value : null;
                setTag(next);
                persist(content, next);
              }}
            >
              <option value="">可不选</option>
              {CLOSED_TAGS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <p className="composer-meta font-pixel">
            字数 {charCount}/{POST_CONTENT_MAX}
            <span aria-hidden="true"> · </span>
            公开 · 房顶
          </p>

          {error ? (
            <p className="composer-error font-body" role="alert">
              {error}
            </p>
          ) : null}

          <div className="composer-actions">
            <button
              type="button"
              className={pixelFocusClass("composer-cancel")}
              onClick={closeAndKeepDraft}
              disabled={publishing}
            >
              先不写了
            </button>
            <button
              type="submit"
              className={pixelFocusClass("composer-submit")}
              disabled={cannotSubmit}
              aria-disabled={cannotSubmit}
              aria-label={empty ? "先写一句" : undefined}
            >
              {publishing ? "正在贴上去…" : "贴到房顶"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
