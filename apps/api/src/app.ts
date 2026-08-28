import { Hono } from "hono";
import type { Context, Next } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import {
  composeCooldownReason,
  createSeed,
  deriveBubbles,
  getStreetMine,
  isDemoPersona,
  omitTruePresence,
  RESIDENT_LULU,
  validateShortPost,
  type ApiErrorBody,
  type MeResponse,
  type NeighborhoodView,
  type ObserverResident,
  type Post,
  type ResidentPostsResponse,
  type SeedWorld,
  type StreetMineResponse,
} from "@pixel-valley/domain";
import {
  createDemoAccounts,
  personaSession,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  toAccountPublic,
  type SessionRecord,
} from "./accounts.ts";

type AppEnv = {
  Variables: {
    session: SessionRecord;
  };
};

function errorBody(code: string, message: string): ApiErrorBody {
  return { error: { code, message } };
}

function cookieSecure(): boolean {
  return process.env.NODE_ENV === "production";
}

export type AppClock = {
  now: () => Date;
};

export function createApp(now: Date = new Date(), clock: AppClock = { now: () => new Date() }) {
  const world: SeedWorld = createSeed(now);
  const accounts = createDemoAccounts(world.residents[0]?.createdAt ?? now.toISOString());
  const sessions = new Map<string, SessionRecord>();

  const app = new Hono<AppEnv>();

  const requireSession = async (c: Context<AppEnv>, next: Next) => {
    const token = getCookie(c, SESSION_COOKIE);
    const session = token ? sessions.get(token) : undefined;
    if (!session) {
      return c.json(errorBody("unauthenticated", "请先登录"), 401);
    }
    c.set("session", session);
    await next();
  };

  app.post("/api/auth/demo", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(errorBody("validation_error", "请求读不出来"), 400);
    }
    const persona =
      typeof body === "object" && body !== null && "persona" in body
        ? (body as { persona: unknown }).persona
        : undefined;
    if (!isDemoPersona(persona)) {
      return c.json(errorBody("validation_error", "只能以林或你的身份进镇"), 400);
    }

    const record = personaSession(persona);
    const token = crypto.randomUUID();
    sessions.set(token, record);
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
      secure: cookieSecure(),
    });

    const resident = world.residents.find((entry) => entry.id === record.residentId);
    const account = accounts.find((entry) => entry.id === record.accountId);
    if (!resident || !account) {
      return c.json(errorBody("not_found", "这扇门暂时打不开"), 404);
    }

    const payload: MeResponse = {
      resident,
      account: toAccountPublic(account),
      unreadTotal: 0,
    };
    return c.json(payload);
  });

  app.post("/api/auth/logout", async (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) {
      sessions.delete(token);
    }
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.body(null, 204);
  });

  app.get("/api/me", requireSession, (c) => {
    const session = c.get("session");
    const resident = world.residents.find((entry) => entry.id === session.residentId);
    const account = accounts.find((entry) => entry.id === session.accountId);
    if (!resident || !account) {
      return c.json(errorBody("unauthenticated", "请先登录"), 401);
    }
    const payload: MeResponse = {
      resident,
      account: toAccountPublic(account),
      unreadTotal: 0,
    };
    return c.json(payload);
  });

  app.get("/api/street/mine", requireSession, (c) => {
    const session = c.get("session");
    let slots;
    try {
      slots = getStreetMine(world, session.residentId, now);
    } catch {
      return c.json(errorBody("not_found", "这条街暂时走不出去"), 404);
    }

    const me = world.residents.find((entry) => entry.id === session.residentId);
    const neighborhood = world.neighborhoods.find((entry) => entry.id === me?.homeNeighborhoodId);
    if (!me || !neighborhood) {
      return c.json(errorBody("not_found", "这条街暂时走不出去"), 404);
    }

    const residentIds = new Set(
      slots.map((slot) => slot.residentId).filter((id): id is string => typeof id === "string"),
    );
    const houseIds = new Set(
      slots.map((slot) => slot.houseId).filter((id): id is string => typeof id === "string"),
    );

    const payload: StreetMineResponse = {
      neighborhood,
      slots,
      residents: world.residents.filter((resident) => residentIds.has(resident.id)).map(omitTruePresence),
      houses: world.houses.filter((house) => houseIds.has(house.id)),
      bubbles: deriveBubbles(world.posts, now, residentIds),
    };
    return c.json(payload);
  });

  app.get("/api/neighborhoods/:id", requireSession, (c) => {
    const neighborhood = world.neighborhoods.find((entry) => entry.id === c.req.param("id"));
    if (!neighborhood) {
      return c.json(errorBody("not_found", "找不到这条街"), 404);
    }

    const tiles = world.tiles.filter((tile) => tile.neighborhoodId === neighborhood.id);
    const houses = world.houses.filter((house) => house.neighborhoodId === neighborhood.id);
    const residentIds = new Set(houses.map((house) => house.residentId));
    if (neighborhood.kind === "residential") {
      residentIds.add(RESIDENT_LULU);
    }

    const payload: NeighborhoodView = {
      neighborhood,
      tiles,
      houses,
      residents: world.residents.filter((resident) => residentIds.has(resident.id)).map(omitTruePresence),
      bubbles: deriveBubbles(world.posts, now, residentIds),
    };
    return c.json(payload);
  });

  app.get("/api/residents/:id/posts", requireSession, (c) => {
    const id = c.req.param("id");
    const exists = world.residents.some((entry) => entry.id === id);
    if (!exists) {
      return c.json(errorBody("not_found", "找不到这家"), 404);
    }

    const sorted = world.posts
      .filter((post) => post.authorResidentId === id && post.deletedAt === null)
      .sort((a, b) => {
        if (a.createdAt !== b.createdAt) {
          return a.createdAt < b.createdAt ? 1 : -1;
        }
        return a.id < b.id ? 1 : -1;
      });

    const cursor = c.req.query("cursor");
    let from = 0;
    if (cursor) {
      const index = sorted.findIndex((post) => post.id === cursor);
      from = index === -1 ? sorted.length : index + 1;
    }
    const pageSize = 20;
    const page = sorted.slice(from, from + pageSize);
    const last = page[page.length - 1];
    const payload: ResidentPostsResponse = {
      posts: page,
      nextCursor: last && from + pageSize < sorted.length ? last.id : null,
    };
    return c.json(payload);
  });

  app.get("/api/residents/:id", requireSession, (c) => {
    const resident = world.residents.find((entry) => entry.id === c.req.param("id"));
    if (!resident) {
      return c.json(errorBody("not_found", "找不到这家"), 404);
    }
    const payload: ObserverResident = omitTruePresence(resident);
    return c.json(payload);
  });

  app.post("/api/posts", requireSession, async (c) => {
    const session = c.get("session");
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(errorBody("validation_error", "请求读不出来"), 400);
    }

    const record =
      typeof body === "object" && body !== null
        ? (body as { content?: unknown; tag?: unknown })
        : null;
    if (!record) {
      return c.json(errorBody("validation_error", "先写一句"), 400);
    }

    const parsed = validateShortPost({ content: record.content, tag: record.tag });
    if (!parsed.ok) {
      return c.json(errorBody("validation_error", parsed.message), 400);
    }

    const resident = world.residents.find((entry) => entry.id === session.residentId);
    if (!resident) {
      return c.json(errorBody("unauthenticated", "请先登录"), 401);
    }

    const at = clock.now();
    if (composeCooldownReason(
      world.posts.filter((post) => post.authorResidentId === resident.id),
      at,
    )) {
      return c.json(errorBody("compose_cooldown", "先歇一口气再写"), 429);
    }

    const post: Post = {
      id: crypto.randomUUID(),
      authorResidentId: resident.id,
      type: "post",
      title: null,
      content: parsed.content,
      visibility: "public",
      createdAt: at.toISOString(),
      editedAt: null,
      deletedAt: null,
      replyCount: 0,
      reactionCount: 0,
      tags: parsed.tag ? [parsed.tag] : [],
      flags: { hot: false, pinned: false, aiGenerated: false },
    };
    world.posts.push(post);
    if (resident.onboarding.firstPostAt === null) {
      resident.onboarding = { firstPostAt: post.createdAt };
    }
    return c.json(post, 201);
  });

  app.get("/api/posts/:id", requireSession, (c) => {
    const post = world.posts.find((entry) => entry.id === c.req.param("id") && entry.deletedAt === null);
    if (!post) {
      return c.json(errorBody("not_found", "找不到这条帖"), 404);
    }
    const author = world.residents.find((entry) => entry.id === post.authorResidentId);
    return c.json({
      post,
      author: author ? omitTruePresence(author) : null,
    });
  });

  return app;
}
