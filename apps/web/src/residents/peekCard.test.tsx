import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { ResidentHomeResponse } from "@pixel-valley/domain";
import { PeekCardHost } from "./PeekCardHost";

const fetchResidentHome = vi.fn<(id: string) => Promise<ResidentHomeResponse>>();
const addNeighborEdge = vi.fn<(id: string) => Promise<unknown>>();
const removeNeighborEdge = vi.fn<(id: string) => Promise<void>>();
const recordVisit = vi.fn<(id: string) => Promise<void>>();
const openConversation = vi.fn<(id: string) => Promise<unknown>>();

vi.mock("../data/api", () => ({
  ApiError: class ApiError extends Error {
    code = "unknown";
    status = 500;
  },
  fetchResidentHome: (id: string) => fetchResidentHome(id),
  addNeighborEdge: (id: string) => addNeighborEdge(id),
  removeNeighborEdge: (id: string) => removeNeighborEdge(id),
  recordVisit: (id: string) => recordVisit(id),
  openConversation: (id: string) => openConversation(id),
  blockResident: vi.fn(() => Promise.resolve()),
  unblockResident: vi.fn(() => Promise.resolve()),
  fetchConversationMessages: vi.fn(() =>
    Promise.resolve({ conversation: { id: "c1" }, messages: [] }),
  ),
  sendConversationMessage: vi.fn(),
  setConversationFocus: vi.fn(() => Promise.resolve()),
}));

type ViewOverrides = {
  isNeighbor?: boolean;
  blocking?: boolean;
  blockedBy?: boolean;
  isSelf?: boolean;
  gate?: ResidentHomeResponse["messageGate"];
  kind?: "human" | "ai";
  presence?: ResidentHomeResponse["resident"]["observerPresence"];
  aiRole?: ResidentHomeResponse["resident"]["aiRole"];
};

function view(overrides: ViewOverrides = {}): ResidentHomeResponse {
  return {
    resident: {
      id: "lin",
      displayName: "林",
      handle: "lin",
      kind: overrides.kind ?? "human",
      aiRole: overrides.aiRole ?? null,
      bio: "在梧桐街写代码。",
      interests: ["Rust", "像素", "夜间编程", "第四个不该显示"],
      avatarSprite: "lin-1",
      observerPresence: overrides.presence ?? "online",
      privacy: { companionVisible: true },
    } as unknown as ResidentHomeResponse["resident"],
    house: { id: "house-lin", residentId: "lin", neighborhoodId: "wutong", slotIndex: 0 } as ResidentHomeResponse["house"],
    neighborhood: { id: "wutong", name: "梧桐街", kind: "residential", slotCount: 12 },
    relation: {
      isNeighbor: overrides.isNeighbor ?? false,
      blocking: overrides.blocking ?? false,
      blockedBy: overrides.blockedBy ?? false,
      isSelf: overrides.isSelf ?? false,
    },
    latestBubble: {
      residentId: "lin",
      postId: "post-lin",
      excerpt: "修好了那个折磨我一周的 bug",
      createdAt: "2026-08-26T10:00:00.000Z",
      count24h: 1,
      hot: false,
      collapsed: false,
    },
    messageGate: overrides.gate ?? { ok: true, via: "knock" },
  };
}

function Probe() {
  const location = useLocation();
  return <div data-testid="probe">{location.pathname}</div>;
}

function renderCard(onClose = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={["/street"]}>
      <Probe />
      <Routes>
        <Route path="/street" element={<PeekCardHost residentId="lin" onClose={onClose} />} />
        <Route path="/r/:residentId" element={<p>访客房</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  for (const fn of [fetchResidentHome, addNeighborEdge, removeNeighborEdge, recordVisit, openConversation]) {
    fn.mockReset();
  }
  recordVisit.mockResolvedValue(undefined);
  openConversation.mockResolvedValue({ conversation: { id: "c1" }, via: "knock" });
});

describe("ResidentPeekCard (§4.4)", () => {
  it("shows the server's resident data, not a local guess", async () => {
    fetchResidentHome.mockResolvedValue(view());
    renderCard();

    expect(await screen.findByRole("dialog", { name: "林" })).toBeTruthy();
    expect(screen.getByText(/@lin/)).toBeTruthy();
    expect(screen.getByText("在家")).toBeTruthy();
    expect(screen.getByText(/住在梧桐街/)).toBeTruthy();
    expect(screen.getByText("「修好了那个折磨我一周的 bug」")).toBeTruthy();
  });

  it("shows at most three interests (§4.4)", async () => {
    fetchResidentHome.mockResolvedValue(view());
    renderCard();
    const list = await screen.findByRole("list", { name: "兴趣" });
    expect(list.querySelectorAll("li")).toHaveLength(3);
    expect(screen.queryByText("第四个不该显示")).toBeNull();
  });

  it("uses §15.4 words for presence, never the enum", async () => {
    fetchResidentHome.mockResolvedValue(view({ presence: "offline", gate: { ok: true, via: "note" } }));
    renderCard();
    expect(await screen.findByText("出门了")).toBeTruthy();
    expect(screen.queryByText("offline")).toBeNull();
    expect(screen.getByRole("button", { name: "留一张纸条" })).toBeTruthy();
  });

  it("says 在岗 and shows the ◇ badge for a public-service AI", async () => {
    fetchResidentHome.mockResolvedValue(view({ kind: "ai", aiRole: "librarian" }));
    renderCard();
    expect(await screen.findByText("在岗")).toBeTruthy();
    expect(screen.getByText("AI 居民")).toBeTruthy();
    // §13: relationships are human-only.
    expect(screen.queryByRole("button", { name: "结为邻里" })).toBeNull();
  });

  it("navigates to /r/:id only when 进屋坐坐 is pressed", async () => {
    fetchResidentHome.mockResolvedValue(view());
    const user = userEvent.setup();
    renderCard();

    await screen.findByRole("dialog", { name: "林" });
    expect(screen.getByTestId("probe").textContent).toBe("/street");

    await user.click(screen.getByRole("button", { name: "进屋坐坐" }));
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("/r/lin"));
    expect(recordVisit).toHaveBeenCalledWith("lin");
  });

  it("navigates even if the visit beacon fails", async () => {
    fetchResidentHome.mockResolvedValue(view());
    recordVisit.mockRejectedValue(new Error("beacon down"));
    const user = userEvent.setup();
    renderCard();

    await screen.findByRole("dialog", { name: "林" });
    await user.click(screen.getByRole("button", { name: "进屋坐坐" }));
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("/r/lin"));
  });

  it("hides 结为邻里 on your own house", async () => {
    fetchResidentHome.mockResolvedValue(view({ isSelf: true }));
    renderCard();
    await screen.findByRole("dialog", { name: "林" });
    expect(screen.queryByRole("button", { name: "结为邻里" })).toBeNull();
  });

  it("renders the §4.4 refusal when the gate is shut", async () => {
    fetchResidentHome.mockResolvedValue(
      view({ blockedBy: true, gate: { ok: false, code: "blocked" } }),
    );
    renderCard();
    expect(await screen.findByText("这家谢绝访客")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "敲门" })).toBeNull();
    expect(screen.queryByRole("button", { name: "结为邻里" })).toBeNull();
  });

  it("says 你挡住了 Ta when the block is ours", async () => {
    fetchResidentHome.mockResolvedValue(
      view({ blocking: true, gate: { ok: false, code: "blocked" } }),
    );
    renderCard();
    expect(await screen.findByText("你挡住了 Ta")).toBeTruthy();
  });

  it("opens the real conversation panel for a knock, without leaving the street", async () => {
    fetchResidentHome.mockResolvedValue(view());
    const user = userEvent.setup();
    renderCard();

    await screen.findByRole("dialog", { name: "林" });
    await user.click(screen.getByRole("button", { name: "敲门" }));

    await waitFor(() => expect(openConversation).toHaveBeenCalledWith("lin"));
    // The panel itself opens here — no dead-end toast.
    expect(await screen.findByRole("dialog", { name: "与林的对话" })).toBeTruthy();
    expect(screen.getByTestId("probe").textContent).toBe("/street");
  });

  it("moves focus into the card so the keyboard lands on a CTA", async () => {
    fetchResidentHome.mockResolvedValue(view());
    renderCard();
    await screen.findByRole("dialog", { name: "林" });
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "进屋坐坐" })),
    );
  });

  it("drives every CTA from the keyboard", async () => {
    fetchResidentHome.mockResolvedValue(view());
    const user = userEvent.setup();
    renderCard();
    await screen.findByRole("dialog", { name: "林" });

    // Focus starts on 进屋坐坐; Tab reaches 敲门, then 结为邻里.
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "敲门" }));
    await user.keyboard("{Enter}");
    await waitFor(() => expect(openConversation).toHaveBeenCalledWith("lin"));
  });

  it("surfaces a fetch failure with a retry instead of a blank card", async () => {
    fetchResidentHome.mockRejectedValueOnce(new Error("offline"));
    fetchResidentHome.mockResolvedValue(view());
    const user = userEvent.setup();
    renderCard();

    expect(await screen.findByRole("alert")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "再试一次" }));
    expect(await screen.findByRole("dialog", { name: "林" })).toBeTruthy();
  });
});

describe("结为邻里 (§3.11)", () => {
  it("adopts the server's new relation state after success", async () => {
    fetchResidentHome.mockResolvedValueOnce(view({ isNeighbor: false }));
    addNeighborEdge.mockResolvedValue({});
    fetchResidentHome.mockResolvedValueOnce(view({ isNeighbor: true }));

    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByRole("button", { name: "结为邻里" }));

    expect(await screen.findByRole("button", { name: "搬离邻里关系" })).toBeTruthy();
    expect(addNeighborEdge).toHaveBeenCalledWith("lin");
    // Re-read, never a local guess.
    expect(fetchResidentHome).toHaveBeenCalledTimes(2);
    expect(screen.getByText("邻里")).toBeTruthy();
  });

  it("leaves no pretend relation behind when the write fails", async () => {
    fetchResidentHome.mockResolvedValue(view({ isNeighbor: false }));
    addNeighborEdge.mockRejectedValue(new Error("500"));

    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByRole("button", { name: "结为邻里" }));

    expect((await screen.findByRole("alert")).textContent).toBe("门牌没挂上去。再试一次。");
    // Still offering to become neighbours — the UI did not fake success.
    expect(screen.getByRole("button", { name: "结为邻里" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "搬离邻里关系" })).toBeNull();
    expect(screen.queryByText("邻里")).toBeNull();
  });

  it("unfollows through the server too", async () => {
    fetchResidentHome.mockResolvedValueOnce(view({ isNeighbor: true }));
    removeNeighborEdge.mockResolvedValue(undefined);
    fetchResidentHome.mockResolvedValueOnce(view({ isNeighbor: false }));

    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByRole("button", { name: "搬离邻里关系" }));

    expect(await screen.findByRole("button", { name: "结为邻里" })).toBeTruthy();
    expect(removeNeighborEdge).toHaveBeenCalledWith("lin");
  });

  it("disables the button while the write is in flight", async () => {
    fetchResidentHome.mockResolvedValue(view({ isNeighbor: false }));
    let release: () => void = () => {};
    addNeighborEdge.mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve({});
      }),
    );

    const user = userEvent.setup();
    renderCard();
    await user.click(await screen.findByRole("button", { name: "结为邻里" }));

    const pending = screen.getByRole("button", { name: "正在换门牌…" });
    expect(pending.hasAttribute("disabled")).toBe(true);
    release();
  });
});
