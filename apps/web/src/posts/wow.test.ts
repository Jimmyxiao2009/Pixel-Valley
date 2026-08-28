import { describe, expect, it } from "vitest";
import type { MeResponse, Post, Resident } from "@pixel-valley/domain";
import { isFirstPostWow, readWowNavState, wowNavState } from "./wow";

const FIRST_AT = "2026-08-26T12:00:00.000Z";
const LATER_AT = "2026-08-26T12:05:00.000Z";

function post(createdAt: string, id = "p1"): Post {
  return {
    id,
    authorResidentId: "you",
    type: "post",
    title: null,
    content: "今晚灯很暖",
    visibility: "public",
    createdAt,
    editedAt: null,
    deletedAt: null,
    replyCount: 0,
    reactionCount: 0,
    tags: [],
    flags: { hot: false, pinned: false, aiGenerated: false },
  };
}

function session(firstPostAt: string | null): MeResponse {
  return {
    resident: { onboarding: { firstPostAt } } as Resident,
    account: { id: "account-you", email: "you@pixel-valley.local", createdAt: FIRST_AT },
    unreadTotal: 0,
  };
}

describe("isFirstPostWow", () => {
  it("fires for the post the server recorded as the first", () => {
    expect(isFirstPostWow(session(FIRST_AT), post(FIRST_AT))).toBe(true);
  });

  it("does not fire for later posts once onboarding is done", () => {
    expect(isFirstPostWow(session(FIRST_AT), post(LATER_AT))).toBe(false);
  });

  it("does not fire when the server never recorded a first post", () => {
    expect(isFirstPostWow(session(null), post(FIRST_AT))).toBe(false);
  });

  it("does not fire without a session", () => {
    expect(isFirstPostWow(null, post(FIRST_AT))).toBe(false);
  });
});

describe("wow nav state", () => {
  it("round-trips", () => {
    expect(readWowNavState(wowNavState())).toBe(true);
  });

  it("rejects anything else", () => {
    for (const value of [null, undefined, {}, { wow: false }, "wow", 1]) {
      expect(readWowNavState(value)).toBe(false);
    }
  });
});
