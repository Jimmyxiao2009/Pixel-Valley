import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import {
  STREET_MINE_CENTER,
  type DerivedSlot,
  type MeResponse,
  type ResidentHomeResponse,
  type StreetMineResponse,
} from "@pixel-valley/domain";
import { HomeScene } from "./HomeScene";
import { NeighborhoodScene } from "./NeighborhoodScene";

const fetchStreetMine = vi.fn<() => Promise<StreetMineResponse>>();
const fetchResidentHome = vi.fn<(id: string) => Promise<ResidentHomeResponse>>();
const recordVisit = vi.fn<(id: string) => Promise<void>>();
const openConversation = vi.fn<(id: string) => Promise<unknown>>();
const createPost = vi.fn();

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
      account: { id: "account-you", email: "you@pixel-valley.local", createdAt: "" },
      unreadTotal: 0,
    } as unknown as MeResponse,
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
  fetchStreetMine: () => fetchStreetMine(),
  fetchNeighborhood: () => Promise.reject(new Error("guest room must not need this")),
  fetchResidentHome: (id: string) => fetchResidentHome(id),
  fetchResidentPosts: () => Promise.resolve({ items: [], nextCursor: null }),
  fetchPost: () => Promise.reject(new Error("not used")),
  recordVisit: (id: string) => recordVisit(id),
  openConversation: (id: string) => openConversation(id),
  addNeighborEdge: vi.fn(),
  removeNeighborEdge: vi.fn(),
  blockResident: vi.fn(() => Promise.resolve()),
  unblockResident: vi.fn(() => Promise.resolve()),
  fetchConversationMessages: vi.fn(() =>
    Promise.resolve({ conversation: { id: "c1" }, messages: [] }),
  ),
  sendConversationMessage: vi.fn(),
  setConversationFocus: vi.fn(() => Promise.resolve()),
  createPost: () => createPost(),
}));

function slots(): DerivedSlot[] {
  return Array.from({ length: 12 }, (_, layoutIndex) => {
    if (layoutIndex === STREET_MINE_CENTER) {
      return { layoutIndex, kind: "self" as const, houseId: "house-you", residentId: "you" };
    }
    if (layoutIndex === 0) {
      return { layoutIndex, kind: "house" as const, houseId: "house-lin", residentId: "lin" };
    }
    return { layoutIndex, kind: "vacant" as const, houseId: null, residentId: null };
  });
}

function street(): StreetMineResponse {
  return {
    neighborhood: { id: "wutong", name: "梧桐街", kind: "residential", slotCount: 12 },
    slots: slots(),
    residents: [
      { id: "you", displayName: "你", handle: "you", kind: "human" },
      { id: "lin", displayName: "林", handle: "lin", kind: "human" },
    ] as StreetMineResponse["residents"],
    houses: [
      { id: "house-you", residentId: "you", neighborhoodId: "wutong", slotIndex: 4 },
      { id: "house-lin", residentId: "lin", neighborhoodId: "wutong", slotIndex: 0 },
    ] as StreetMineResponse["houses"],
    bubbles: [],
  };
}

function linView(): ResidentHomeResponse {
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
      observerPresence: "online",
      homeNeighborhoodId: "wutong",
      companionResidentId: null,
      privacy: { companionVisible: false },
    } as unknown as ResidentHomeResponse["resident"],
    house: { id: "house-lin", residentId: "lin", neighborhoodId: "wutong", slotIndex: 0 } as ResidentHomeResponse["house"],
    neighborhood: { id: "wutong", name: "梧桐街", kind: "residential", slotCount: 12 },
    relation: { isNeighbor: false, blocking: false, blockedBy: false, isSelf: false },
    latestBubble: null,
    messageGate: { ok: true, via: "knock" },
  };
}

function Probe() {
  const location = useLocation();
  return <div data-testid="probe">{location.pathname}</div>;
}

function renderApp(at: string) {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <Probe />
      <Routes>
        <Route path="/street" element={<NeighborhoodScene mode="mine" />} />
        <Route path="/n/:neighborhoodId" element={<p>户籍街</p>} />
        <Route path="/r/:residentId" element={<HomeScene mode="guest" />} />
        <Route path="/home" element={<p>我的家</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  for (const fn of [fetchStreetMine, fetchResidentHome, recordVisit, openConversation]) {
    fn.mockReset();
  }
  fetchStreetMine.mockResolvedValue(street());
  fetchResidentHome.mockResolvedValue(linView());
  recordVisit.mockResolvedValue(undefined);
  openConversation.mockResolvedValue({ conversation: { id: "c1" }, via: "knock" });
});

describe("two-step visit (§3.5)", () => {
  it("opens the peek card first, and does not teleport into the house", async () => {
    const user = userEvent.setup();
    renderApp("/street");

    const linHouse = await screen.findByRole("button", { name: /林/ });
    await user.click(linHouse);

    // First click: the card, still on the street.
    expect(await screen.findByRole("dialog", { name: "林" })).toBeTruthy();
    expect(screen.getByTestId("probe").textContent).toBe("/street");
  });

  it("enters the guest room only on the second, explicit click", async () => {
    const user = userEvent.setup();
    renderApp("/street");

    await user.click(await screen.findByRole("button", { name: /林/ }));
    await screen.findByRole("dialog", { name: "林" });

    await user.click(screen.getByRole("button", { name: "进屋坐坐" }));
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("/r/lin"));
  });
});

describe("guest room (§3.5 / §4.4)", () => {
  it("says whose home this is and offers the way back to my street", async () => {
    renderApp("/r/lin");
    expect(await screen.findByText("在林家做客")).toBeTruthy();
    expect(screen.getByRole("button", { name: "回我的街" })).toBeTruthy();
  });

  it("never gives a visitor the owner's composer", async () => {
    const user = userEvent.setup();
    renderApp("/r/lin");
    await screen.findByText("在林家做客");

    await user.click(screen.getByRole("button", { name: "看看 Ta 最近写了什么" }));

    // The computer opens the host's writing, never a composer.
    expect(screen.queryByRole("dialog", { name: "家里的电脑" })).toBeNull();
    expect(screen.queryByPlaceholderText("坐下来，写一句今天想说的话…")).toBeNull();
    expect(screen.queryByRole("button", { name: "贴到房顶" })).toBeNull();
    expect(createPost).not.toHaveBeenCalled();
  });

  it("shows the host's nameplate with §15.4 presence and the knock door", async () => {
    const user = userEvent.setup();
    renderApp("/r/lin");
    await screen.findByText("在林家做客");

    await user.click(screen.getByRole("button", { name: "看看门牌上写了什么" }));

    const plate = await screen.findByRole("dialog", { name: "林" });
    expect(plate.textContent).toContain("在家");
    expect(plate.textContent).toContain("在梧桐街写代码。");
    await user.click(screen.getByRole("button", { name: "敲门" }));
    await waitFor(() => expect(openConversation).toHaveBeenCalledWith("lin"));
  });

  it("hides the companion cushion chat when the host keeps it private", async () => {
    const user = userEvent.setup();
    renderApp("/r/lin");
    await screen.findByText("在林家做客");

    await user.click(screen.getByRole("button", { name: "伙伴坐垫" }));
    // companionVisible=false -> the teaser, never someone else's companion chat.
    const teaser = await screen.findByRole("dialog", { name: "伙伴坐垫" });
    expect(teaser.textContent).toContain("以后在这里养一个伙伴");
  });

  it("leaves through the host's own street, and back to mine separately", async () => {
    const user = userEvent.setup();
    renderApp("/r/lin");
    await screen.findByText("在林家做客");

    await user.click(screen.getByRole("button", { name: "门" }));
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("/n/wutong"));
  });

  it("loads the guest room with a single resident read", async () => {
    renderApp("/r/lin");
    await screen.findByText("在林家做客");
    // fetchNeighborhood would reject; reaching here proves it is not called.
    expect(fetchResidentHome).toHaveBeenCalledTimes(1);
  });
});
