import { NavLink } from "react-router-dom";
import { pixelFocusClass } from "../pixel/PixelFocusRing";

const LINKS = [
  { to: "/home", label: "回家", end: true },
  { to: "/street", label: "上街", end: true },
  { to: "/town/plaza", label: "去镇上", end: false },
  { to: "/mail", label: "信箱", end: true },
] as const;

export function WorldNav() {
  return (
    <nav className="world-nav" aria-label="世界导航">
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={({ isActive }) =>
            pixelFocusClass(isActive ? "world-nav__btn is-active" : "world-nav__btn")
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
