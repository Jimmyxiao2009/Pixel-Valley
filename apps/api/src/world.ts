import {
  ageHours,
  assertCanMessage,
  bubblesForResidents,
  computeHot,
  DECOR_SLOTS,
  excerpt,
  getStreetMine,
  HOUSE_LOTS,
  isClosedTag,
  omitTruePresence,
  RESIDENT_LULU,
  SLOTS,
  withObserverFields,
  type ClosedTag,
  type Conversation,
  type DerivedSlot,
  type FeedPost,
  type House,
  type Message,
  type NeighborhoodView,
  type ObserverResident,
  type Post,
  type Reaction,
  type Reply,
  type Resident,
  type SeedWorld,
  type StreetMineResponse,
  type StreetNeighborsResponse,
  type StreetRecommendedResponse,
  type TownBoardResponse,
  type TownCafeResponse,
} from "@pixel-valley/domain";
import type { MemoryPresenceAdapter } from "./presence.ts";
import { otherParticipant, type Store } from "./store.ts";

const graphemeSegmenter = new Intl.Segmenter("zh", { granularity: "grapheme" });

export async function loadPresentedWorld(
  store: Store,
  presence: MemoryPresenceAdapter,
  now: Date,
): Promise<SeedWorld> {
  const snap = await store.snapshot();
  return {
    ...snap,
    residents: snap.residents.map((resident) =>
      withObserverFields(resident, now, {
        writing: presence.isWriting(resident.id, now.getTime()),
        chatting: presence.isChattingHost(resident.id),
      }),
    ),
  };
}

export function presentOne(resident: Resident, presence: MemoryPresenceAdapter, now: Date): Resident {
  return withObserverFields(resident, now, {
    writing: presence.isWriting(resident.id, now.getTime()),
    chatting: presence.isChattingHost(resident.id),
  });
}

export function neighborhoodView(world: SeedWorld, neighborhoodId: string, now: Date): NeighborhoodView | null {
  const neighborhood = world.neighborhoods.find((entry) => entry.id === neighborhoodId);
  if (!neighborhood) {
    return null;
  }
  const tiles = world.tiles.filter((tile) => tile.neighborhoodId === neighborhood.id);
  const houses = world.houses.filter((house) => house.neighborhoodId === neighborhood.id);
  const residentIds = new Set(houses.map((house) => house.residentId));
  if (neighborhood.kind === "residential") {
    residentIds.add(RESIDENT_LULU);
  }
  const residents = world.residents
    .filter((resident) => residentIds.has(resident.id))
    .map(omitTruePresence);
  return {
    neighborhood,
    tiles,
    houses,
    residents,
    bubbles: bubblesForResidents(residentIds, world.posts, now),
  };
}

export function streetMineView(world: SeedWorld, meId: string, now: Date): StreetMineResponse | null {
  let slots;
  try {
    slots = getStreetMine(world, meId, now);
  } catch {
    return null;
  }
  const me = world.residents.find((resident) => resident.id === meId);
  const neighborhood = world.neighborhoods.find((entry) => entry.id === me?.homeNeighborhoodId);
  if (!me || !neighborhood) {
    return null;
  }
  const residentIds = new Set(
    slots.map((slot) => slot.residentId).filter((id): id is string => typeof id === "string"),
  );
  const houseIds = new Set(
    slots.map((slot) => slot.houseId).filter((id): id is string => typeof id === "string"),
  );
  return {
    neighborhood,
    slots,
    residents: world.residents.filter((resident) => residentIds.has(resident.id)).map(omitTruePresence),
    houses: world.houses.filter((house) => houseIds.has(house.id)),
    bubbles: bubblesForResidents(residentIds, world.posts, now),
  };
}

export function streetNeighborsView(
  world: SeedWorld,
  meId: string,
  page: number,
  now: Date,
): StreetNeighborsResponse {
  const me = world.residents.find((resident) => resident.id === meId);
  const empty: StreetNeighborsResponse = {
    page,
    totalPages: 0,
    view: null,
    message: "还没有邻里。在镇上认识人，再结为邻里。",
  };
  if (!me) {
    return empty;
  }

  const outgoing = world.neighborEdges.filter((edge) => edge.fromResidentId === meId);
  const scored = new Map<string, number>();
  for (const edge of outgoing) {
    const peer = world.residents.find((resident) => resident.id === edge.toResidentId);
    const nid = peer?.homeNeighborhoodId;
    if (!nid || nid === me.homeNeighborhoodId) {
      continue;
    }
    const latestPost = world.posts
      .filter((post) => post.authorResidentId === peer.id && post.deletedAt === null)
      .reduce((max, post) => Math.max(max, Date.parse(post.createdAt)), 0);
    const stamp = Math.max(latestPost, Date.parse(edge.createdAt));
    scored.set(nid, Math.max(scored.get(nid) ?? 0, stamp));
  }

  const ordered = [...scored.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (ordered.length === 0) {
    return empty;
  }

  const totalPages = ordered.length;
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const picked = ordered[safePage - 1];
  if (!picked) {
    return { page: safePage, totalPages, view: null, message: null };
  }
  return {
    page: safePage,
    totalPages,
    view: neighborhoodView(world, picked[0], now),
    message: null,
  };
}

export function streetRecommendedView(
  world: SeedWorld,
  meId: string,
  cursor: string | undefined,
  now: Date,
): StreetRecommendedResponse {
  const me = world.residents.find((resident) => resident.id === meId);
  const homeTiles = me?.homeNeighborhoodId
    ? world.tiles.filter((tile) => tile.neighborhoodId === me.homeNeighborhoodId)
    : [];
  const vacantSlots: DerivedSlot[] = Array.from({ length: SLOTS }, (_, layoutIndex) => {
    if ((DECOR_SLOTS as readonly number[]).includes(layoutIndex) || layoutIndex === 9) {
      const tile = homeTiles.find((entry) => entry.slotIndex === layoutIndex);
      return {
        layoutIndex,
        kind: tile?.kind ?? (layoutIndex === 9 ? "bus-stop" : "tree"),
        houseId: null,
        residentId: layoutIndex === 9 ? RESIDENT_LULU : null,
        overlay: layoutIndex === 9 ? true : undefined,
      };
    }
    return { layoutIndex, kind: "vacant", houseId: null, residentId: null };
  });

  const emptyMessage = "过一阵再来这条巷。";
  if (!me) {
    return {
      slots: vacantSlots,
      residents: [],
      houses: [],
      bubbles: [],
      nextCursor: null,
      message: emptyMessage,
    };
  }

  const neighborIds = new Set(
    world.neighborEdges.filter((edge) => edge.fromResidentId === meId).map((edge) => edge.toResidentId),
  );
  const blocked = new Set(
    world.blocks
      .filter(
        (block) => block.blockerResidentId === meId || block.blockedResidentId === meId,
      )
      .map((block) => (block.blockerResidentId === meId ? block.blockedResidentId : block.blockerResidentId)),
  );

  const ranked = world.residents
    .filter((resident) => {
      return (
        resident.kind === "human" &&
        resident.id !== meId &&
        Boolean(resident.houseId) &&
        !neighborIds.has(resident.id) &&
        !blocked.has(resident.id) &&
        sharedInterestCount(me, resident) >= 1
      );
    })
    .sort((a, b) => {
      const interest = sharedInterestCount(me, b) - sharedInterestCount(me, a);
      if (interest !== 0) {
        return interest;
      }
      const created = Date.parse(a.createdAt) - Date.parse(b.createdAt);
      if (created !== 0) {
        return created;
      }
      return a.id.localeCompare(b.id);
    });

  const decoded = decodeCursor(cursor);
  let start = 0;
  if (decoded?.id) {
    const idx = ranked.findIndex((resident) => resident.id === decoded.id);
    start = idx >= 0 ? idx + 1 : 0;
  }
  const page = ranked.slice(start, start + 8);
  const next = ranked[start + 8];

  if (page.length === 0) {
    return {
      slots: vacantSlots,
      residents: [],
      houses: [],
      bubbles: [],
      nextCursor: null,
      message: emptyMessage,
    };
  }

  const slots = vacantSlots.map((slot) => ({ ...slot }));
  const houses: House[] = [];
  for (let i = 0; i < page.length && i < HOUSE_LOTS.length; i += 1) {
    const peer = page[i]!;
    const house = world.houses.find((entry) => entry.residentId === peer.id);
    const lot = HOUSE_LOTS[i]!;
    slots[lot] = {
      layoutIndex: lot,
      kind: "house",
      houseId: house?.id ?? null,
      residentId: peer.id,
    };
    if (house) {
      houses.push(house);
    }
  }

  const residentIds = new Set(page.map((resident) => resident.id));
  if (slots[9]?.residentId) {
    residentIds.add(slots[9].residentId);
  }

  return {
    slots,
    residents: world.residents.filter((resident) => residentIds.has(resident.id)).map(omitTruePresence),
    houses,
    bubbles: bubblesForResidents(residentIds, world.posts, now),
    nextCursor: next ? encodeCursor({ id: page[page.length - 1]!.id }) : null,
    message: null,
  };
}

export function encodeCursor(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeCursor(raw: string | undefined): { id?: string } | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as { id?: string };
  } catch {
    return null;
  }
}

type RankedPost = {
  post: Post;
  author: Resident;
  score: number;
  createdAtMs: number;
};

export function toFeedPost(post: Post, author: ObserverResident, library = false): FeedPost {
  const graphemes = Array.from(graphemeSegmenter.segment(post.content), (part) => part.segment);
  const readingMinutes = Math.max(1, Math.ceil(graphemes.length / 600));
  const lede =
    graphemes.length <= 60 ? graphemes.join("") : `${graphemes.slice(0, 60).join("")}…`;
  return {
    ...post,
    author: {
      id: author.id,
      displayName: author.displayName,
      handle: author.handle,
      kind: author.kind,
      observerPresence: author.observerPresence,
    },
    excerpt: library ? lede : excerpt(post.content),
    readingMinutes: library ? readingMinutes : undefined,
  };
}

export function livePublicPosts(posts: readonly Post[]): Post[] {
  return posts.filter((post) => post.deletedAt === null && post.visibility === "public");
}

export function hotWindowCounts(
  postId: string,
  replies: readonly Reply[],
  reactions: readonly Reaction[],
  now: Date,
): { replies24h: number; reactions24h: number } {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  return {
    replies24h: replies.filter((row) => row.postId === postId && row.createdAt >= cutoff).length,
    reactions24h: reactions.filter((row) => row.postId === postId && row.createdAt >= cutoff).length,
  };
}

export function withHotFlag(
  post: Post,
  replies: readonly Reply[],
  reactions: readonly Reaction[],
  now: Date,
): Post {
  const { replies24h, reactions24h } = hotWindowCounts(post.id, replies, reactions, now);
  return {
    ...post,
    flags: { ...post.flags, hot: computeHot(replies24h, reactions24h) },
  };
}

function rankPosts(
  world: SeedWorld,
  me: Resident,
  replies: readonly Reply[],
  reactions: readonly Reaction[],
  now: Date,
  mode: "recommended" | "hot" | "latest" | "neighbors",
  cafeRecency = false,
): RankedPost[] {
  const neighborIds = new Set(
    world.neighborEdges.filter((edge) => edge.fromResidentId === me.id).map((edge) => edge.toResidentId),
  );
  const authors = new Map(world.residents.map((resident) => [resident.id, resident]));
  const live = livePublicPosts(world.posts).map((post) => withHotFlag(post, replies, reactions, now));

  const ranked: RankedPost[] = [];
  for (const post of live) {
    const author = authors.get(post.authorResidentId);
    if (!author) {
      continue;
    }
    if (mode === "neighbors") {
      const isNeighbor = neighborIds.has(author.id);
      const sameStreet =
        Boolean(author.homeNeighborhoodId) && author.homeNeighborhoodId === me.homeNeighborhoodId && author.kind === "human";
      if (!isNeighbor && !sameStreet) {
        continue;
      }
    }
    const { replies24h, reactions24h } = hotWindowCounts(post.id, replies, reactions, now);
    const hotScore = 2 * replies24h + reactions24h;
    let score = 0;
    if (mode === "latest") {
      score = Date.parse(post.createdAt);
    } else if (mode === "hot") {
      score = cafeRecency ? cafeHotScore(hotScore, post.createdAt, now) : hotScore;
    } else if (mode === "neighbors") {
      score = Date.parse(post.createdAt);
    } else if (cafeRecency) {
      score = cafeHotScore(hotScore, post.createdAt, now);
    } else {
      const recency = Math.exp(-ageHours(post.createdAt, now) / 48);
      const neighborBoost = neighborIds.has(author.id) ? 4 : 0;
      const sameStreet = author.homeNeighborhoodId === me.homeNeighborhoodId ? 2 : 0;
      score = neighborBoost + sameStreet + hotScore * recency;
    }
    ranked.push({ post, author, score, createdAtMs: Date.parse(post.createdAt) });
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (a.author.kind !== b.author.kind) {
      return a.author.kind === "human" ? -1 : 1;
    }
    if (b.createdAtMs !== a.createdAtMs) {
      return b.createdAtMs - a.createdAtMs;
    }
    return b.post.id.localeCompare(a.post.id);
  });
  return ranked;
}

function applyAiQuota(ranked: RankedPost[], limit: number, afterId: string | undefined): RankedPost[] {
  const maxAi = Math.floor(limit * 0.15);
  let start = 0;
  if (afterId) {
    const idx = ranked.findIndex((row) => row.post.id === afterId);
    start = idx >= 0 ? idx + 1 : 0;
  }
  const out: RankedPost[] = [];
  let ai = 0;
  for (let i = start; i < ranked.length; i += 1) {
    const row = ranked[i]!;
    if (row.author.kind === "ai") {
      if (ai >= maxAi) {
        continue;
      }
      ai += 1;
    }
    out.push(row);
    if (out.length >= limit) {
      break;
    }
  }
  return out;
}

export function pageFeed(
  world: SeedWorld,
  me: Resident,
  replies: readonly Reply[],
  reactions: readonly Reaction[],
  now: Date,
  mode: "recommended" | "hot" | "latest" | "neighbors",
  cursor: string | undefined,
  limit: number,
  filter?: (post: Post) => boolean,
  extras?: { cafeRecency?: boolean; library?: boolean },
): { items: FeedPost[]; nextCursor: string | null } {
  let ranked = rankPosts(world, me, replies, reactions, now, mode, extras?.cafeRecency);
  if (filter) {
    ranked = ranked.filter((row) => filter(row.post));
  }
  const page = applyAiQuota(ranked, limit, decodeCursor(cursor)?.id);
  const last = page[page.length - 1];
  const more = last
    ? applyAiQuota(ranked, 1, last.post.id).length > 0
    : false;
  return {
    items: page.map((row) => toFeedPost(row.post, omitTruePresence(row.author), extras?.library)),
    nextCursor: more && last ? encodeCursor({ id: last.post.id }) : null,
  };
}

export function plazaFeed(
  world: SeedWorld,
  me: Resident,
  replies: readonly Reply[],
  reactions: readonly Reaction[],
  now: Date,
  sort: string | undefined,
  cursor: string | undefined,
  limit: number,
) {
  const mode =
    sort === "hot" || sort === "latest" || sort === "neighbors" || sort === "recommended"
      ? sort
      : "recommended";
  return pageFeed(world, me, replies, reactions, now, mode, cursor, limit);
}

export function boardFeed(
  world: SeedWorld,
  me: Resident,
  replies: readonly Reply[],
  reactions: readonly Reaction[],
  now: Date,
  tag: string | undefined,
  cursor: string | undefined,
  limit: number,
): TownBoardResponse {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const live = livePublicPosts(world.posts).map((post) => withHotFlag(post, replies, reactions, now));
  const authors = new Map(world.residents.map((resident) => [resident.id, resident]));

  const topicCounts = new Map<ClosedTag, number>();
  for (const post of live) {
    if (post.createdAt < cutoff) {
      continue;
    }
    for (const postTag of post.tags) {
      topicCounts.set(postTag, (topicCounts.get(postTag) ?? 0) + 1);
    }
  }
  const topics = [...topicCounts.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([topicTag, count24h]) => ({ tag: topicTag, count24h }));

  const tagFilter = tag && isClosedTag(tag) ? tag : undefined;
  const latest = pageFeed(
    world,
    me,
    replies,
    reactions,
    now,
    "latest",
    cursor,
    limit,
    tagFilter ? (post) => post.tags.includes(tagFilter) : undefined,
  );

  const pinned = live
    .filter((post) => post.flags.pinned && (!tagFilter || post.tags.includes(tagFilter)))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 3)
    .map((post) => {
      const author = authors.get(post.authorResidentId);
      return author ? toFeedPost(post, omitTruePresence(author)) : null;
    })
    .filter((row): row is FeedPost => Boolean(row));

  return {
    pinned: tagFilter ? [] : pinned,
    topics: tagFilter ? [] : topics,
    latest,
  };
}

export function libraryFeed(
  world: SeedWorld,
  me: Resident,
  replies: readonly Reply[],
  reactions: readonly Reaction[],
  now: Date,
  sort: string | undefined,
  cursor: string | undefined,
  limit: number,
) {
  const mode = sort === "neighbors" ? "neighbors" : "latest";
  return pageFeed(
    world,
    me,
    replies,
    reactions,
    now,
    mode,
    cursor,
    limit,
    (post) => post.type === "article" || graphemeLength(post.content) >= 500,
    { library: true },
  );
}

export function cafeFeed(
  world: SeedWorld,
  me: Resident,
  replies: readonly Reply[],
  reactions: readonly Reaction[],
  now: Date,
  sort: string | undefined,
  cursor: string | undefined,
  limit: number,
): TownCafeResponse {
  const mode = sort === "hot" ? "hot" : "latest";
  const page = pageFeed(
    world,
    me,
    replies,
    reactions,
    now,
    mode,
    cursor,
    limit,
    (post) => post.type === "post" && graphemeLength(post.content) < 500,
    { cafeRecency: sort === "hot" },
  );
  const blocked = new Set<string>();
  for (const block of world.blocks) {
    if (block.blockerResidentId === me.id) {
      blocked.add(block.blockedResidentId);
    }
    if (block.blockedResidentId === me.id) {
      blocked.add(block.blockerResidentId);
    }
  }
  const writingCount = world.residents.filter((resident) => {
    if (resident.id === me.id || blocked.has(resident.id)) {
      return false;
    }
    return resident.observerPresence === "writing";
  }).length;
  return { ...page, writingCount };
}

export function graphemeLength(text: string): number {
  return Array.from(graphemeSegmenter.segment(text)).length;
}

function sharedInterestCount(a: Resident, b: Resident): number {
  const mine = new Set(a.interests);
  return b.interests.filter((interest) => mine.has(interest)).length;
}

export function cafeHotScore(hotScore: number, createdAt: string, now: Date): number {
  return hotScore * Math.exp(-ageHours(createdAt, now) / 6);
}

/** Visitor sent the first knock/system line; the other participant is the house host. */
export function knockRecipient(conversation: Conversation, messages: readonly Message[]): string | undefined {
  const firstKnock = messages.find((message) => message.via === "system" || message.via === "knock");
  if (!firstKnock) {
    return undefined;
  }
  return otherParticipant(conversation, firstKnock.senderResidentId);
}

async function knockLegalFrom(
  store: Store,
  presence: MemoryPresenceAdapter,
  actorId: string,
  peerId: string,
  now: Date,
): Promise<boolean> {
  const actor = await store.getResident(actorId);
  const peer = await store.getResident(peerId);
  if (!actor || !peer) {
    return false;
  }
  let companionOwner: Resident | null = null;
  if (peer.aiRole === "companion" && peer.ownerResidentId) {
    companionOwner = (await store.getResident(peer.ownerResidentId)) ?? null;
  }
  const presentedPeer = presentOne(peer, presence, now);
  const gate = assertCanMessage({
    actor: presentOne(actor, presence, now),
    peer: presentedPeer,
    peerObserverPresence: presentedPeer.observerPresence,
    blocked: await store.isBlockedPair(actorId, peerId),
    companionOwner,
  });
  return gate.ok && gate.via === "knock";
}

export async function refreshHostChatting(
  store: Store,
  presence: MemoryPresenceAdapter,
  candidateId: string,
  now: Date,
): Promise<void> {
  const convos = await store.listConversationsFor(candidateId);
  const nowMs = now.getTime();
  for (const conversation of convos) {
    const peerId = otherParticipant(conversation, candidateId);
    if (!peerId) {
      continue;
    }
    const messages = await store.listMessages(conversation.id);
    const recipient = knockRecipient(conversation, messages);
    const legalFromPeer = await knockLegalFrom(store, presence, peerId, candidateId, now);
    const hostId = recipient ?? (legalFromPeer ? candidateId : undefined);
    if (hostId !== candidateId) {
      continue;
    }
    const focus = presence.getFocus(peerId, conversation.id, nowMs);
    if (!focus?.open) {
      continue;
    }
    if (await store.isBlockedPair(candidateId, peerId)) {
      continue;
    }
    const last = [...messages].reverse().find((message) => message.via !== "system");
    if (last?.via === "knock" || legalFromPeer) {
      presence.setChattingHost(candidateId, true);
      return;
    }
  }
  presence.setChattingHost(candidateId, false);
}


