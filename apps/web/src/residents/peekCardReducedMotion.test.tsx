import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { ResidentHomeResponse } from "@pixel-valley/domain";
import { PeekCardHost } from "./PeekCardHost";

const fetchResidentHome = vi.fn<(id: string) => Promise<ResidentHomeResponse>>();
const addNeighborEdge = vi.fn<(id: string) => Promise<unknown>>();
const recordVisit = vi.fn<(id: string) => Promise<void>>();

vi.mock("../data/api", () => ({
  ApiError: class ApiError extends Error {
    code = "unknown";
    status = 500;
  },
  fetchResidentHome: (id: string) => fetchResidentHome(id),
  addNeighborEdge: (id: string) => addNeighborEdge(id),
  removeNeighborEdge: vi.fn(),
  recordVisit: (id: string) => recordVisit(id),
  openConversation: vi.fn(() => Promise.resolve({ conversation: { id: "c1" }, via: "knock" })),
  blockResident: vi.fn(() => Promise.resolve()),
  unblockResident: vi.fn(() => Promise.resolve()),
  fetchConversationMessages: vi.fn(() =>
    Promise.resolve({ conversation: { id: "c1" }, messages: [] }),
  ),
  sendConversationMessage: vi.fn(),
  setConversationFocus: vi.fn(() => Promise.resolve()),
}));

/** Everything in the app reads reduced motion through this media query. */
function prefersReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function view(isNeighbor = false): ResidentHomeResponse {
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
    } as unknown as ResidentHomeResponse["resident"],
    house: null,
    neighborhood: { id: "wutong", name: "梧桐街", kind: "residential", slotCount: 12 },
    relation: { isNeighbor, blocking: false, blockedBy: false, isSelf: false },
    latestBubble: null,
    messageGate: { ok: true, via: "knock" },
  };
}

function Probe() {
  const location = useLocation();
  return <div data-testid="probe">{location.pathname}</div>;
}

function renderCard() {
  return render(
    <MemoryRouter initialEntries={["/street"]}>
      <Probe />
      <Routes>
        <Route path="/street" element={<PeekCardHost residentId="lin" onClose={vi.fn()} />} />
        <Route path="/r/:residentId" element={<p>访客房</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchResidentHome.mockReset();
  addNeighborEdge.mockReset();
  recordVisit.mockReset();
  recordVisit.mockResolvedValue(undefined);
  prefersReducedMotion(true);
});

describe("ResidentPeekCard under prefers-reduced-motion (§15.3)", () => {
  it("still renders the whole card", async () => {
    fetchResidentHome.mockResolvedValue(view());
    renderCard();

    expect(await screen.findByRole("dialog", { name: "林" })).toBeTruthy();
    expect(screen.getByText("在家")).toBeTruthy();
    expect(screen.getByRole("button", { name: "进屋坐坐" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "敲门" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "结为邻里" })).toBeTruthy();
  });

  it("still navigates on 进屋坐坐", async () => {
    fetchResidentHome.mockResolvedValue(view());
    const user = userEvent.setup();
    renderCard();

    await screen.findByRole("dialog", { name: "林" });
    await user.click(screen.getByRole("button", { name: "进屋坐坐" }));

    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("/r/lin"));
  });

  it("still performs the relation write against the server", async () => {
    fetchResidentHome.mockResolvedValueOnce(view(false));
    addNeighborEdge.mockResolvedValue({});
    fetchResidentHome.mockResolvedValueOnce(view(true));

    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByRole("button", { name: "结为邻里" }));

    expect(await screen.findByRole("button", { name: "搬离邻里关系" })).toBeTruthy();
    expect(addNeighborEdge).toHaveBeenCalledWith("lin");
  });

  it("still moves focus into the card for keyboard users", async () => {
    fetchResidentHome.mockResolvedValue(view());
    renderCard();
    await screen.findByRole("dialog", { name: "林" });
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "进屋坐坐" })),
    );
  });
});
