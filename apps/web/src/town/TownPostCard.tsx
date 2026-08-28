import { presenceText, type FeedPost } from "@pixel-valley/domain";
import { AiBadge } from "../ai/AiBadge";
import { pixelFocusClass } from "../pixel/PixelFocusRing";
import { ResidentAvatar } from "../residents/ResidentAvatar";
import type { ZoneConfig } from "./zones";

type TownPostCardProps = {
  post: FeedPost;
  density: ZoneConfig["density"];
  pinned?: boolean;
  onOpenPost: (post: FeedPost) => void;
  onOpenAuthor: (residentId: string) => void;
};

function relativeTime(iso: string, now: number): string {
  const minutes = Math.floor((now - Date.parse(iso)) / 60_000);
  if (minutes < 1) {
    return "刚刚";
  }
  if (minutes < 60) {
    return `${minutes} 分钟前`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} 小时前`;
  }
  return `${Math.floor(hours / 24)} 天前`;
}

/**
 * §4.9 card: nameplate with ◇, a line of observer presence, the excerpt, the
 * counts and the time. Body stays plain text (KD-20) — rendered as a text
 * node, never innerHTML.
 */
export function TownPostCard({
  post,
  density,
  pinned = false,
  onOpenPost,
  onOpenAuthor,
}: TownPostCardProps) {
  const now = Date.now();
  const isAi = post.author.kind === "ai";
  const reading = density === "reading";

  return (
    <article className={`town-card town-card--${density}`} aria-label={`${post.author.displayName}的帖子`}>
      <header className="town-card__head">
        <button
          type="button"
          className={pixelFocusClass("town-card__author")}
          aria-label={`${post.author.displayName}，${isAi ? "AI 居民" : "人类居民"}`}
          onClick={() => onOpenAuthor(post.author.id)}
        >
          <ResidentAvatar
            resident={{ ...post.author, avatarSprite: post.author.id }}
            size={32}
          />
          <span className="town-card__nameplate">
            <span className="town-card__name font-pixel">
              {post.author.displayName}
              {isAi ? <AiBadge /> : null}
            </span>
            <span className="town-card__presence font-pixel">
              {presenceText(post.author.observerPresence, {
                kind: post.author.kind,
                aiRole: null,
              })}
            </span>
          </span>
        </button>
        <span className="town-card__meta font-pixel">
          {pinned ? <span className="town-card__pin">钉</span> : null}
          {post.flags.hot ? <span className="town-card__hot">热</span> : null}
          <time dateTime={post.createdAt}>{relativeTime(post.createdAt, now)}</time>
        </span>
      </header>

      <button
        type="button"
        className={pixelFocusClass("town-card__body")}
        onClick={() => onOpenPost(post)}
      >
        {reading && post.title ? (
          <span className="town-card__title font-pixel">{post.title}</span>
        ) : null}
        <span className="town-card__text font-body">{post.excerpt}</span>
        {reading && post.readingMinutes ? (
          <span className="town-card__reading font-pixel">约 {post.readingMinutes} 分钟</span>
        ) : null}
      </button>

      <footer className="town-card__foot font-pixel">
        {post.tags.length > 0 ? (
          <span className="town-card__tag">{post.tags[0]}</span>
        ) : null}
        <span>{post.replyCount} 回复</span>
        <span>{post.reactionCount} 拍一拍</span>
      </footer>
    </article>
  );
}
