import type { Context } from "hono";
import type { ApiErrorBody } from "@pixel-valley/domain";

export function errorBody(code: string, message: string): ApiErrorBody {
  return { error: { code, message } };
}

export function cookieSecure(): boolean {
  return process.env.NODE_ENV === "production";
}

export function clientIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "local";
  }
  return c.req.header("x-real-ip") || "local";
}

export async function readJson(c: Context): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return { ok: true, value: await c.req.json() };
  } catch {
    return { ok: false };
  }
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
