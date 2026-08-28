import type {
  ApiErrorBody,
  ClosedTag,
  Conversation,
  DemoPersona,
  MeResponse,
  NeighborEdge,
  NeighborhoodView,
  ObserverResident,
  Post,
  Reply,
  ResidentHomeResponse,
  ResidentPostsResponse,
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

export function fetchResidentHome(id: string): Promise<ResidentHomeResponse> {
  return apiRequest<ResidentHomeResponse>(`/api/residents/${id}`);
}

/** Convenience unwrap: most callers only need the nameplate/presence fields. */
export async function fetchResident(id: string): Promise<ObserverResident> {
  return (await fetchResidentHome(id)).resident;
}

export function fetchResidentPosts(id: string, cursor?: string): Promise<ResidentPostsResponse> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return apiRequest<ResidentPostsResponse>(`/api/residents/${id}/posts${query}`);
}

export function createPost(input: { content: string; tag?: ClosedTag | null }): Promise<Post> {
  const body: { content: string; tag?: ClosedTag } = { content: input.content };
  if (input.tag) {
    body.tag = input.tag;
  }
  return apiRequest<Post>("/api/posts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function fetchPost(
  id: string,
): Promise<{ post: Post; author: ObserverResident | null; replies: Reply[] }> {
  return apiRequest(`/api/posts/${id}`);
}

export function addNeighborEdge(toResidentId: string): Promise<NeighborEdge> {
  return apiRequest<NeighborEdge>("/api/neighbor-edges", {
    method: "POST",
    body: JSON.stringify({ toResidentId }),
  });
}

export function removeNeighborEdge(toResidentId: string): Promise<void> {
  return apiRequest<void>(`/api/neighbor-edges/${toResidentId}`, { method: "DELETE" });
}

/** §3.5: analytics only. The host never sees a visitor list. */
export function recordVisit(hostResidentId: string): Promise<void> {
  return apiRequest<void>("/api/visits", {
    method: "POST",
    body: JSON.stringify({ hostResidentId }),
  });
}

export function openConversation(peerResidentId: string): Promise<Conversation> {
  return apiRequest<Conversation>("/api/conversations", {
    method: "POST",
    body: JSON.stringify({ peerResidentId }),
  });
}
