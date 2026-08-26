import { Hono } from "hono";
import type { Context, Next } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import {
  assertCanMessage,
  computeHot,
  isClosedTag,
  isDemoPersona,
  omitTruePresence,
  shanghaiDateKey,
  type MeResponse,
  type PrivacyLevel,
  type Resident,
  type ResidentHomeResponse,
  type ResidentPrivacy,
} from "@pixel-valley/domain";
import { mockAiReply } from "./ai.ts";
import {
  personaSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  toAccountPublic,
} from "./accounts.ts";
import { asRecord, asString, clientIp, cookieSecure, errorBody, readJson } from "./http.ts";
import { MemoryPresenceAdapter } from "./presence.ts";
import { MemoryRateLimiter } from "./rate-limit.ts";
import {
  createMemoryStore,
  lastHourIso,
  otherParticipant,
  previewOf,
  sortedPair,
  type SessionRow,
  type Store,
} from "./store.ts";
import { createPostgresStore } from "./store-postgres.ts";
import {
  boardFeed,
  cafeFeed,
  hotWindowCounts,
  libraryFeed,
  loadPresentedWorld,
  neighborhoodView,
  plazaFeed,
  presentOne,
  refreshHostChatting,
  streetMineView,
  streetNeighborsView,
  streetRecommendedView,
  withHotFlag,
} from "./world.ts";

type AppEnv = {
  Variables: {
    session: SessionRow;
  };
};

export type CreateAppOptions = {
  now?: Date;
  clock?: () => Date;
  store?: Store;
  presence?: MemoryPresenceAdapter;
  limiter?: MemoryRateLimiter;
  databaseUrl?: string;
};

const EVENT_NAMES = new Set([
  "session_start",
  "post_publish",
  "first_post_wow",
  "bubble_open",
  "peek_open",
  "peek_dwell_5s",
  "visit_enter",
  "feed_card_view",
  "feed_read_8s",
  "knock",
  "note_send",
  "nav_town",
  "block",
]);

export function createApp(nowOrOptions: Date | CreateAppOptions = {}) {
  const fromDate = nowOrOptions instanceof Date;
  const options: CreateAppOptions = fromDate ? { now: nowOrOptions } : nowOrOptions;
  const clock = options.clock ?? (options.now ? () => options.now! : () => new Date());
  const seedAt = options.now ?? clock();
  const databaseUrl = fromDate ? undefined : (options.databaseUrl ?? process.env.DATABASE_URL);
  const store = options.store ?? (databaseUrl ? createPostgresStore(databaseUrl) : createMemoryStore(seedAt));
  const presence = options.presence ?? new MemoryPresenceAdapter();
  const limiter = options.limiter ?? new MemoryRateLimiter();

  const app = new Hono<AppEnv>();

  const requireSession = async (c: Context<AppEnv>, next: Next) => {
    const token = getCookie(c, SESSION_COOKIE);
    const session = token ? await store.getSession(token) : undefined;
    if (!session || Date.parse(session.expiresAt) <= clock().getTime()) {
      if (session && token) {
        await store.deleteSession(token);
      }
      return c.json(errorBody("unauthenticated", "请先登录"), 401);
    }
    c.set("session", session);
    await store.updateResident(session.residentId, { lastSeenAt: clock().toISOString() });
    await next();
  };

  async function mePayload(residentId: string, accountId: string): Promise<MeResponse | null> {
    const resident = await store.getResident(residentId);
    const account = await store.getAccountById(accountId);
    if (!resident || !account) {
      return null;
    }
    return {
      resident: presentOne(resident, presence, clock()),
      account: toAccountPublic(account),
      unreadTotal: await store.unreadTotal(residentId),
    };
  }

  async function issueSession(c: Context, accountId: string, residentId: string) {
    const now = clock();
    const token = crypto.randomUUID();
    await store.createSession({
      id: token,
      accountId,
      residentId,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000).toISOString(),
    });
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
      secure: cookieSecure(),
    });
    await store.updateResident(residentId, { lastSeenAt: now.toISOString() });
  }

  async function actorOf(c: Context<AppEnv>): Promise<Resident | undefined> {
    const session = c.get("session");
    const resident = await store.getResident(session.residentId);
    return resident ? presentOne(resident, presence, clock()) : undefined;
  }

  async function gateMessage(actor: Resident, peer: Resident) {
    let companionOwner: Resident | null = null;
    if (peer.aiRole === "companion" && peer.ownerResidentId) {
      companionOwner = (await store.getResident(peer.ownerResidentId)) ?? null;
    }
    const presentedPeer = presentOne(peer, presence, clock());
    return assertCanMessage({
      actor,
      peer: presentedPeer,
      peerObserverPresence: presentedPeer.observerPresence,
      blocked: await store.isBlockedPair(actor.id, peer.id),
      companionOwner,
    });
  }

  function limitOr429(c: Context, key: string, limit: number, windowMs: number) {
    if (limiter.allow(key, limit, windowMs, clock().getTime())) {
      return null;
    }
    return c.json(errorBody("rate_limited", "慢一点，镇子也需要喘气"), 429);
  }

  app.post("/api/auth/demo", async (c) => {
    const denied = limitOr429(c, `login:${clientIp(c)}`, 10, 60_000);
    if (denied) {
      return denied;
    }
    const parsed = await readJson(c);
    if (!parsed.ok) {
      return c.json(errorBody("validation_error", "请求读不出来"), 400);
    }
    const persona = asRecord(parsed.value)?.persona;
    if (!isDemoPersona(persona)) {
      return c.json(errorBody("validation_error", "只能以林或你的身份进镇"), 400);
    }
    const record = personaSession(persona);
    await issueSession(c, record.accountId, record.residentId);
    const payload = await mePayload(record.residentId, record.accountId);
    if (!payload) {
      return c.json(errorBody("not_found", "这扇门暂时打不开"), 404);
    }
    return c.json(payload);
  });

  app.post("/api/auth/login", async (c) => {
    const denied = limitOr429(c, `login:${clientIp(c)}`, 10, 60_000);
    if (denied) {
      return denied;
    }
    const parsed = await readJson(c);
    if (!parsed.ok) {
      return c.json(errorBody("validation_error", "请求读不出来"), 400);
    }
    const body = asRecord(parsed.value);
    const email = asString(body?.email)?.trim();
    const password = asString(body?.password);
    if (!email || password === undefined) {
      return c.json(errorBody("validation_error", "请求读不出来"), 400);
    }
    const account = await store.getAccountByEmail(email);
    if (!account || account.passwordHash !== password) {
      return c.json(errorBody("unauthenticated", "请先登录"), 401);
    }
    const humans = await store.listResidents();
    const resident = humans.find((row) => row.accountId === account.id);
    if (!resident) {
      return c.json(errorBody("not_found", "这扇门暂时打不开"), 404);
    }
    await issueSession(c, account.id, resident.id);
    const payload = await mePayload(resident.id, account.id);
    if (!payload) {
      return c.json(errorBody("not_found", "这扇门暂时打不开"), 404);
    }
    return c.json(payload);
  });

  app.post("/api/auth/logout", async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) {
      await store.deleteSession(token);
    }
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.body(null, 204);
  });

  app.get("/api/me", requireSession, async (c) => {
    const session = c.get("session");
    const payload = await mePayload(session.residentId, session.accountId);
    if (!payload) {
      return c.json(errorBody("unauthenticated", "请先登录"), 401);
    }
    return c.json(payload);
  });

  app.patch("/api/me", requireSession, async (c) => {
    const parsed = await readJson(c);
    if (!parsed.ok) {
      return c.json(errorBody("validation_error", "请求读不出来"), 400);
    }
    const body = asRecord(parsed.value) ?? {};
    const actor = await actorOf(c);
    if (!actor) {
      return c.json(errorBody("unauthenticated", "请先登录"), 401);
    }
    const privacy = mergePrivacy(actor.privacy, body.privacy);
    const bio = typeof body.bio === "string" ? body.bio.trim() : undefined;
    if (bio !== undefined && graphemeCount(bio) > 80) {
      return c.json(errorBody("validation_error", "简介太长了"), 400);
    }
    const interests = parseInterests(body.interests);
    if (body.interests !== undefined && !interests) {
      return c.json(errorBody("validation_error", "兴趣读不出来"), 400);
    }
    let truePresence = actor.truePresence;
    if (body.presence === "dnd" || body.presence === "online") {
      truePresence = body.presence;
      if (body.presence === "online") {
        presence.setWriting(actor.id, false);
      }
    }
    await store.updateResident(actor.id, {
      bio,
      interests: interests ?? undefined,
      privacy,
      truePresence,
    });
    const payload = await mePayload(actor.id, c.get("session").accountId);
    return c.json(payload);
  });

  app.patch("/api/me/presence", requireSession, async (c) => {
    const parsed = await readJson(c);
    if (!parsed.ok) {
      return c.json(errorBody("validation_error", "请求读不出来"), 400);
    }
    const body = asRecord(parsed.value) ?? {};
    const actor = await actorOf(c);
    if (!actor) {
      return c.json(errorBody("unauthenticated", "请先登录"), 401);
    }
    if (body.presence === "dnd" || body.presence === "online") {
      await store.updateResident(actor.id, {
        truePresence: body.presence,
        lastSeenAt: clock().toISOString(),
      });
      if (body.presence === "online") {
        presence.setWriting(actor.id, false);
      }
    } else if (body.activity === "writing") {
      presence.setWriting(actor.id, true);
    } else if (body.activity === null) {
      presence.setWriting(actor.id, false);
    } else {
      return c.json(errorBody("validation_error", "请求读不出来"), 400);
    }
    const payload = await mePayload(actor.id, c.get("session").accountId);
    return c.json(payload);
  });

  app.patch("/api/me/privacy", requireSession, async (c) => {
    const parsed = await readJson(c);
    if (!parsed.ok) {
      return c.json(errorBody("validation_error", "请求读不出来"), 400);
    }
    const actor = await actorOf(c);
    if (!actor) {
      return c.json(errorBody("unauthenticated", "请先登录"), 401);
    }
    const privacy = mergePrivacy(actor.privacy, parsed.value);
    await store.updateResident(actor.id, { privacy });
    const payload = await mePayload(actor.id, c.get("session").accountId);
    return c.json(payload);
  });

  app.get("/api/street/mine", requireSession, async (c) => {
    const world = await loadPresentedWorld(store, presence, clock());
    const view = streetMineView(world, c.get("session").residentId, clock());
    if (!view) {
      return c.json(errorBody("not_found", "这条街暂时走不出去"), 404);
    }
    return c.json(view);
  });

  app.get("/api/street/neighbors", requireSession, async (c) => {
    const page = Number(c.req.query("page") ?? "1");
    const world = await loadPresentedWorld(store, presence, clock());
    return c.json(streetNeighborsView(world, c.get("session").residentId, page, clock()));
  });

  app.get("/api/street/recommended", requireSession, async (c) => {
    const world = await loadPresentedWorld(store, presence, clock());
    return c.json(streetRecommendedView(world, c.get("session").residentId, c.req.query("cursor"), clock()));
  });

  app.get("/api/neighborhoods/:id", requireSession, async (c) => {
    const world = await loadPresentedWorld(store, presence, clock());
    const view = neighborhoodView(world, routeParam(c, "id"), clock());
    if (!view) {
      return c.json(errorBody("not_found", "找不到这条街"), 404);
    }
    return c.json(view);
  });

  app.get("/api/residents/:id", requireSession, async (c) => {
    const denied = limitOr429(c, `resident:${clientIp(c)}`, 60, 60_000);
    if (denied) {
      return denied;
    }
    const resident = await store.getResident(routeParam(c, "id"));
    if (!resident) {
      return c.json(errorBody("not_found", "找不到这位居民"), 404);
    }
    const presented = presentOne(resident, presence, clock());
    const house = await store.getHouseByResident(presented.id);
    const payload: ResidentHomeResponse = {
      resident: omitTruePresence(presented),
      house: house ?? null,
    };
    return c.json(payload);
  });

  app.get("/api/residents/:id/posts", requireSession, async (c) => {
    const resident = await store.getResident(routeParam(c, "id"));
    if (!resident) {
      return c.json(errorBody("not_found", "找不到这位居民"), 404);
    }
    const cursor = c.req.query("cursor");
    const all = (await store.listPosts())
      .filter((row) => row.authorResidentId === resident.id && row.deletedAt === null)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id));
    let start = 0;
    if (cursor) {
      const idx = all.findIndex((row) => row.id === cursor);
      start = idx >= 0 ? idx + 1 : 0;
    }
    const items = all.slice(start, start + 20);
    const next = all[start + 20];
    return c.json({ items, nextCursor: next ? items[items.length - 1]?.id ?? null : null });
  });

  app.post("/api/neighbor-edges", requireSession, async (c) => {
    const parsed = await readJson(c);
    if (!parsed.ok) {
      return c.json(errorBody("validation_error", "请求读不出来"), 400);
    }
    const toResidentId = asString(asRecord(parsed.value)?.toResidentId);
    const actor = await actorOf(c);
    if (!actor) {
      return c.json(errorBody("unauthenticated", "请先登录"), 401);
    }
    if (!toResidentId || toResidentId === actor.id) {
      return c.json(errorBody("validation_error", "不能结这条邻里"), 400);
    }
    const peer = await store.getResident(toResidentId);
    if (!peer || peer.kind !== "human") {
      return c.json(errorBody("not_found", "找不到这位居民"), 404);
    }
    const existing = await store.getNeighborEdge(actor.id, peer.id);
    if (existing) {
      return c.json(existing);
    }
    const edge = {
      fromResidentId: actor.id,
      toResidentId: peer.id,
      createdAt: clock().toISOString(),
    };
    await store.insertNeighborEdge(edge);
    return c.json(edge, 201);
  });

  app.delete("/api/neighbor-edges/:toId", requireSession, async (c) => {
    await store.deleteNeighborEdge(c.get("session").residentId, routeParam(c, "toId"));
    return c.body(null, 204);
  });

  app.post("/api/blocks", requireSession, async (c) => {
    const parsed = await readJson(c);
    if (!parsed.ok) {
      return c.json(errorBody("validation_error", "请求读不出来"), 400);
    }
    const residentId = asString(asRecord(parsed.value)?.residentId);
    const actor = await actorOf(c);
    if (!actor) {
      return c.json(errorBody("unauthenticated", "请先登录"), 401);
    }
    if (!residentId || residentId === actor.id) {
      return c.json(errorBody("validation_error", "拉黑对象不对"), 400);
    }
    const peer = await store.getResident(residentId);
    if (!peer) {
      return c.json(errorBody("not_found", "找不到这位居民"), 404);
    }
    const existing = await store.getBlock(actor.id, peer.id);
    if (existing) {
      return c.json(existing);
    }
    const row = {
      blockerResidentId: actor.id,
      blockedResidentId: peer.id,
      createdAt: clock().toISOString(),
    };
    await store.insertBlock(row);
    return c.json(row, 201);
  });

  app.delete("/api/blocks/:residentId", requireSession, async (c) => {
    await store.deleteBlock(c.get("session").residentId, routeParam(c, "residentId"));
    return c.body(null, 204);
  });

  app.post("/api/visits", requireSession, async (c) => {
    const parsed = await readJson(c);
    if (!parsed.ok) {
      return c.json(errorBody("validation_error", "请求读不出来"), 400);
    }
    const hostResidentId = asString(asRecord(parsed.value)?.hostResidentId);
    const actor = await actorOf(c);
    if (!actor) {
      return c.json(errorBody("unauthenticated", "请先登录"), 401);
    }
    if (!hostResidentId) {
      return c.json(errorBody("validation_error", "请求读不出来"), 400);
    }
    const host = await store.getResident(hostResidentId);
    if (!host) {
      return c.json(errorBody("not_found", "找不到这位居民"), 404);
    }
    await store.insertVisit({
      id: crypto.randomUUID(),
      visitorResidentId: actor.id,
      hostResidentId: host.id,
      startedAt: clock().toISOString(),
      endedAt: null,
    });
    return c.body(null, 201);
  });

  app.post("/api/posts", requireSession, async (c) => {
    const parsed = await readJson(c);
    if (!parsed.ok) {
      return c.json(errorBody("validation_error", "请求读不出来"), 400);
    }
    const body = asRecord(parsed.value) ?? {};
    const content = asString(body.content)?.trim();
    const actor = await actorOf(c);
    if (!actor) {
      return c.json(errorBody("unauthenticated", "请先登录"), 401);
    }
    if (!content || graphemeCount(content) < 1 || graphemeCount(content) > 500) {
      return c.json(errorBody("validation_error", "这句话长短不对"), 400);
    }
    if (body.tag !== undefined && body.tag !== null && !isClosedTag(body.tag)) {
      return c.json(errorBody("validation_error", "这个路牌不在镇上"), 400);
    }
    const mine = (await store.listPosts()).filter((row) => row.authorResidentId === actor.id);
    const now = clock();
    const latest = [...mine].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
    if (latest && now.getTime() - Date.parse(latest.createdAt) < 10_000) {
      return c.json(errorBody("compose_cooldown", "写得太快了，先歇一口气"), 429);
    }
    const today = shanghaiDateKey(now);
    const todayCount = mine.filter((row) => shanghaiDateKey(new Date(row.createdAt)) === today).length;
    if (todayCount >= 30) {
      return c.json(errorBody("compose_cooldown", "写得太快了，先歇一口气"), 429);
    }
    const createdAt = now.toISOString();
    const post = await store.insertPost({
      id: crypto.randomUUID(),
      authorResidentId: actor.id,
      type: "post",
      title: null,
      content,
      visibility: "public",
      createdAt,
      editedAt: null,
      deletedAt: null,
      replyCount: 0,
      reactionCount: 0,
      tags: isClosedTag(body.tag) ? [body.tag] : [],
      flags: { hot: false, pinned: false, aiGenerated: false },
    });
    if (!actor.onboarding.firstPostAt) {
      await store.updateResident(actor.id, { firstPostAt: createdAt });
    }
    return c.json(post, 201);
  });

  app.post("/api/posts/:id/delete", requireSession, async (c) => {
    const actor = await actorOf(c);
    const post = await store.getPost(routeParam(c, "id"));
    if (!actor) {
      return c.json(errorBody("unauthenticated", "请先登录"), 401);
    }
    if (!post || post.deletedAt) {
      return c.json(errorBody("not_found", "找不到这条帖子"), 404);
    }
    if (post.authorResidentId !== actor.id) {
      return c.json(errorBody("forbidden", "只能揭下自己的帖"), 403);
    }
    const updated = await store.updatePost(post.id, { deletedAt: clock().toISOString() });
    return c.json(updated);
  });

  app.get("/api/posts/:id", requireSession, async (c) => {
    const post = await store.getPost(routeParam(c, "id"));
    if (!post || post.deletedAt) {
      return c.json(errorBody("not_found", "找不到这条帖子"), 404);
    }
    const replies = await store.listReplies(post.id);
    const reactions = await store.listAllReactions();
    const allReplies = await store.listAllReplies();
    return c.json({
      post: withHotFlag(post, allReplies, reactions, clock()),
      replies,
    });
  });

  app.post("/api/posts/:id/replies", requireSession, async (c) => {
    const denied = limitOr429(c, `reply:${c.get("session").residentId}`, 30, 60_000);
    if (denied) {
      return denied;
    }
    const parsed = await readJson(c);
    if (!parsed.ok) {
      return c.json(errorBody("validation_error", "请求读不出来"), 400);
    }
    const content = asString(asRecord(parsed.value)?.content)?.trim();
    const actor = await actorOf(c);
    const post = await store.getPost(routeParam(c, "id"));
    if (!actor) {
      return c.json(errorBody("unauthenticated", "请先登录"), 401);
    }
    if (!post || post.deletedAt) {
      return c.json(errorBody("not_found", "找不到这条帖子"), 404);
    }
    if (!content || graphemeCount(content) > 1000) {
      return c.json(errorBody("validation_error", "回复长短不对"), 400);
    }
    const row = await store.insertReply({
      id: crypto.randomUUID(),
      postId: post.id,
      authorResidentId: actor.id,
      content,
      createdAt: clock().toISOString(),
    });
    const replies = await store.listAllReplies();
    const reactions = await store.listAllReactions();
    const { replies24h, reactions24h } = hotWindowCounts(post.id, replies, reactions, clock());
    await store.updatePost(post.id, {
      replyCount: post.replyCount + 1,
      flags: { ...post.flags, hot: computeHot(replies24h, reactions24h) },
    });
    return c.json(row, 201);
  });

  app.post("/api/posts/:id/reactions", requireSession, async (c) => {
    const denied = limitOr429(c, `react:${c.get("session").residentId}`, 30, 60_000);
    if (denied) {
      return denied;
    }
    const actor = await actorOf(c);
    const post = await store.getPost(routeParam(c, "id"));
    if (!actor) {
      return c.json(errorBody("unauthenticated", "请先登录"), 401);
    }
    if (!post || post.deletedAt) {
      return c.json(errorBody("not_found", "找不到这条帖子"), 404);
    }
    const existing = await store.getReaction(post.id, actor.id);
    if (existing) {
      return c.json(existing);
    }
    const row = await store.insertReaction({
      postId: post.id,
      residentId: actor.id,
      kind: "like",
      createdAt: clock().toISOString(),
    });
    const replies = await store.listAllReplies();
    const reactions = await store.listAllReactions();
    const { replies24h, reactions24h } = hotWindowCounts(post.id, replies, reactions, clock());
    await store.updatePost(post.id, {
      reactionCount: post.reactionCount + 1,
      flags: { ...post.flags, hot: computeHot(replies24h, reactions24h) },
    });
    return c.json(row, 201);
  });

  app.get("/api/town/plaza", requireSession, async (c) => {
    const world = await loadPresentedWorld(store, presence, clock());
    const me = world.residents.find((row) => row.id === c.get("session").residentId);
    if (!me) {
      return c.json(errorBody("not_found", "找不到这位居民"), 404);
    }
    const replies = await store.listAllReplies();
    const reactions = await store.listAllReactions();
    return c.json(
      plazaFeed(world, me, replies, reactions, clock(), c.req.query("sort"), c.req.query("cursor"), parseLimit(c.req.query("limit"))),
    );
  });

  app.get("/api/town/board", requireSession, async (c) => {
    const world = await loadPresentedWorld(store, presence, clock());
    const me = world.residents.find((row) => row.id === c.get("session").residentId);
    if (!me) {
      return c.json(errorBody("not_found", "找不到这位居民"), 404);
    }
    const replies = await store.listAllReplies();
    const reactions = await store.listAllReactions();
    return c.json(
      boardFeed(
        world,
        me,
        replies,
        reactions,
        clock(),
        c.req.query("tag"),
        c.req.query("cursor"),
        parseLimit(c.req.query("limit")),
      ),
    );
  });

  app.get("/api/town/library", requireSession, async (c) => {
    const world = await loadPresentedWorld(store, presence, clock());
    const me = world.residents.find((row) => row.id === c.get("session").residentId);
    if (!me) {
      return c.json(errorBody("not_found", "找不到这位居民"), 404);
    }
    const replies = await store.listAllReplies();
    const reactions = await store.listAllReactions();
    return c.json(
      libraryFeed(
        world,
        me,
        replies,
        reactions,
        clock(),
        c.req.query("sort"),
        c.req.query("cursor"),
        parseLimit(c.req.query("limit")),
      ),
    );
  });

  app.get("/api/town/cafe", requireSession, async (c) => {
    const world = await loadPresentedWorld(store, presence, clock());
    const me = world.residents.find((row) => row.id === c.get("session").residentId);
    if (!me) {
      return c.json(errorBody("not_found", "找不到这位居民"), 404);
    }
    const replies = await store.listAllReplies();
    const reactions = await store.listAllReactions();
    return c.json(
      cafeFeed(
        world,
        me,
        replies,
        reactions,
        clock(),
        c.req.query("sort"),
        c.req.query("cursor"),
        parseLimit(c.req.query("limit")),
      ),
    );
  });

  app.get("/api/conversations", requireSession, async (c) => {
    const world = await loadPresentedWorld(store, presence, clock());
    const meId = c.get("session").residentId;
    const convos = (await store.listConversationsFor(meId)).sort(
      (a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt),
    );
    const items = [];
    for (const conversation of convos) {
      const peerId = otherParticipant(conversation, meId);
      const peer = peerId ? world.residents.find((row) => row.id === peerId) : undefined;
      if (!peer) {
        continue;
      }
      items.push({
        conversation,
        unreadCount: await store.unreadCount(conversation.id, meId),
        peer: {
          id: peer.id,
          displayName: peer.displayName,
          handle: peer.handle,
          kind: peer.kind,
          observerPresence: peer.observerPresence,
        },
      });
    }
    return c.json({ items });
  });

  app.post("/api/conversations", requireSession, async (c) => {
    const parsed = await readJson(c);
    if (!parsed.ok) {
      return c.json(errorBody("validation_error", "请求读不出来"), 400);
    }
    const actor = await actorOf(c);
    if (!actor) {
      return c.json(errorBody("unauthenticated", "请先登录"), 401);
    }
    const peerId = asString(asRecord(parsed.value)?.peerResidentId);
    if (!peerId || peerId === actor.id) {
      return c.json(errorBody("validation_error", "找不到说话的人"), 400);
    }
    const peer = await store.getResident(peerId);
    if (!peer) {
      return c.json(errorBody("not_found", "找不到这位居民"), 404);
    }
    const gate = await gateMessage(actor, peer);
    if (!gate.ok) {
      return denyGate(c, gate.code);
    }
    const now = clock();
    let conversation = await store.getConversationByPair(actor.id, peer.id);
    let created = false;
    if (!conversation) {
      const [left, right] = sortedPair(actor.id, peer.id);
      conversation = await store.insertConversation({
        id: crypto.randomUUID(),
        kind: "direct",
        participantResidentIds: [left, right],
        lastMessageAt: now.toISOString(),
        lastMessagePreview: "",
      });
      created = true;
    }
    if (gate.via === "knock") {
      const knockDenied = await maybeKnock(c, actor.id, conversation.id, now);
      if (knockDenied) {
        return knockDenied;
      }
    }
    return c.json({ conversation, via: gate.via }, created ? 201 : 200);
  });

  app.get("/api/conversations/:id/messages", requireSession, async (c) => {
    const meId = c.get("session").residentId;
    const conversation = await store.getConversation(routeParam(c, "id"));
    if (!conversation || !conversation.participantResidentIds.includes(meId)) {
      return c.json(errorBody("not_found", "找不到这封信"), 404);
    }
    const messages = await store.listMessages(conversation.id);
    await store.setLastRead(conversation.id, meId, clock().toISOString());
    return c.json({ conversation, messages });
  });

  app.post("/api/conversations/:id/messages", requireSession, async (c) => {
    const denied = limitOr429(c, `msg:${c.get("session").residentId}`, 20, 60_000);
    if (denied) {
      return denied;
    }
    const parsed = await readJson(c);
    if (!parsed.ok) {
      return c.json(errorBody("validation_error", "请求读不出来"), 400);
    }
    const actor = await actorOf(c);
    if (!actor) {
      return c.json(errorBody("unauthenticated", "请先登录"), 401);
    }
    const conversation = await store.getConversation(routeParam(c, "id"));
    if (!conversation || !conversation.participantResidentIds.includes(actor.id)) {
      return c.json(errorBody("not_found", "找不到这封信"), 404);
    }
    const peerId = otherParticipant(conversation, actor.id);
    const peer = peerId ? await store.getResident(peerId) : undefined;
    if (!peer) {
      return c.json(errorBody("not_found", "找不到这封信"), 404);
    }
    const gate = await gateMessage(actor, peer);
    if (!gate.ok) {
      return denyGate(c, gate.code);
    }
    const content = asString(asRecord(parsed.value)?.content)?.trim();
    if (!content || graphemeCount(content) > 2000) {
      return c.json(errorBody("validation_error", "这句话长短不对"), 400);
    }
    const now = clock();
    const row = await store.insertMessage({
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      senderResidentId: actor.id,
      content,
      createdAt: now.toISOString(),
      via: gate.via,
    });
    await store.updateConversationPreview(conversation.id, row.createdAt, previewOf(content));
    return c.json(row, 201);
  });

  app.put("/api/conversations/:id/focus", requireSession, async (c) => {
    const parsed = await readJson(c);
    if (!parsed.ok) {
      return c.json(errorBody("validation_error", "请求读不出来"), 400);
    }
    const open = asRecord(parsed.value)?.open;
    if (typeof open !== "boolean") {
      return c.json(errorBody("validation_error", "请求读不出来"), 400);
    }
    const actor = await actorOf(c);
    const conversation = await store.getConversation(routeParam(c, "id"));
    if (!actor || !conversation || !conversation.participantResidentIds.includes(actor.id)) {
      return c.json(errorBody("not_found", "找不到这封信"), 404);
    }
    const now = clock();
    presence.setFocus(actor.id, conversation.id, open, now.getTime());
    const hostId = otherParticipant(conversation, actor.id);
    if (hostId) {
      await refreshHostChatting(store, presence, hostId, now);
    }
    return c.body(null, 204);
  });

  app.post("/api/ai/chat", requireSession, async (c) => {
    const denied = limitOr429(c, `ai:${c.get("session").residentId}`, 10, 60_000);
    if (denied) {
      return denied;
    }
    const parsed = await readJson(c);
    if (!parsed.ok) {
      return c.json(errorBody("validation_error", "请求读不出来"), 400);
    }
    const actor = await actorOf(c);
    if (!actor) {
      return c.json(errorBody("unauthenticated", "请先登录"), 401);
    }
    const body = asRecord(parsed.value) ?? {};
    const conversationId = asString(body.conversationId);
    const content = asString(body.content)?.trim();
    if (!conversationId || !content || graphemeCount(content) > 2000) {
      return c.json(errorBody("validation_error", "请求读不出来"), 400);
    }
    const today = shanghaiDateKey(clock());
    const quota = await store.getAiQuota(actor.id, today);
    if ((quota?.repliesCreated ?? 0) >= 60) {
      return c.json(errorBody("ai_quota", "今天和 AI 聊得够多了"), 429);
    }
    const conversation = await store.getConversation(conversationId);
    if (!conversation || !conversation.participantResidentIds.includes(actor.id)) {
      return c.json(errorBody("not_found", "找不到这封信"), 404);
    }
    const peerId = otherParticipant(conversation, actor.id);
    const peer = peerId ? await store.getResident(peerId) : undefined;
    if (!peer || peer.kind !== "ai") {
      return c.json(errorBody("validation_error", "对面不是 AI 居民"), 400);
    }
    const gate = await gateMessage(actor, peer);
    if (!gate.ok) {
      return denyGate(c, gate.code);
    }
    const now = clock();
    const userMessage = await store.insertMessage({
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      senderResidentId: actor.id,
      content,
      createdAt: now.toISOString(),
      via: gate.via,
    });
    const history = await store.listMessages(conversation.id);
    const replyText = mockAiReply(peer, history);
    const message = await store.insertMessage({
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      senderResidentId: peer.id,
      content: replyText,
      createdAt: now.toISOString(),
      via: gate.via,
    });
    await store.updateConversationPreview(conversation.id, message.createdAt, previewOf(replyText));
    await store.bumpAiQuota(actor.id, today, "repliesCreated");
    return c.json({ message, userMessage });
  });

  app.post("/api/events", requireSession, async (c) => {
    const parsed = await readJson(c);
    if (!parsed.ok) {
      return c.json(errorBody("validation_error", "请求读不出来"), 400);
    }
    const name = asString(asRecord(parsed.value)?.name);
    if (!name) {
      return c.json(errorBody("validation_error", "请求读不出来"), 400);
    }
    if (EVENT_NAMES.has(name)) {
      console.debug("[pv.event]", name);
    }
    return c.body(null, 204);
  });

  async function maybeKnock(c: Context, actorId: string, conversationId: string, now: Date) {
    const messages = await store.listMessages(conversationId);
    const hourAgo = lastHourIso(now);
    const knocks = messages.filter(
      (row) => (row.via === "knock" || row.via === "system") && row.createdAt >= hourAgo,
    );
    if (knocks.length >= 5) {
      return c.json(errorBody("rate_limited", "慢一点，镇子也需要喘气"), 429);
    }
    const recentSystem = messages.some(
      (row) => row.via === "system" && row.senderResidentId === actorId && row.createdAt >= hourAgo,
    );
    if (!recentSystem) {
      const row = await store.insertMessage({
        id: crypto.randomUUID(),
        conversationId,
        senderResidentId: actorId,
        content: "你敲了门。",
        createdAt: now.toISOString(),
        via: "system",
      });
      await store.updateConversationPreview(conversationId, row.createdAt, row.content);
    }
    return null;
  }

  return app;
}

function routeParam(c: Context, name: string): string {
  return c.req.param(name) ?? "";
}

function denyGate(c: Context, code: "blocked" | "forbidden" | "dnd") {
  const messages = {
    blocked: "被挡住了",
    forbidden: "这家谢绝访客",
    dnd: "对方正在请勿打扰",
  } as const;
  return c.json(errorBody(code, messages[code]), 403);
}

function parseLimit(raw: string | undefined): number {
  const n = Number(raw ?? 20);
  if (!Number.isFinite(n) || n <= 0) {
    return 20;
  }
  return Math.min(20, Math.floor(n));
}

function graphemeCount(text: string): number {
  return Array.from(new Intl.Segmenter("zh", { granularity: "grapheme" }).segment(text)).length;
}

function isPrivacyLevel(value: unknown): value is PrivacyLevel {
  return value === "anyone" || value === "nobody";
}

function mergePrivacy(current: ResidentPrivacy, raw: unknown): ResidentPrivacy {
  const body = asRecord(raw) ?? {};
  return {
    knock: isPrivacyLevel(body.knock) ? body.knock : current.knock,
    note: isPrivacyLevel(body.note) ? body.note : current.note,
    visit: current.visit,
    showOnline: typeof body.showOnline === "boolean" ? body.showOnline : current.showOnline,
    companionVisible:
      typeof body.companionVisible === "boolean" ? body.companionVisible : current.companionVisible,
  };
}

function parseInterests(value: unknown): string[] | null {
  if (value === undefined) {
    return null;
  }
  if (!Array.isArray(value) || value.length > 8) {
    return null;
  }
  if (!value.every((entry) => typeof entry === "string")) {
    return null;
  }
  return value.map((entry) => entry.trim()).filter(Boolean).slice(0, 8);
}
