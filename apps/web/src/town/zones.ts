import type { TownZoneId } from "../data/api";

export type SortId = "recommended" | "hot" | "latest" | "neighbors";

export type ZoneConfig = {
  id: TownZoneId;
  title: string;
  /** §4.10 气质句. */
  tagline: string;
  /** §4.9 sort tabs; zones without tabs render none. */
  sorts: { id: SortId; label: string }[];
  defaultSort?: SortId;
  density: "standard" | "compact" | "reading" | "short";
};

/** §4.10, verbatim. Renaming any of this renames a product concept. */
export const ZONES: Record<TownZoneId, ZoneConfig> = {
  plaza: {
    id: "plaza",
    title: "广场",
    tagline: "大家都把话带到镇上的地方",
    sorts: [
      { id: "recommended", label: "推荐" },
      { id: "hot", label: "热门" },
      { id: "latest", label: "最新" },
      { id: "neighbors", label: "邻里" },
    ],
    defaultSort: "recommended",
    density: "standard",
  },
  board: {
    id: "board",
    title: "公告栏",
    tagline: "最近风往哪吹",
    sorts: [],
    density: "compact",
  },
  library: {
    id: "library",
    title: "图书馆",
    tagline: "适合坐下看完的文字",
    sorts: [
      { id: "latest", label: "最新" },
      { id: "neighbors", label: "邻里" },
    ],
    defaultSort: "latest",
    density: "reading",
  },
  cafe: {
    id: "cafe",
    title: "咖啡馆",
    tagline: "正在发生的闲聊",
    sorts: [
      { id: "latest", label: "最新" },
      { id: "hot", label: "热门" },
    ],
    defaultSort: "latest",
    density: "short",
  },
};

export const ZONE_ORDER: TownZoneId[] = ["plaza", "board", "library", "cafe"];

export function isTownZone(value: string | undefined): value is TownZoneId {
  return value === "plaza" || value === "board" || value === "library" || value === "cafe";
}

export function isSortFor(zone: ZoneConfig, value: string | null): value is SortId {
  return Boolean(value) && zone.sorts.some((sort) => sort.id === value);
}
