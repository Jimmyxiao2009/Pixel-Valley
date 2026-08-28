import type { ReactNode } from "react";
import { AiBadge } from "../ai/AiBadge";

type NameplateProps = {
  name: string;
  ai?: boolean;
  children?: ReactNode;
};

export function Nameplate({ name, ai = false, children }: NameplateProps) {
  return (
    <span className="map-nameplate font-pixel">
      <span className="map-nameplate__name">{name}</span>
      {ai ? <AiBadge className="map-nameplate__ai" /> : null}
      {children}
    </span>
  );
}
