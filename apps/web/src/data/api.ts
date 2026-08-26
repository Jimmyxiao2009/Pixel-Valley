import type {
  ApiErrorBody,
  DemoPersona,
  MeResponse,
  NeighborhoodView,
  ObserverResident,
  Post,
  StreetMineResponse,
} from "@pixel-valley/domain";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "include",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const body = json as ApiErrorBody | null;
    throw new ApiError(
      body?.error.code ?? "unauthenticated",
      body?.error.message ?? "这扇门暂时打不开",
      response.status,
    );
  }
  return json as T;
}

export function fetchMe(): Promise<MeResponse> {
  return apiRequest<MeResponse>("/api/me");
}

export function demoLogin(persona: DemoPersona): Promise<MeResponse> {
  return apiRequest<MeResponse>("/api/auth/demo", {
    method: "POST",
    body: JSON.stringify({ persona }),
  });
}

export function logout(): Promise<void> {
  return apiRequest<void>("/api/auth/logout", { method: "POST" });
}

export function fetchStreetMine(): Promise<StreetMineResponse> {
  return apiRequest<StreetMineResponse>("/api/street/mine");
}

export function fetchNeighborhood(id: string): Promise<NeighborhoodView> {
  return apiRequest<NeighborhoodView>(`/api/neighborhoods/${id}`);
}

export function fetchPost(id: string): Promise<{ post: Post; author: ObserverResident | null }> {
  return apiRequest(`/api/posts/${id}`);
}
