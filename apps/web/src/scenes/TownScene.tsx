import { useState } from "react";
import { NavLink, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { FeedPost } from "@pixel-valley/domain";
import { PostDetailSheet } from "../map/PostDetailSheet";
import { pixelFocusClass } from "../pixel/PixelFocusRing";
import { PeekCardHost } from "../residents/PeekCardHost";
import { TownPostCard } from "../town/TownPostCard";
import { useTownFeed } from "../town/useTownFeed";
import { isSortFor, isTownZone, ZONE_ORDER, ZONES } from "../town/zones";

type Overlay =
  | { type: "post"; post: FeedPost }
  | { type: "resident"; residentId: string }
  | null;

/**
 * §4.10 / KD-6: one scene, four zones. Switching a building switches the zone
 * and its feed — never a separate level, never another transition.
 */
export function TownScene() {
  const { zone: zoneParam } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [overlay, setOverlay] = useState<Overlay>(null);

  // Fall back before the hooks run so the hook order never depends on the URL.
  const known = isTownZone(zoneParam);
  const zone = ZONES[known ? zoneParam : "plaza"];
  const sortParam = params.get("sort");
  const sort = isSortFor(zone, sortParam) ? sortParam : zone.defaultSort;
  const feed = useTownFeed(zone.id, sort);

  if (!known) {
    return <Navigate to="/town/plaza" replace />;
  }

  function setSort(next: string) {
    const query = new URLSearchParams(params);
    query.set("sort", next);
    setParams(query, { replace: true });
  }

  const empty = feed.status === "ready" && feed.items.length === 0 && feed.pinned.length === 0;

  return (
    <div className="town">
      <nav className="town-skyline" aria-label="镇中心分区">
        {ZONE_ORDER.map((id) => (
          <NavLink
            key={id}
            to={`/town/${id}`}
            aria-current={id === zone.id ? "page" : undefined}
            className={({ isActive }) =>
              pixelFocusClass(
                isActive ? "town-skyline__building is-active" : "town-skyline__building",
              )
            }
          >
            <span className={`town-skyline__roof town-skyline__roof--${id}`} aria-hidden="true" />
            <span className="town-skyline__label font-pixel">{ZONES[id].title}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={pixelFocusClass("town-skyline__back")}
          onClick={() => navigate("/street")}
        >
          回我的街
        </button>
      </nav>

      <header className="town-header">
        <h1 className="town-header__title font-pixel">{zone.title}</h1>
        <p className="town-header__tagline font-body">{zone.tagline}</p>
        {zone.id === "cafe" && feed.writingCount > 0 ? (
          <p className="town-header__aside font-pixel">正在写字 {feed.writingCount} 人</p>
        ) : null}
        <button
          type="button"
          className={pixelFocusClass("town-header__compose")}
          onClick={() => navigate("/home?compose=1")}
        >
          回家写一句
        </button>
      </header>

      {zone.sorts.length > 0 ? (
        <div className="town-sorts" role="tablist" aria-label={`${zone.title}排序`}>
          {zone.sorts.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={option.id === sort}
              className={pixelFocusClass(
                option.id === sort ? "town-sorts__tab is-active" : "town-sorts__tab",
              )}
              onClick={() => setSort(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {zone.id === "board" && feed.topics.length > 0 ? (
        <ul className="town-topics" aria-label="话题">
          {feed.topics.map((topic) => (
            <li key={topic.tag} className="town-topics__item font-pixel">
              {topic.tag} · {topic.count24h}
            </li>
          ))}
        </ul>
      ) : null}

      <main className="town-feed">
        {feed.status === "loading" ? (
          <div role="status" aria-live="polite">
            <p className="visually-hidden">正在把今天的话搬上来</p>
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="town-card town-card--skeleton" aria-hidden="true" />
            ))}
          </div>
        ) : feed.status === "error" ? (
          <div role="alert" className="town-feed__error">
            <p className="font-body">镇上的话还没搬过来</p>
            <button
              type="button"
              className={pixelFocusClass("town-feed__retry")}
              onClick={feed.retry}
            >
              再试一次
            </button>
          </div>
        ) : empty ? (
          <p className="town-feed__empty font-body">
            {zone.id === "cafe" ? "炉子还温着，等第一句话" : "这里今天还没有人说话"}
          </p>
        ) : (
          <>
            <ul className="town-feed__list">
              {feed.pinned.map((post) => (
                <li key={`pinned-${post.id}`}>
                  <TownPostCard
                    post={post}
                    density={zone.density}
                    pinned
                    onOpenPost={(next) => setOverlay({ type: "post", post: next })}
                    onOpenAuthor={(residentId) => setOverlay({ type: "resident", residentId })}
                  />
                </li>
              ))}
              {feed.items.map((post) => (
                <li key={post.id}>
                  <TownPostCard
                    post={post}
                    density={zone.density}
                    onOpenPost={(next) => setOverlay({ type: "post", post: next })}
                    onOpenAuthor={(residentId) => setOverlay({ type: "resident", residentId })}
                  />
                </li>
              ))}
            </ul>

            {feed.moreError ? (
              <p className="town-feed__error font-body" role="alert">
                后面的话没跟上来。
              </p>
            ) : null}

            {feed.nextCursor ? (
              <button
                type="button"
                className={pixelFocusClass("town-feed__more")}
                onClick={feed.loadMore}
                disabled={feed.loadingMore}
              >
                {feed.loadingMore ? "正在搬…" : "再看看"}
              </button>
            ) : null}
          </>
        )}
      </main>

      {overlay?.type === "post" ? (
        <div className="map-overlay">
          <button
            type="button"
            className="map-overlay__backdrop"
            aria-label="关闭"
            onClick={() => setOverlay(null)}
          />
          <PostDetailSheet
            postId={overlay.post.id}
            excerpt={overlay.post.excerpt}
            authorName={overlay.post.author.displayName}
            count24h={0}
            onClose={() => setOverlay(null)}
          />
        </div>
      ) : null}

      {overlay?.type === "resident" ? (
        <div className="map-overlay">
          <button
            type="button"
            className="map-overlay__backdrop"
            aria-label="关闭"
            onClick={() => setOverlay(null)}
          />
          <PeekCardHost residentId={overlay.residentId} onClose={() => setOverlay(null)} />
        </div>
      ) : null}
    </div>
  );
}
