import { useEffect, useState, type KeyboardEvent } from "react";
import type { ObserverResident, Post, Resident } from "@pixel-valley/domain";
import { AiBadge } from "../ai/AiBadge";
import { fetchResidentPosts } from "../data/api";
import { pixelFocusClass } from "../pixel/PixelFocusRing";

type BookshelfTab = "posts" | "bio" | "saves";

type BookshelfSheetProps = {
  resident: Resident | ObserverResident;
  initialTab?: BookshelfTab;
  onClose: () => void;
};

const TABS: { id: BookshelfTab; label: string }[] = [
  { id: "posts", label: "帖子" },
  { id: "bio", label: "简介" },
  { id: "saves", label: "收藏" },
];

export function BookshelfSheet({ resident, initialTab = "posts", onClose }: BookshelfSheetProps) {
  const [tab, setTab] = useState<BookshelfTab>(initialTab);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [postsError, setPostsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPostsError(false);
    void fetchResidentPosts(resident.id)
      .then((result) => {
        if (!cancelled) {
          setPosts(result.posts);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPostsError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [resident.id]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
  }

  const interests = resident.interests.slice(0, 3);
  const bio = resident.bio.slice(0, 80);

  return (
    <div className="pv-overlay" onKeyDown={onKeyDown}>
      <div
        className="bookshelf-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bookshelf-title"
      >
        <header className="bookshelf-head">
          <h2 id="bookshelf-title" className="font-pixel">
            书架
          </h2>
          <p className="bookshelf-byline font-pixel">
            {resident.displayName} @{resident.handle}
            {resident.kind === "ai" ? <AiBadge /> : null}
          </p>
          <button type="button" className={pixelFocusClass("pv-sheet-close")} onClick={onClose}>
            关上
          </button>
        </header>

        <div className="bookshelf-tabs" role="tablist" aria-label="书架分类">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={pixelFocusClass(tab === item.id ? "bookshelf-tab is-active" : "bookshelf-tab")}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "posts" ? (
          <div className="bookshelf-body" role="tabpanel">
            {postsError ? (
              <p className="font-body">书架暂时打不开</p>
            ) : posts === null ? (
              <p className="font-body">正在抽出这一层…</p>
            ) : posts.length === 0 ? (
              <p className="font-body">架子上还没有帖子</p>
            ) : (
              <ul className="bookshelf-posts">
                {posts.map((post) => (
                  <li key={post.id} className="bookshelf-post">
                    {post.title ? <p className="bookshelf-post__title font-pixel">{post.title}</p> : null}
                    <p className="bookshelf-post__content font-body">{post.content}</p>
                    {post.tags[0] ? (
                      <p className="bookshelf-post__tag font-pixel">{post.tags[0]}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {tab === "bio" ? (
          <div className="bookshelf-body" role="tabpanel">
            <p className="font-body">{bio || "还没写简介。"}</p>
            {interests.length > 0 ? (
              <ul className="bookshelf-interests">
                {interests.map((interest) => (
                  <li key={interest} className="font-pixel">
                    {interest}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="bookshelf-saves-note font-body">收藏会在以后出现在这层架子上。</p>
          </div>
        ) : null}

        {tab === "saves" ? (
          <div className="bookshelf-body" role="tabpanel">
            <p className="font-body">收藏会在以后出现在这层架子上。</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
