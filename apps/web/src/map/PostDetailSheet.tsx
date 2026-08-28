import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ObserverResident } from "@pixel-valley/domain";
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
  const navigate = useNavigate();
  const [content, setContent] = useState(excerpt);
  const [author, setAuthor] = useState<ObserverResident | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchPost(postId)
      .then((payload) => {
        if (!cancelled) {
          setContent(payload.post.content);
          setAuthor(payload.author);
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
      {/* §4.11 secondary action: put the author back in space. */}
      {author?.homeNeighborhoodId ? (
        <button
          type="button"
          className={pixelFocusClass("map-sheet__action")}
          onClick={() =>
            navigate(`/n/${author.homeNeighborhoodId}?focusResidentId=${author.id}`)
          }
        >
          去作者家门口
        </button>
      ) : null}
      <button type="button" className={pixelFocusClass("map-sheet__close")} onClick={onClose}>
        关门
      </button>
    </div>
  );
}
