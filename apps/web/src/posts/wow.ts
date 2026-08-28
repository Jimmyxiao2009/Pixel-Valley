import type { MeResponse, Post } from "@pixel-valley/domain";

/**
 * §3.1.A.4 / §3.2: publishing auto-opens the door to /street exactly once,
 * for the post that the server recorded as this resident's first.
 *
 * The decision reads server truth only: POST /api/posts sets
 * onboarding.firstPostAt to the created post's createdAt, so the session
 * refreshed *after* publishing points at this post iff it was the first.
 * Deciding from the pre-publish client state instead would race with the
 * refresh, and would fire again on a page that had a stale session.
 */
export function isFirstPostWow(session: MeResponse | null, post: Post): boolean {
  const firstPostAt = session?.resident.onboarding.firstPostAt;
  if (!firstPostAt) {
    return false;
  }
  return firstPostAt === post.createdAt;
}

/** Router state carried from the composer to the street, per §3.1 wow. */
export type WowNavState = { wow?: boolean };

export function wowNavState(): WowNavState {
  return { wow: true };
}

export function readWowNavState(state: unknown): boolean {
  return typeof state === "object" && state !== null && (state as WowNavState).wow === true;
}
