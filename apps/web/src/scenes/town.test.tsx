import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { FeedPost, MeResponse } from "@pixel-valley/domain";
import { TownScene } from "./TownScene";

type ZoneCall = { zone: string; sort?: string; cursor?: string };

const fetchTownZone = vi.fn<(zone: string, options?: Record<string, unknown>) => Promise<unknown>>();
const calls: ZoneCall[] = [];

vi.mock("../session/SessionProvider", () => ({
  useSession: () => ({
    status: "authenticated" as const,
    me: { resident: { id: "you" }, account: {}, unreadTotal: 0 } as unknown as MeResponse,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("../data/api", () => ({
  ApiError: class ApiError extends Error {
    code = "unknown";
    status = 500;
  },
  fetchTownZone: (zone: string, options?: Record<string, unknown>) => fetchTownZone(zone, options),
  fetchPost: vi.fn(() =>
    Promise.resolve({ post: { content: "帖子全文在这里" }, author: null, replies: [] }),
  ),
  fetchResidentHome: vi.fn(() =>
    Promise.resolve({
      resident: {
        id: "lin",
        displayName: "林",
        handle: "lin",
        kind: "human",
        aiRole: null,
        bio: "",
        interests: [],
        avatarSprite: "lin",
        observerPresence: "online",
      },
      house: null,
      neighborhood: null,
      relation: { isNeighbor: false, blocking: false, blockedBy: false, isSelf: false },
      latestBubble: null,
      messageGate: { ok: true, via: "knock" },
    }),
  ),
  addNeighborEdge: vi.fn(),
  removeNeighborEdge: vi.fn(),
  recordVisit: vi.fn(() => Promise.resolve()),
  openConversation: vi.fn(),
  blockResident: vi.fn(),
  unblockResident: vi.fn(),
  fetchConversationMessages: vi.fn(() => Promise.resolve({ conversation: {}, messages: [] })),
  sendConversationMessage: vi.fn(),
  setConversationFocus: vi.fn(() => Promise.resolve()),
}));

function post(id: string, overrides: Partial<FeedPost> = {}): FeedPost {
  return {
    id,
    authorResidentId: "lin",
    type: "post",
    title: null,
    content: `${id} 的正文`,
    visibility: "public",
    createdAt: new Date(Date.now() - 3_600_000).toISOString(),
    editedAt: null,
    deletedAt: null,
    replyCount: 2,
    reactionCount: 5,
    tags: ["技术"],
    flags: { hot: false, pinned: false, aiGenerated: false },
    excerpt: `${id} 的摘要`,
    author: {
      id: "lin",
      displayName: "林",
      handle: "lin",
      kind: "human",
      observerPresence: "online",
    },
    ...overrides,
  } as FeedPost;
}

function page(items: FeedPost[], nextCursor: string | null = null) {
  return { items, nextCursor };
}

function Probe() {
  const location = useLocation();
  return <div data-testid="probe">{`${location.pathname}${location.search}`}</div>;
}

function renderTown(at = "/town/plaza") {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <Probe />
      <Routes>
        <Route path="/town/:zone" element={<TownScene />} />
        <Route path="/street" element={<p>我的街</p>} />
        <Route path="/home" element={<p>我的家</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  calls.length = 0;
  fetchTownZone.mockReset();
  fetchTownZone.mockImplementation((zone: string, options?: Record<string, unknown>) => {
    calls.push({
      zone,
      sort: options?.sort as string | undefined,
      cursor: options?.cursor as string | undefined,
    });
    if (zone === "board") {
      return Promise.resolve({ pinned: [], topics: [], latest: page([post("b1")]) });
    }
    if (zone === "cafe") {
      return Promise.resolve({ ...page([post("c1")]), writingCount: 2 });
    }
    return Promise.resolve(page([post(`${zone}-1`)]));
  });
});

describe("town zones (§4.10)", () => {
  it("requests the endpoint for the zone in the URL", async () => {
    renderTown("/town/library");
    await waitFor(() => expect(calls[0]?.zone).toBe("library"));
    expect(await screen.findByRole("heading", { name: "图书馆" })).toBeTruthy();
    expect(screen.getByText("适合坐下看完的文字")).toBeTruthy();
  });

  it.each([
    ["plaza", "广场", "大家都把话带到镇上的地方"],
    ["board", "公告栏", "最近风往哪吹"],
    ["library", "图书馆", "适合坐下看完的文字"],
    ["cafe", "咖啡馆", "正在发生的闲聊"],
  ])("renders %s with the doc's title and tagline", async (zone, title, tagline) => {
    renderTown(`/town/${zone}`);
    expect(await screen.findByRole("heading", { name: title })).toBeTruthy();
    expect(screen.getByText(tagline)).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/的摘要/)).toBeTruthy());
  });

  it("marks the current building for assistive tech, not just colour", async () => {
    renderTown("/town/cafe");
    const current = await screen.findByRole("link", { current: "page" });
    expect(current.textContent).toContain("咖啡馆");
  });

  it("navigates zones from the skyline and keeps the URL as the truth", async () => {
    const user = userEvent.setup();
    renderTown("/town/plaza");
    await screen.findByRole("heading", { name: "广场" });

    await user.click(screen.getByRole("link", { name: /图书馆/ }));

    await waitFor(() => expect(screen.getByTestId("probe").textContent).toContain("/town/library"));
    await waitFor(() => expect(calls.some((call) => call.zone === "library")).toBe(true));
  });

  it("redirects an unknown zone to the plaza", async () => {
    renderTown("/town/sewers");
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toContain("/town/plaza"));
  });

  it("puts the sort in the URL and refetches", async () => {
    const user = userEvent.setup();
    renderTown("/town/plaza");
    await screen.findByRole("heading", { name: "广场" });

    await user.click(screen.getByRole("tab", { name: "最新" }));

    await waitFor(() => expect(screen.getByTestId("probe").textContent).toContain("sort=latest"));
    await waitFor(() => expect(calls.some((call) => call.sort === "latest")).toBe(true));
  });

  it("shows the cafe's writing count", async () => {
    renderTown("/town/cafe");
    expect(await screen.findByText("正在写字 2 人")).toBeTruthy();
  });
});

describe("feed states", () => {
  it("announces loading", async () => {
    let release: (value: unknown) => void = () => {};
    fetchTownZone.mockReturnValue(new Promise((resolve) => (release = resolve)));
    renderTown();
    expect(screen.getByRole("status")).toBeTruthy();
    release(page([]));
  });

  it("shows an empty zone in small-town words", async () => {
    fetchTownZone.mockResolvedValue(page([]));
    renderTown("/town/cafe");
    expect(await screen.findByText("炉子还温着，等第一句话")).toBeTruthy();
  });

  it("offers a keyboard retry after a failure", async () => {
    fetchTownZone.mockRejectedValueOnce(new Error("offline"));
    fetchTownZone.mockResolvedValue(page([post("p1")]));
    const user = userEvent.setup();
    renderTown();

    expect(await screen.findByRole("alert")).toBeTruthy();
    const retry = screen.getByRole("button", { name: "再试一次" });
    retry.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByText("p1 的摘要")).toBeTruthy();
  });

  it("keeps the skyline usable while the feed is broken", async () => {
    fetchTownZone.mockRejectedValue(new Error("offline"));
    renderTown();
    await screen.findByRole("alert");
    expect(screen.getByRole("link", { name: /图书馆/ })).toBeTruthy();
  });

  it("drops a stale zone's answer instead of overwriting the new one", async () => {
    let releasePlaza: (value: unknown) => void = () => {};
    fetchTownZone.mockImplementation((zone: string) => {
      if (zone === "plaza") {
        return new Promise((resolve) => (releasePlaza = resolve));
      }
      return Promise.resolve(page([post("cafe-1")]));
    });

    const user = userEvent.setup();
    renderTown("/town/plaza");
    await user.click(screen.getByRole("link", { name: /咖啡馆/ }));
    expect(await screen.findByText("cafe-1 的摘要")).toBeTruthy();

    // The slow plaza finally answers — it must not land on the cafe.
    releasePlaza(page([post("plaza-late")]));
    await waitFor(() => expect(screen.queryByText("plaza-late 的摘要")).toBeNull());
    expect(screen.getByText("cafe-1 的摘要")).toBeTruthy();
  });
});

describe("paging", () => {
  it("appends the next page without duplicating", async () => {
    fetchTownZone.mockImplementation((_zone: string, options?: Record<string, unknown>) =>
      Promise.resolve(
        options?.cursor
          ? page([post("p1"), post("p2")])
          : page([post("p1")], "cursor-1"),
      ),
    );
    const user = userEvent.setup();
    renderTown();

    await user.click(await screen.findByRole("button", { name: "再看看" }));

    await waitFor(() => expect(screen.getByText("p2 的摘要")).toBeTruthy());
    expect(screen.getAllByText("p1 的摘要")).toHaveLength(1);
  });

  it("keeps what is on screen when the next page fails", async () => {
    fetchTownZone.mockImplementation((_zone: string, options?: Record<string, unknown>) =>
      options?.cursor
        ? Promise.reject(new Error("offline"))
        : Promise.resolve(page([post("p1")], "cursor-1")),
    );
    const user = userEvent.setup();
    renderTown();

    await user.click(await screen.findByRole("button", { name: "再看看" }));

    expect(await screen.findByText("后面的话没跟上来。")).toBeTruthy();
    expect(screen.getByText("p1 的摘要")).toBeTruthy();
  });

  it("resets paging when the zone changes", async () => {
    fetchTownZone.mockImplementation((zone: string, options?: Record<string, unknown>) => {
      calls.push({ zone, cursor: options?.cursor as string | undefined });
      return Promise.resolve(page([post(`${zone}-1`)], zone === "plaza" ? "cursor-1" : null));
    });
    const user = userEvent.setup();
    renderTown("/town/plaza");
    await screen.findByRole("button", { name: "再看看" });

    await user.click(screen.getByRole("link", { name: /咖啡馆/ }));

    await waitFor(() => expect(screen.getByText("cafe-1 的摘要")).toBeTruthy());
    // The cafe has no next page, so the button is gone rather than carrying
    // the plaza's cursor.
    expect(screen.queryByRole("button", { name: "再看看" })).toBeNull();
  });
});

describe("feed cards", () => {
  it("shows the author, presence, tag and counts", async () => {
    renderTown();
    const card = await screen.findByRole("article", { name: "林的帖子" });
    expect(within(card).getByRole("button", { name: "林，人类居民" })).toBeTruthy();
    expect(within(card).getByText("在家")).toBeTruthy();
    expect(within(card).getByText("技术")).toBeTruthy();
    expect(within(card).getByText("2 回复")).toBeTruthy();
    expect(within(card).getByText("5 拍一拍")).toBeTruthy();
  });

  it("identifies an AI author with the ◇ badge and the words", async () => {
    fetchTownZone.mockResolvedValue(
      page([
        post("ai1", {
          author: {
            id: "nanfeng",
            displayName: "南风",
            handle: "nanfeng",
            kind: "ai",
            aiRole: "librarian",
            observerPresence: "online",
          },
        }),
      ]),
    );
    renderTown();
    const card = await screen.findByRole("article", { name: "南风的帖子" });
    expect(within(card).getByText("AI 居民")).toBeTruthy();
    // §6.3: a public-service AI reads as on duty.
    expect(within(card).getByText("在岗")).toBeTruthy();
  });

  it("opens the shared PostDetailSheet on the post", async () => {
    const user = userEvent.setup();
    renderTown();
    await user.click(await screen.findByText("plaza-1 的摘要"));
    expect(await screen.findByText("帖子全文在这里")).toBeTruthy();
  });

  it("opens the shared ResidentPeekCard on the author", async () => {
    const user = userEvent.setup();
    renderTown();
    await user.click(await screen.findByRole("button", { name: "林，人类居民" }));
    // Same two-step visit as the street: the card, not a jump into the house.
    expect(await screen.findByRole("dialog", { name: "林" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "进屋坐坐" })).toBeTruthy();
  });
});
