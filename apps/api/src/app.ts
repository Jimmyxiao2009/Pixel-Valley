import { Hono } from "hono";
import type { Context, Next } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import {
  createSeed,
  deriveBubbles,
  getStreetMine,
  isDemoPersona,
  omitTruePresence,
  RESIDENT_LULU,
  type ApiErrorBody,
  type MeResponse,
  type NeighborhoodView,
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

export function createApp(now: Date = new Date()) {
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
