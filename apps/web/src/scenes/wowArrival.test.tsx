import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  STREET_MINE_CENTER,
  type DerivedSlot,
  type MeResponse,
  type StreetMineResponse,
} from "@pixel-valley/domain";
import { NeighborhoodScene } from "./NeighborhoodScene";
import { selfSlotIndex } from "../map/lots";

const SERVER_EXCERPT = "服务端算好的摘要";

const fetchStreetMine = vi.fn<() => Promise<StreetMineResponse>>();

vi.mock("../session/SessionProvider", () => ({
  useSession: () => ({
    status: "authenticated" as const,
    me: {
      resident: { id: "you", homeNeighborhoodId: "wutong" },
      account: { id: "account-you", email: "you@pixel-valley.local", createdAt: "" },
      unreadTotal: 0,
    } as unknown as MeResponse,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("../data/api", () => ({
  fetchStreetMine: () => fetchStreetMine(),
  fetchNeighborhood: () => Promise.reject(new Error("not used")),
  fetchPost: () => Promise.reject(new Error("not used")),
}));

/** Mirrors §12.4.3: me pinned to layout 4, neighbours on their own lots. */
function slots(): DerivedSlot[] {
  return Array.from({ length: 12 }, (_, layoutIndex) => {
    if (layoutIndex === STREET_MINE_CENTER) {
      return { layoutIndex, kind: "self" as const, houseId: "house-you", residentId: "you" };
    }
    if (layoutIndex === 0) {
      return { layoutIndex, kind: "house" as const, houseId: "house-lin", residentId: "lin" };
    }
    if (layoutIndex === 9) {
      return { layoutIndex, kind: "bus-stop" as const, houseId: null, residentId: null };
    }
    return { layoutIndex, kind: "vacant" as const, houseId: null, residentId: null };
  });
}

function streetPayload(): StreetMineResponse {
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
    bubbles: [
      {
        residentId: "you",
        postId: "post-you",
        excerpt: SERVER_EXCERPT,
        createdAt: "2026-08-26T12:00:00.000Z",
        count24h: 1,
        hot: false,
        collapsed: false,
      },
    ],
  };
}

function renderStreet(state?: { wow: boolean }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/street", state }]}>
      <Routes>
        <Route path="/street" element={<NeighborhoodScene mode="mine" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchStreetMine.mockReset();
  fetchStreetMine.mockResolvedValue(streetPayload());
});

describe("wow arrival on /street", () => {
  it("announces the publish once, politely", async () => {
    renderStreet({ wow: true });
    const announcement = await screen.findByText("已经贴在房顶上了。");
    expect(announcement.getAttribute("role")).toBe("status");
    expect(announcement.getAttribute("aria-live")).toBe("polite");
  });

  it("stays silent on an ordinary visit", async () => {
    renderStreet();
    await waitFor(() => expect(fetchStreetMine).toHaveBeenCalled());
    expect(screen.queryByText("已经贴在房顶上了。")).toBeNull();
  });

  it("renders the roof bubble from the server excerpt, never a local guess", async () => {
    renderStreet({ wow: true });
    const bubble = await screen.findByRole("button", { name: `你的帖子：${SERVER_EXCERPT}` });
    expect(bubble.textContent).toContain(SERVER_EXCERPT);
  });

  it("puts the resident on the centre lot the server derived", () => {
    const payload = streetPayload();
    const lots = payload.slots.map((slot) => ({
      slotIndex: slot.layoutIndex,
      kind: slot.kind,
      houseId: slot.houseId,
      residentId: slot.residentId,
    }));
    expect(selfSlotIndex(lots, "you")).toBe(STREET_MINE_CENTER);
  });
});
