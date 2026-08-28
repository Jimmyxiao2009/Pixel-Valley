import { useEffect, useState } from "react";
import { fetchPost } from "../data/api";
import { pixelFocusClass } from "../pixel/PixelFocusRing";

type PostDetailSheetProps = {
  postId: string;
  excerpt: string;
  authorName: string;
  count24h: number;
  onClose: () => void;
};

export function PostDetailSheet({
  postId,
  excerpt,
  authorName,
  count24h,
  onClose,
}: PostDetailSheetProps) {
  const [content, setContent] = useState(excerpt);

  useEffect(() => {
    let cancelled = false;
    void fetchPost(postId)
      .then((payload) => {
        if (!cancelled) {
          setContent(payload.post.content);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setContent(excerpt);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [postId, excerpt]);

  return (
    <div className="map-sheet" role="dialog" aria-modal="true" aria-labelledby="post-title">
      <p id="post-title" className="map-sheet__title font-pixel">
        {authorName}
      </p>
      {count24h >= 2 ? <p className="map-sheet__meta font-pixel">最近 {count24h} 条</p> : null}
      <p className="map-sheet__body font-body">{content}</p>
      <button type="button" className={pixelFocusClass("map-sheet__close")} onClick={onClose}>
        关门
      </button>
    </div>
  );
}
