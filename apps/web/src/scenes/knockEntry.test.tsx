import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { MeResponse, Message, ResidentHomeResponse } from "@pixel-valley/domain";
import { HomeScene } from "./HomeScene";
import { PeekCardHost } from "../residents/PeekCardHost";

const openConversation =
  vi.fn<(id: string) => Promise<{ conversation: { id: string }; via: "knock" | "note" }>>();
const fetchResidentHome = vi.fn<(id: string) => Promise<ResidentHomeResponse>>();
const fetchConversationMessages =
  vi.fn<(id: string) => Promise<{ conversation: unknown; messages: Message[] }>>();
const setConversationFocus = vi.fn<(id: string, open: boolean) => Promise<void>>();

vi.mock("../data/api", () => ({
  ApiError: class ApiError extends Error {
    code: string;
    status: number;
    constructor(code: string, status = 403) {
      super(code);
      this.code = code;
      this.status = status;
    }
  },
  openConversation: (id: string) => openConversation(id),
  fetchResidentHome: (id: string) => fetchResidentHome(id),
  fetchConversationMessages: (id: string) => fetchConversationMessages(id),
  setConversationFocus: (id: string, open: boolean) => setConversationFocus(id, open),
  sendConversationMessage: vi.fn(),
  fetchNeighborhood: () => Promise.resolve({ neighborhood: { name: "梧桐街" } }),
  fetchResidentPosts: () => Promise.resolve({ items: [], nextCursor: null }),
  recordVisit: vi.fn(() => Promise.resolve()),
  addNeighborEdge: vi.fn(),
  removeNeighborEdge: vi.fn(),
  blockResident: vi.fn(() => Promise.resolve()),
  unblockResident: vi.fn(() => Promise.resolve()),
  createPost: vi.fn(),
}));

vi.mock("../session/SessionProvider", () => ({
  useSession: () => ({
    status: "authenticated" as const,
    me: {
      resident: {
        id: "you",
        displayName: "你",
        homeNeighborhoodId: "wutong",
        companionResidentId: "doumiao",
        onboarding: { firstPostAt: "2026-08-26T11:00:00.000Z" },
      },
      account: { id: "account-you", email: "", createdAt: "" },
      unreadTotal: 0,
    } as unknown as MeResponse,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  }),
}));

/** The one thread every entry point must land in. */
const THREAD_ID = "c-you-lin";

function linView(gate: ResidentHomeResponse["messageGate"]): ResidentHomeResponse {
  return {
    resident: {
      id: "lin",
      displayName: "林",
      handle: "lin",
      kind: "human",
      aiRole: null,
      bio: "在梧桐街写代码。",
      interests: ["Rust"],
      avatarSprite: "lin-1",
      observerPresence: gate.ok && gate.via === "note" ? "offline" : "online",
      homeNeighborhoodId: "wutong",
      companionResidentId: null,
      privacy: { companionVisible: false },
    } as unknown as ResidentHomeResponse["resident"],
    house: null,
    neighborhood: { id: "wutong", name: "梧桐街", kind: "residential", slotCount: 12 },
    relation: {
      isNeighbor: false,
      blocking: false,
      blockedBy: !gate.ok,
      isSelf: false,
    },
    latestBubble: null,
    messageGate: gate,
  };
}

beforeEach(() => {
  for (const fn of [
    openConversation,
    fetchResidentHome,
    fetchConversationMessages,
    setConversationFocus,
  ]) {
    fn.mockReset();
  }
  openConversation.mockResolvedValue({ conversation: { id: THREAD_ID }, via: "knock" });
  fetchResidentHome.mockResolvedValue(linView({ ok: true, via: "knock" }));
  fetchConversationMessages.mockResolvedValue({ conversation: {}, messages: [] });
  setConversationFocus.mockResolvedValue(undefined);
});

function renderPeek() {
  return render(
    <MemoryRouter initialEntries={["/street"]}>
      <Routes>
        <Route path="/street" element={<PeekCardHost residentId="lin" onClose={vi.fn()} />} />
        <Route path="/r/:residentId" element={<HomeScene mode="guest" />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderGuestRoom() {
  return render(
    <MemoryRouter initialEntries={["/r/lin"]}>
      <Routes>
        <Route path="/r/:residentId" element={<HomeScene mode="guest" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("every social entry lands in one thread (KD-9)", () => {
  it("opens the real thread from the peek card", async () => {
    const user = userEvent.setup();
    renderPeek();

    await user.click(await screen.findByRole("button", { name: "敲门" }));

    await waitFor(() => expect(openConversation).toHaveBeenCalledWith("lin"));
    expect(await screen.findByRole("dialog", { name: "与林的对话" })).toBeTruthy();
    await waitFor(() => expect(fetchConversationMessages).toHaveBeenCalledWith(THREAD_ID));
  });

  it("opens the same thread from the guest room nameplate", async () => {
    const user = userEvent.setup();
    renderGuestRoom();

    await screen.findByText("在林家做客");
    await user.click(screen.getByRole("button", { name: "看看门牌上写了什么" }));
    await user.click(await screen.findByRole("button", { name: "敲门" }));

    await waitFor(() => expect(openConversation).toHaveBeenCalledWith("lin"));
    await waitFor(() => expect(fetchConversationMessages).toHaveBeenCalledWith(THREAD_ID));
  });

  it("routes a note into the same thread, only with the note skin", async () => {
    fetchResidentHome.mockResolvedValue(linView({ ok: true, via: "note" }));
    openConversation.mockResolvedValue({ conversation: { id: THREAD_ID }, via: "note" });
    const user = userEvent.setup();
    renderPeek();

    await user.click(await screen.findByRole("button", { name: "留一张纸条" }));

    await waitFor(() => expect(fetchConversationMessages).toHaveBeenCalledWith(THREAD_ID));
    // Same thread, different skin — no second data model for notes.
    expect(await screen.findByText("给林留一张纸条")).toBeTruthy();
    expect(screen.getByRole("button", { name: "夹进门缝" })).toBeTruthy();
  });

  it("opens the companion cushion as a real thread too", async () => {
    openConversation.mockResolvedValue({ conversation: { id: "c-doumiao" }, via: "knock" });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <Routes>
          <Route path="/home" element={<HomeScene />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "伙伴坐垫" }));

    await waitFor(() => expect(openConversation).toHaveBeenCalledWith("doumiao"));
    await waitFor(() => expect(fetchConversationMessages).toHaveBeenCalledWith("c-doumiao"));
  });

  it("opens no chat window at all when the gate refuses", async () => {
    fetchResidentHome.mockResolvedValue(linView({ ok: false, code: "blocked" }));
    renderPeek();

    await screen.findByRole("dialog", { name: "林" });
    // No knock button, and nothing created behind the scenes.
    expect(screen.queryByRole("button", { name: "敲门" })).toBeNull();
    expect(screen.queryByRole("button", { name: "留一张纸条" })).toBeNull();
    expect(openConversation).not.toHaveBeenCalled();
    expect(screen.getByText("这家谢绝访客")).toBeTruthy();
  });

  it("leaves no panel standing when the server refuses the open", async () => {
    openConversation.mockRejectedValue(
      Object.assign(new Error("blocked"), { code: "blocked", status: 403 }),
    );
    const user = userEvent.setup();
    renderPeek();

    await user.click(await screen.findByRole("button", { name: "敲门" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "与林的对话" })).toBeNull();
  });

  it("closes focus when the knock panel is dismissed", async () => {
    const user = userEvent.setup();
    renderPeek();

    await user.click(await screen.findByRole("button", { name: "敲门" }));
    await screen.findByRole("dialog", { name: "与林的对话" });
    await waitFor(() => expect(setConversationFocus).toHaveBeenCalledWith(THREAD_ID, true));

    await user.click(screen.getByRole("button", { name: "关上" }));
    await waitFor(() => expect(setConversationFocus).toHaveBeenCalledWith(THREAD_ID, false));
  });
});
