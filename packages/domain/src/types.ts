export type ResidentKind = "human" | "ai";
export type Presence = "online" | "offline" | "writing" | "chatting" | "dnd";
export type PrivacyLevel = "anyone" | "nobody";
export type AiRole = "guide" | "librarian" | "editor" | "bus" | "companion" | "custom";

export interface AccountPublic {
  id: string;
  email: string;
  createdAt: string;
}

export interface ResidentPrivacy {
  knock: PrivacyLevel;
  note: PrivacyLevel;
  visit: PrivacyLevel;
  showOnline: boolean;
  companionVisible: boolean;
}

export interface AiMetadata {
  persona: string;
  systemPromptKey: string;
  dailyPostLimit: number;
}

export interface Resident {
  id: string;
  accountId: string | null;
  kind: ResidentKind;
  displayName: string;
  handle: string;
  bio: string;
  interests: string[];
  avatarSprite: string;
  truePresence: Presence;
  observerPresence: Presence;
  lastSeenAt: string;
  houseId: string | null;
  homeNeighborhoodId: string | null;
  companionResidentId: string | null;
  ownerResidentId: string | null;
  aiRole: AiRole | null;
  aiMetadata: AiMetadata | null;
  privacy: ResidentPrivacy;
  onboarding: { firstPostAt: string | null };
  createdAt: string;
}

export type ObserverResident = Omit<Resident, "truePresence">;

export type HousePreset = "cozy-1" | "cozy-2" | "library" | "newsroom" | "vacant";

export interface House {
  id: string;
  residentId: string;
  neighborhoodId: string;
  slotIndex: number;
  preset: HousePreset;
  roofTint: string;
  nameplate: string;
}

export type PostType = "post" | "article";
export type Visibility = "public";
export type ClosedTag = "闲聊" | "技术" | "生活" | "镇务" | "读书";

export const CLOSED_TAGS: readonly ClosedTag[] = ["闲聊", "技术", "生活", "镇务", "读书"];

export function isClosedTag(value: unknown): value is ClosedTag {
  return typeof value === "string" && (CLOSED_TAGS as readonly string[]).includes(value);
}

export interface Post {
  id: string;
  authorResidentId: string;
  type: PostType;
  title: string | null;
  content: string;
  visibility: Visibility;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  replyCount: number;
  reactionCount: number;
  tags: ClosedTag[];
  flags: { hot: boolean; pinned: boolean; aiGenerated: boolean };
}

export interface Reply {
  id: string;
  postId: string;
  authorResidentId: string;
  content: string;
  createdAt: string;
}

export interface Reaction {
  postId: string;
  residentId: string;
  kind: "like";
  createdAt: string;
}

export interface BubbleView {
  residentId: string;
  postId: string;
  excerpt: string;
  createdAt: string;
  count24h: number;
  hot: boolean;
  collapsed: boolean;
}

export type TileKind = "house" | "bus-stop" | "road" | "tree" | "vacant";

export const SLOTS = 12;
export const HOUSE_LOTS = [0, 1, 2, 3, 4, 5, 6, 7] as const;
export const BUS_SLOT = 9;
export const DECOR_SLOTS = [8, 10, 11] as const;
export const STREET_MINE_CENTER = 4;

export type HouseLot = (typeof HOUSE_LOTS)[number];
export type DecorSlot = (typeof DECOR_SLOTS)[number];
export type NeighborhoodKind = "residential" | "civic";

export interface Neighborhood {
  id: string;
  name: string;
  kind: NeighborhoodKind;
  slotCount: number;
}

export interface NeighborhoodTile {
  neighborhoodId: string;
  slotIndex: number;
  kind: TileKind;
  houseId: string | null;
}

export type DerivedSlotKind = TileKind | "overlay-ai" | "self";

export interface DerivedSlot {
  layoutIndex: number;
  kind: DerivedSlotKind;
  houseId: string | null;
  residentId: string | null;
  overlay?: boolean;
}

export interface TownZone {
  id: "plaza" | "board" | "library" | "cafe";
  title: string;
  tagline: string;
  anchorAiResidentId: string | null;
}

export interface NeighborEdge {
  fromResidentId: string;
  toResidentId: string;
  createdAt: string;
}

export interface Visit {
  id: string;
  visitorResidentId: string;
  hostResidentId: string;
  startedAt: string;
  endedAt: string | null;
}

export type ConversationKind = "direct";

export interface Conversation {
  id: string;
  kind: ConversationKind;
  participantResidentIds: [string, string];
  lastMessageAt: string;
  lastMessagePreview: string;
}

export type MessageVia = "knock" | "note" | "system";

export interface Message {
  id: string;
  conversationId: string;
  senderResidentId: string;
  content: string;
  createdAt: string;
  via: MessageVia;
}

export interface ConversationListItem {
  conversation: Conversation;
  unreadCount: number;
  peer: Pick<Resident, "id" | "displayName" | "handle" | "kind" | "observerPresence">;
}

export interface Block {
  blockerResidentId: string;
  blockedResidentId: string;
  createdAt: string;
}

export type AIResident = Resident & {
  kind: "ai";
  aiRole: AiRole;
  aiMetadata: NonNullable<Resident["aiMetadata"]>;
};

export interface AiQuota {
  residentId: string;
  date: string;
  postsCreated: number;
  repliesCreated: number;
}

export interface AiReplyQueue {
  id: string;
  aiResidentId: string;
  postId: string;
  enqueueAt: string;
  dropAfter: string;
}

export type WorldLocation =
  | "home"
  | "street-mine"
  | "neighborhood"
  | "resident-home"
  | "town"
  | "mail";

export interface SessionState {
  accountId: string;
  currentResidentId: string;
  worldLocation: WorldLocation;
  mailOpen: boolean;
  neighborhoodId: string | null;
  slice: "mine" | "home-canonical" | "neighbors" | "recommended";
  townZone: "plaza" | "board" | "library" | "cafe";
  selectedResidentId: string | null;
  selectedPostId: string | null;
  composerOpen: boolean;
  chatConversationId: string | null;
  reduceMotion: boolean;
}

export const DEMO_PERSONAS = ["you", "lin"] as const;
export type DemoPersona = (typeof DEMO_PERSONAS)[number];

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export interface MeResponse {
  resident: Resident;
  account: AccountPublic;
  unreadTotal: number;
}

export interface StreetMineResponse {
  neighborhood: Neighborhood;
  slots: DerivedSlot[];
  residents: ObserverResident[];
  houses: House[];
  bubbles: BubbleView[];
}

/**
 * §12.4.2: where a requested resident actually lives on this canonical
 * street. It is a camera hint — the tiles never move to satisfy it, and a
 * resident who does not live here resolves to null (the camera stays on the
 * street centre) rather than being given a slot they do not own.
 */
export interface NeighborhoodFocus {
  residentId: string;
  slotIndex: number;
}

export interface NeighborhoodView {
  neighborhood: Neighborhood;
  tiles: NeighborhoodTile[];
  houses: House[];
  residents: ObserverResident[];
  bubbles: BubbleView[];
  /** null when no focus was asked for, or the resident is not on this street. */
  focus: NeighborhoodFocus | null;
}

/** A reply with its author already resolved, so the sheet needs no N+1 read. */
export interface ReplyView extends Reply {
  author: FeedAuthor | null;
}

/** §4.11: everything the one post-detail sheet renders. */
export interface PostDetailResponse {
  post: Post;
  author: ObserverResident | null;
  replies: ReplyView[];
  /** Whether the session resident already 拍过 this post (add-only, §4.11). */
  reacted: boolean;
}

/** Doc 7.1/7.3 pagination envelope; same shape as every other cursor page. */
export type ResidentPostsResponse = CursorPage<Post>;

/** aiRole included so §6.3 can say 在岗 rather than 在家 for town staff. */
export type FeedAuthor = Pick<
  Resident,
  "id" | "displayName" | "handle" | "kind" | "observerPresence" | "aiRole"
>;

export type FeedPost = Post & {
  author: FeedAuthor;
  excerpt: string;
  readingMinutes?: number;
};

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface TownBoardResponse {
  pinned: FeedPost[];
  topics: { tag: ClosedTag; count24h: number }[];
  latest: CursorPage<FeedPost>;
}

export interface TownCafeResponse extends CursorPage<FeedPost> {
  writingCount: number;
}

export interface StreetNeighborsResponse {
  page: number;
  totalPages: number;
  view: NeighborhoodView | null;
  message: string | null;
}

export interface StreetRecommendedResponse {
  slots: DerivedSlot[];
  residents: ObserverResident[];
  houses: House[];
  bubbles: BubbleView[];
  nextCursor: string | null;
  message: string | null;
}

/** What the §5.4 gate currently says for actor -> this resident. */
export type MessageGateView =
  | { ok: true; via: "knock" | "note" }
  | { ok: false; code: "blocked" | "forbidden" | "dnd" };

export interface ResidentRelationView {
  /** NeighborEdge(me -> them) exists. */
  isNeighbor: boolean;
  /** I blocked them. */
  blocking: boolean;
  /** They blocked me. */
  blockedBy: boolean;
  isSelf: boolean;
}

/** §4.4: everything ResidentPeekCard must show on one screen. */
export interface ResidentHomeResponse {
  resident: ObserverResident;
  house: House | null;
  neighborhood: Neighborhood | null;
  relation: ResidentRelationView;
  latestBubble: BubbleView | null;
  messageGate: MessageGateView;
}

export interface SeedWorld {
  neighborhoods: Neighborhood[];
  tiles: NeighborhoodTile[];
  houses: House[];
  residents: Resident[];
  posts: Post[];
  neighborEdges: NeighborEdge[];
  blocks: Block[];
}

export function isHouseLot(slotIndex: number): slotIndex is HouseLot {
  return (HOUSE_LOTS as readonly number[]).includes(slotIndex);
}

export function isDecorSlot(slotIndex: number): slotIndex is DecorSlot {
  return (DECOR_SLOTS as readonly number[]).includes(slotIndex);
}

export function isDemoPersona(value: unknown): value is DemoPersona {
  return value === "you" || value === "lin";
}

export function omitTruePresence(resident: Resident): ObserverResident {
  const { truePresence, ...pub } = resident;
  void truePresence;
  return pub;
}
