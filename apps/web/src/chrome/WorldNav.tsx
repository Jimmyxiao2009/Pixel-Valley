import { NavLink } from "react-router-dom";
import { pixelFocusClass } from "../pixel/PixelFocusRing";
import { useSession } from "../session/SessionProvider";

const LINKS = [
  { to: "/home", label: "回家", end: true },
  { to: "/street", label: "上街", end: true },
  { to: "/town/plaza", label: "去镇上", end: false },
  { to: "/mail", label: "信箱", end: true },
] as const;

/** The doc sets no cap; keep the key from growing rather than invent a rule. */
const MAX_SHOWN = 99;

export function unreadBadgeText(unreadTotal: number): string | null {
  if (unreadTotal <= 0) {
    return null;
  }
  return unreadTotal > MAX_SHOWN ? `${MAX_SHOWN}+` : String(unreadTotal);
}

export function unreadLabel(label: string, unreadTotal: number): string {
  return unreadTotal > 0 ? `${label}，${unreadTotal} 条未读` : label;
}

export function WorldNav() {
  const { me } = useSession();
  // §2.2 / §5.5: the mailbox key is the only place unread appears, and the
  // count is whatever the server last said — WorldNav keeps no second truth.
  const unreadTotal = me?.unreadTotal ?? 0;

  return (
    <nav className="world-nav" aria-label="世界导航">
      {LINKS.map((link) => {
        const isMail = link.to === "/mail";
        const badge = isMail ? unreadBadgeText(unreadTotal) : null;
        return (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            aria-label={isMail ? unreadLabel(link.label, unreadTotal) : undefined}
            className={({ isActive }) =>
              pixelFocusClass(isActive ? "world-nav__btn is-active" : "world-nav__btn")
            }
          >
            {link.label}
            {badge ? (
              <span className="world-nav__unread font-pixel" aria-hidden="true">
                {badge}
              </span>
            ) : null}
          </NavLink>
        );
      })}
    </nav>
  );
}
