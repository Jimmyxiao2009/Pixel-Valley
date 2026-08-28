import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import type { MeResponse, ResidentHomeResponse } from "@pixel-valley/domain";
import { PeekCardHost } from "../residents/PeekCardHost";
import { PostDetailSheet } from "../map/PostDetailSheet";
import { HomeScene } from "./HomeScene";

const fetchResidentHome = vi.fn<(id: string) => Promise<ResidentHomeResponse>>();
const fetchPost = vi.fn();

vi.mock("../session/SessionProvider", () => ({
  useSession: () => ({
    status: "authenticated" as const,
    me: {
      resident: {
        id: "you",
        displayName: "你",
        homeNeighborhoodId: "huaihua",
        companionResidentId: null,
        onboarding: { firstPostAt: "2026-08-26T11:00:00.000Z" },
      },
      account: {},
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
  fetchResidentHome: (id: string) => fetchResidentHome(id),
  fetchPost: () => fetchPost(),
  fetchNeighborhood: vi.fn(),
  fetchResidentPosts: () => Promise.resolve({ items: [], nextCursor: null }),
  recordVisit: vi.fn(() => Promise.resolve()),
  addNeighborEdge: vi.fn(),
  removeNeighborEdge: vi.fn(),
  openConversation: vi.fn(),
  blockResident: vi.fn(),
  unblockResident: vi.fn(),
  fetchConversationMessages: vi.fn(),
  sendConversationMessage: vi.fn(),
  setConversationFocus: vi.fn(),
  createPost: vi.fn(),
}));

function linView(homeNeighborhoodId: string | null = "wutong"): ResidentHomeResponse {
  return {
    resident: {
      id: "lin",
      displayName: "林",
      handle: "lin",
      kind: "human",
      aiRole: null,
      bio: "在梧桐街写代码。",
      interests: ["Rust"],
      avatarSprite: "lin",
      observerPresence: "online",
      homeNeighborhoodId,
      companionResidentId: null,
      privacy: { companionVisible: false },
    } as unknown as ResidentHomeResponse["resident"],
    house: null,
    neighborhood: { id: "wutong", name: "梧桐街", kind: "residential", slotCount: 12 },
    relation: { isNeighbor: false, blocking: false, blockedBy: false, isSelf: false },
    latestBubble: null,
    messageGate: { ok: true, via: "knock" },
  };
}

function Probe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <div data-testid="probe">{`${location.pathname}${location.search}`}</div>
      {/* MemoryRouter keeps its own stack, so exercise back through the router. */}
      <button type="button" onClick={() => navigate(-1)}>
        浏览器后退
      </button>
    </>
  );
}

beforeEach(() => {
  fetchResidentHome.mockReset();
  fetchPost.mockReset();
  fetchResidentHome.mockResolvedValue(linView());
  fetchPost.mockResolvedValue({
    post: { content: "修好了那个折磨我一周的 bug" },
    author: { id: "lin", displayName: "林", homeNeighborhoodId: "wutong" },
    replies: [],
  });
});

describe("peek card → their doorstep (§3.10)", () => {
  it("goes to their canonical street with the focus query", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/town/plaza"]}>
        <Probe />
        <Routes>
          <Route
            path="/town/:zone"
            element={<PeekCardHost residentId="lin" onClose={vi.fn()} />}
          />
          <Route path="/n/:neighborhoodId" element={<p>户籍街</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "去 Ta 家门口" }));

    await waitFor(() =>
      expect(screen.getByTestId("probe").textContent).toBe("/n/wutong?focusResidentId=lin"),
    );
  });

  it("uses the server's homeNeighborhoodId, never a guess", async () => {
    fetchResidentHome.mockResolvedValue(linView("shiqiao"));
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/town/plaza"]}>
        <Probe />
        <Routes>
          <Route
            path="/town/:zone"
            element={<PeekCardHost residentId="lin" onClose={vi.fn()} />}
          />
          <Route path="/n/:neighborhoodId" element={<p>户籍街</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "去 Ta 家门口" }));
    await waitFor(() =>
      expect(screen.getByTestId("probe").textContent).toBe("/n/shiqiao?focusResidentId=lin"),
    );
  });

  it("hides the doorstep link when we are already standing on that street", async () => {
    render(
      <MemoryRouter initialEntries={["/n/wutong"]}>
        <Routes>
          <Route
            path="/n/:neighborhoodId"
            element={
              <PeekCardHost residentId="lin" currentNeighborhoodId="wutong" onClose={vi.fn()} />
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("dialog", { name: "林" });
    expect(screen.queryByRole("button", { name: "去 Ta 家门口" })).toBeNull();
  });

  it("offers no doorstep for a resident with no street", async () => {
    fetchResidentHome.mockResolvedValue(linView(null));
    render(
      <MemoryRouter initialEntries={["/town/plaza"]}>
        <Routes>
          <Route
            path="/town/:zone"
            element={<PeekCardHost residentId="lin" onClose={vi.fn()} />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole("dialog", { name: "林" });
    expect(screen.queryByRole("button", { name: "去 Ta 家门口" })).toBeNull();
  });
});

describe("post detail → the author's doorstep (§4.11)", () => {
  it("offers 去作者家门口 and lands on their street with focus", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/town/plaza"]}>
        <Probe />
        <Routes>
          <Route
            path="/town/:zone"
            element={
              <PostDetailSheet
                postId="post-lin"
                excerpt="摘要"
                authorName="林"
                count24h={0}
                onClose={vi.fn()}
              />
            }
          />
          <Route path="/n/:neighborhoodId" element={<p>户籍街</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "去作者家门口" }));
    await waitFor(() =>
      expect(screen.getByTestId("probe").textContent).toBe("/n/wutong?focusResidentId=lin"),
    );
  });

  it("stays quiet when the server gave no author street", async () => {
    fetchPost.mockResolvedValue({
      post: { content: "正文" },
      author: { id: "lin", displayName: "林", homeNeighborhoodId: null },
      replies: [],
    });
    render(
      <MemoryRouter initialEntries={["/town/plaza"]}>
        <Routes>
          <Route
            path="/town/:zone"
            element={
              <PostDetailSheet
                postId="post-lin"
                excerpt="摘要"
                authorName="林"
                count24h={0}
                onClose={vi.fn()}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText("正文");
    expect(screen.queryByRole("button", { name: "去作者家门口" })).toBeNull();
  });
});

describe("guest room → the host's doorstep (§3.5)", () => {
  it("steps out onto the host's street, focused on their house", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/r/lin"]}>
        <Probe />
        <Routes>
          <Route path="/r/:residentId" element={<HomeScene mode="guest" />} />
          <Route path="/n/:neighborhoodId" element={<p>户籍街</p>} />
          <Route path="/street" element={<p>我的街</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText("在林家做客");
    await user.click(screen.getByRole("button", { name: "门" }));

    await waitFor(() =>
      expect(screen.getByTestId("probe").textContent).toBe("/n/wutong?focusResidentId=lin"),
    );
  });

  it("keeps 回我的街 pointing at the derived street", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/r/lin"]}>
        <Probe />
        <Routes>
          <Route path="/r/:residentId" element={<HomeScene mode="guest" />} />
          <Route path="/street" element={<p>我的街</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText("在林家做客");
    await user.click(screen.getByRole("button", { name: "回我的街" }));

    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("/street"));
  });
});

describe("history", () => {
  it("pushes each doorstep visit so back returns to the previous one", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/town/plaza"]}>
        <Probe />
        <Routes>
          <Route
            path="/town/:zone"
            element={<PeekCardHost residentId="lin" onClose={vi.fn()} />}
          />
          <Route path="/n/:neighborhoodId" element={<p>户籍街</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: "去 Ta 家门口" }));
    await waitFor(() =>
      expect(screen.getByTestId("probe").textContent).toBe("/n/wutong?focusResidentId=lin"),
    );

    // Pushed, not replaced: the plaza is still behind us.
    await user.click(screen.getByRole("button", { name: "浏览器后退" }));
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("/town/plaza"));
  });
});
