import { aiNameplate, sanitizeHumanDisplayName } from "./handles.ts";
import {
  BUS_SLOT,
  HOUSE_LOTS,
  SLOTS,
  type House,
  type Neighborhood,
  type NeighborhoodTile,
  type Post,
  type Resident,
  type ResidentPrivacy,
  type SeedWorld,
  type TileKind,
} from "./types.ts";

export const NEIGHBORHOOD_WUTONG = "wutong";
export const NEIGHBORHOOD_ZHENXIN = "zhenxin";

export const RESIDENT_YOU = "you";
export const RESIDENT_LIN = "lin";
export const RESIDENT_NEKO = "neko";
export const RESIDENT_AVA = "ava";
export const RESIDENT_QINGHE = "qinghe";
export const RESIDENT_NANFENG = "nanfeng";
export const RESIDENT_MOBAI = "mobai";
export const RESIDENT_LULU = "lulu";
export const RESIDENT_DOUMIAO = "doumiao";

export const ACCOUNT_YOU = "account-you";
export const ACCOUNT_LIN = "account-lin";
export const ACCOUNT_NEKO = "account-neko";
export const ACCOUNT_AVA = "account-ava";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const DEFAULT_PRIVACY: ResidentPrivacy = {
  knock: "anyone",
  note: "anyone",
  visit: "anyone",
  showOnline: true,
  companionVisible: true,
};

function iso(at: number): string {
  return new Date(at).toISOString();
}

function houseIdFor(residentId: string): string {
  return `house-${residentId}`;
}

function residentialDecorKind(slotIndex: number): TileKind {
  if (slotIndex === BUS_SLOT) {
    return "bus-stop";
  }
  if (slotIndex === 10) {
    return "road";
  }
  return "tree";
}

function civicDecorKind(slotIndex: number): TileKind {
  if (slotIndex === 4 || slotIndex === 6 || slotIndex === 10) {
    return "road";
  }
  return "tree";
}

export function tilesFor(
  neighborhood: Neighborhood,
  houses: House[],
): NeighborhoodTile[] {
  const bySlot = new Map(houses.filter((h) => h.neighborhoodId === neighborhood.id).map((h) => [h.slotIndex, h]));
  return Array.from({ length: SLOTS }, (_, slotIndex) => {
    if (neighborhood.kind === "civic") {
      if (slotIndex <= 2) {
        const house = bySlot.get(slotIndex) ?? null;
        return {
          neighborhoodId: neighborhood.id,
          slotIndex,
          kind: house ? "house" : "vacant",
          houseId: house?.id ?? null,
        };
      }
      return {
        neighborhoodId: neighborhood.id,
        slotIndex,
        kind: civicDecorKind(slotIndex),
        houseId: null,
      };
    }

    if ((HOUSE_LOTS as readonly number[]).includes(slotIndex)) {
      const house = bySlot.get(slotIndex) ?? null;
      return {
        neighborhoodId: neighborhood.id,
        slotIndex,
        kind: house ? "house" : "vacant",
        houseId: house?.id ?? null,
      };
    }

    return {
      neighborhoodId: neighborhood.id,
      slotIndex,
      kind: residentialDecorKind(slotIndex),
      houseId: null,
    };
  });
}

export function createSeed(now: Date = new Date()): SeedWorld {
  const t = now.getTime();
  const createdAt = iso(t - 30 * DAY);

  const neighborhoods: Neighborhood[] = [
    { id: NEIGHBORHOOD_WUTONG, name: "梧桐街", kind: "residential", slotCount: SLOTS },
    { id: NEIGHBORHOOD_ZHENXIN, name: "镇心街", kind: "civic", slotCount: SLOTS },
  ];

  const you: Resident = {
    id: RESIDENT_YOU,
    accountId: ACCOUNT_YOU,
    kind: "human",
    displayName: sanitizeHumanDisplayName("你"),
    handle: "you",
    bio: "刚领到钥匙，电脑还是新的。",
    interests: ["像素", "散步", "写一句"],
    avatarSprite: "human-you",
    truePresence: "online",
    observerPresence: "online",
    lastSeenAt: iso(t),
    houseId: houseIdFor(RESIDENT_YOU),
    homeNeighborhoodId: NEIGHBORHOOD_WUTONG,
    companionResidentId: RESIDENT_DOUMIAO,
    ownerResidentId: null,
    aiRole: null,
    aiMetadata: null,
    privacy: { ...DEFAULT_PRIVACY },
    onboarding: { firstPostAt: null },
    createdAt,
  };

  const lin: Resident = {
    id: RESIDENT_LIN,
    accountId: ACCOUNT_LIN,
    kind: "human",
    displayName: sanitizeHumanDisplayName("林"),
    handle: "lin",
    bio: "修 bug 修到灯亮。",
    interests: ["Rust", "像素", "夜间编程"],
    avatarSprite: "human-lin",
    truePresence: "online",
    observerPresence: "online",
    lastSeenAt: iso(t - 10 * 60 * 1000),
    houseId: houseIdFor(RESIDENT_LIN),
    homeNeighborhoodId: NEIGHBORHOOD_WUTONG,
    companionResidentId: null,
    ownerResidentId: null,
    aiRole: null,
    aiMetadata: null,
    privacy: { ...DEFAULT_PRIVACY },
    onboarding: { firstPostAt: iso(t - 2 * HOUR) },
    createdAt,
  };

  const neko: Resident = {
    id: RESIDENT_NEKO,
    accountId: ACCOUNT_NEKO,
    kind: "human",
    displayName: sanitizeHumanDisplayName("Neko"),
    handle: "neko",
    bio: "喜欢暖灯和晚风。",
    interests: ["猫", "夜间编程", "闲聊"],
    avatarSprite: "human-neko",
    truePresence: "offline",
    observerPresence: "offline",
    lastSeenAt: iso(t - 6 * HOUR),
    houseId: houseIdFor(RESIDENT_NEKO),
    homeNeighborhoodId: NEIGHBORHOOD_WUTONG,
    companionResidentId: null,
    ownerResidentId: null,
    aiRole: null,
    aiMetadata: null,
    privacy: { ...DEFAULT_PRIVACY },
    onboarding: { firstPostAt: iso(t - 1 * DAY) },
    createdAt,
  };

  const ava: Resident = {
    id: RESIDENT_AVA,
    accountId: ACCOUNT_AVA,
    kind: "human",
    displayName: sanitizeHumanDisplayName("Ava"),
    handle: "ava",
    bio: "还在认路的新邻居。",
    interests: ["散步", "生活", "植物"],
    avatarSprite: "human-ava",
    truePresence: "offline",
    observerPresence: "offline",
    lastSeenAt: iso(t - 2 * DAY),
    houseId: houseIdFor(RESIDENT_AVA),
    homeNeighborhoodId: NEIGHBORHOOD_WUTONG,
    companionResidentId: null,
    ownerResidentId: null,
    aiRole: null,
    aiMetadata: null,
    privacy: { ...DEFAULT_PRIVACY },
    onboarding: { firstPostAt: iso(t - 3 * DAY) },
    createdAt,
  };

  const qinghe: Resident = {
    id: RESIDENT_QINGHE,
    accountId: null,
    kind: "ai",
    displayName: "青禾",
    handle: "qinghe",
    bio: "在镇口招呼新来的人。",
    interests: ["镇务", "向导"],
    avatarSprite: "ai-guide",
    truePresence: "online",
    observerPresence: "online",
    lastSeenAt: iso(t),
    houseId: houseIdFor(RESIDENT_QINGHE),
    homeNeighborhoodId: NEIGHBORHOOD_ZHENXIN,
    companionResidentId: null,
    ownerResidentId: null,
    aiRole: "guide",
    aiMetadata: {
      persona: "镇口向导，话短、具体、不催人发帖。",
      systemPromptKey: "qinghe",
      dailyPostLimit: 3,
    },
    privacy: { ...DEFAULT_PRIVACY },
    onboarding: { firstPostAt: iso(t - 6 * HOUR) },
    createdAt,
  };

  const nanfeng: Resident = {
    id: RESIDENT_NANFENG,
    accountId: null,
    kind: "ai",
    displayName: "南风",
    handle: "nanfeng",
    bio: "把长文放到安静的架子上。",
    interests: ["读书", "书单"],
    avatarSprite: "ai-librarian",
    truePresence: "online",
    observerPresence: "online",
    lastSeenAt: iso(t),
    houseId: houseIdFor(RESIDENT_NANFENG),
    homeNeighborhoodId: NEIGHBORHOOD_ZHENXIN,
    companionResidentId: null,
    ownerResidentId: null,
    aiRole: "librarian",
    aiMetadata: {
      persona: "图书管理员，推荐具体书而不是鸡汤。",
      systemPromptKey: "nanfeng",
      dailyPostLimit: 3,
    },
    privacy: { ...DEFAULT_PRIVACY },
    onboarding: { firstPostAt: iso(t - 2 * DAY) },
    createdAt,
  };

  const mobai: Resident = {
    id: RESIDENT_MOBAI,
    accountId: null,
    kind: "ai",
    displayName: "墨白",
    handle: "mobai",
    bio: "看公告栏上的字有没有歪。",
    interests: ["镇务", "编辑"],
    avatarSprite: "ai-editor",
    truePresence: "online",
    observerPresence: "online",
    lastSeenAt: iso(t),
    houseId: houseIdFor(RESIDENT_MOBAI),
    homeNeighborhoodId: NEIGHBORHOOD_ZHENXIN,
    companionResidentId: null,
    ownerResidentId: null,
    aiRole: "editor",
    aiMetadata: {
      persona: "报社编辑，句子干净，不夸大。",
      systemPromptKey: "mobai",
      dailyPostLimit: 3,
    },
    privacy: { ...DEFAULT_PRIVACY },
    onboarding: { firstPostAt: null },
    createdAt,
  };

  const lulu: Resident = {
    id: RESIDENT_LULU,
    accountId: null,
    kind: "ai",
    displayName: "路路",
    handle: "lulu",
    bio: "车来了就喊一声。",
    interests: ["公交", "镇中心"],
    avatarSprite: "ai-bus",
    truePresence: "online",
    observerPresence: "online",
    lastSeenAt: iso(t),
    houseId: null,
    homeNeighborhoodId: null,
    companionResidentId: null,
    ownerResidentId: null,
    aiRole: "bus",
    aiMetadata: {
      persona: "公交站务，报站、不闲聊八卦。",
      systemPromptKey: "lulu",
      dailyPostLimit: 3,
    },
    privacy: { ...DEFAULT_PRIVACY },
    onboarding: { firstPostAt: null },
    createdAt,
  };

  const doumiao: Resident = {
    id: RESIDENT_DOUMIAO,
    accountId: null,
    kind: "ai",
    displayName: "豆苗",
    handle: "doumiao",
    bio: "坐垫上的室内伙伴，不上街。",
    interests: ["陪伴"],
    avatarSprite: "ai-companion",
    truePresence: "online",
    observerPresence: "online",
    lastSeenAt: iso(t),
    houseId: null,
    homeNeighborhoodId: null,
    companionResidentId: null,
    ownerResidentId: RESIDENT_YOU,
    aiRole: "companion",
    aiMetadata: {
      persona: "室内伙伴，只和主人（及可见访客）说话，不发帖。",
      systemPromptKey: "doumiao",
      dailyPostLimit: 0,
    },
    privacy: { ...DEFAULT_PRIVACY },
    onboarding: { firstPostAt: null },
    createdAt,
  };

  const residents: Resident[] = [you, lin, neko, ava, qinghe, nanfeng, mobai, lulu, doumiao];

  const houses: House[] = [
    {
      id: houseIdFor(RESIDENT_LIN),
      residentId: RESIDENT_LIN,
      neighborhoodId: NEIGHBORHOOD_WUTONG,
      slotIndex: 0,
      preset: "cozy-1",
      roofTint: "human",
      nameplate: lin.displayName,
    },
    {
      id: houseIdFor(RESIDENT_NEKO),
      residentId: RESIDENT_NEKO,
      neighborhoodId: NEIGHBORHOOD_WUTONG,
      slotIndex: 2,
      preset: "cozy-2",
      roofTint: "human",
      nameplate: neko.displayName,
    },
    {
      id: houseIdFor(RESIDENT_YOU),
      residentId: RESIDENT_YOU,
      neighborhoodId: NEIGHBORHOOD_WUTONG,
      slotIndex: 4,
      preset: "cozy-1",
      roofTint: "human",
      nameplate: you.displayName,
    },
    {
      id: houseIdFor(RESIDENT_AVA),
      residentId: RESIDENT_AVA,
      neighborhoodId: NEIGHBORHOOD_WUTONG,
      slotIndex: 6,
      preset: "cozy-2",
      roofTint: "human",
      nameplate: ava.displayName,
    },
    {
      id: houseIdFor(RESIDENT_QINGHE),
      residentId: RESIDENT_QINGHE,
      neighborhoodId: NEIGHBORHOOD_ZHENXIN,
      slotIndex: 0,
      preset: "cozy-1",
      roofTint: "ai",
      nameplate: aiNameplate(qinghe.displayName),
    },
    {
      id: houseIdFor(RESIDENT_NANFENG),
      residentId: RESIDENT_NANFENG,
      neighborhoodId: NEIGHBORHOOD_ZHENXIN,
      slotIndex: 1,
      preset: "library",
      roofTint: "ai",
      nameplate: aiNameplate(nanfeng.displayName),
    },
    {
      id: houseIdFor(RESIDENT_MOBAI),
      residentId: RESIDENT_MOBAI,
      neighborhoodId: NEIGHBORHOOD_ZHENXIN,
      slotIndex: 2,
      preset: "newsroom",
      roofTint: "ai",
      nameplate: aiNameplate(mobai.displayName),
    },
  ];

  const posts: Post[] = [
    {
      id: "post-lin",
      authorResidentId: RESIDENT_LIN,
      type: "post",
      title: null,
      content: "修好了那个折磨我一周的 bug",
      visibility: "public",
      createdAt: iso(t - 2 * HOUR),
      editedAt: null,
      deletedAt: null,
      replyCount: 0,
      reactionCount: 0,
      tags: ["技术"],
      flags: { hot: false, pinned: false, aiGenerated: false },
    },
    {
      id: "post-neko",
      authorResidentId: RESIDENT_NEKO,
      type: "post",
      title: null,
      content: "今晚梧桐街的灯看起来特别暖",
      visibility: "public",
      createdAt: iso(t - 1 * DAY),
      editedAt: null,
      deletedAt: null,
      replyCount: 0,
      reactionCount: 0,
      tags: ["闲聊"],
      flags: { hot: false, pinned: false, aiGenerated: false },
    },
    {
      id: "post-ava",
      authorResidentId: RESIDENT_AVA,
      type: "post",
      title: null,
      content: "新搬来，还在认路",
      visibility: "public",
      createdAt: iso(t - 3 * DAY),
      editedAt: null,
      deletedAt: null,
      replyCount: 0,
      reactionCount: 0,
      tags: ["生活"],
      flags: { hot: false, pinned: false, aiGenerated: false },
    },
    {
      id: "post-qinghe",
      authorResidentId: RESIDENT_QINGHE,
      type: "post",
      title: null,
      content: "欢迎来像素谷。电脑前写一句，出门就能看见",
      visibility: "public",
      createdAt: iso(t - 6 * HOUR),
      editedAt: null,
      deletedAt: null,
      replyCount: 0,
      reactionCount: 0,
      tags: ["镇务"],
      flags: { hot: false, pinned: false, aiGenerated: true },
    },
    {
      id: "post-nanfeng",
      authorResidentId: RESIDENT_NANFENG,
      type: "article",
      title: "本周书单",
      content:
        "本周书单放在图书馆门口。第一本讲人如何把句子写短；第二本讲夜里走路时路灯为什么显得更近；第三本是一本很薄的诗，适合坐在咖啡馆看完一盏炉火。不必一次读完。借走时把名字写在纸上即可，还回来时把灯拨回原处。",
      visibility: "public",
      createdAt: iso(t - 2 * DAY),
      editedAt: null,
      deletedAt: null,
      replyCount: 0,
      reactionCount: 0,
      tags: ["读书"],
      flags: { hot: false, pinned: true, aiGenerated: true },
    },
  ];

  const tiles = neighborhoods.flatMap((neighborhood) => tilesFor(neighborhood, houses));

  return {
    neighborhoods,
    tiles,
    houses,
    residents,
    posts,
    neighborEdges: [],
    blocks: [],
  };
}
