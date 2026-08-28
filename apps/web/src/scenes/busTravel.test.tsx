import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import {
  STREET_MINE_CENTER,
  type DerivedSlot,
  type MeResponse,
  type StreetMineResponse,
} from "@pixel-valley/domain";
import { NeighborhoodScene } from "./NeighborhoodScene";

const fetchStreetMine = vi.fn<() => Promise<StreetMineResponse>>();

vi.mock("../session/SessionProvider", () => ({
  useSession: () => ({
    status: "authenticated" as const,
    me: {
      resident: { id: "you", homeNeighborhoodId: "wutong" },
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
  fetchStreetMine: () => fetchStreetMine(),
  fetchNeighborhood: () => Promise.reject(new Error("not used")),
  fetchResidentHome: vi.fn(),
  fetchPost: vi.fn(),
  recordVisit: vi.fn(),
  addNeighborEdge: vi.fn(),
  removeNeighborEdge: vi.fn(),
  openConversation: vi.fn(),
  blockResident: vi.fn(),
  unblockResident: vi.fn(),
  fetchConversationMessages: vi.fn(),
  sendConversationMessage: vi.fn(),
  setConversationFocus: vi.fn(),
}));

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

function slots(): DerivedSlot[] {
  return Array.from({ length: 12 }, (_, layoutIndex) => {
    if (layoutIndex === STREET_MINE_CENTER) {
      return { layoutIndex, kind: "self" as const, houseId: "house-you", residentId: "you" };
    }
    if (layoutIndex === 9) {
      return { layoutIndex, kind: "bus-stop" as const, houseId: null, residentId: "lulu" };
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
      { id: "lulu", displayName: "路路", handle: "lulu", kind: "ai" },
    ] as StreetMineResponse["residents"],
    houses: [
      { id: "house-you", residentId: "you", neighborhoodId: "wutong", slotIndex: 4 },
    ] as StreetMineResponse["houses"],
    bubbles: [],
  };
}

function Probe() {
  const location = useLocation();
  return <div data-testid="probe">{location.pathname}</div>;
}

function renderStreet() {
  return render(
    <MemoryRouter initialEntries={["/street"]}>
      <Probe />
      <Routes>
        <Route path="/street" element={<NeighborhoodScene mode="mine" />} />
        <Route path="/town/:zone" element={<p>镇中心</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function openBusStop(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: /公交/ }));
  return screen.findByRole("dialog", { name: /梧桐街站/ });
}

beforeEach(() => {
  vi.useRealTimers();
  fetchStreetMine.mockReset();
  fetchStreetMine.mockResolvedValue(street());
  prefersReducedMotion(false);
});

describe("bus stop (§3.8)", () => {
  it("opens the stop sheet with the next departure and a timetable", async () => {
    const user = userEvent.setup();
    renderStreet();

    const sheet = await openBusStop(user);
    expect(sheet.textContent).toContain("下一班：镇中心 · 广场");
    expect(screen.getByRole("button", { name: "坐上去" })).toBeTruthy();
    for (const stop of ["广场", "公告栏", "图书馆", "咖啡馆"]) {
      expect(screen.getByRole("button", { name: stop })).toBeTruthy();
    }
  });

  it("does not teleport: the stop sheet leaves the street in place", async () => {
    const user = userEvent.setup();
    renderStreet();
    await openBusStop(user);
    expect(screen.getByTestId("probe").textContent).toBe("/street");
  });
});

describe("bus transition (§4.8)", () => {
  it("plays the ride, then arrives at the plaza", async () => {
    const user = userEvent.setup();
    renderStreet();
    await openBusStop(user);

    await user.click(screen.getByRole("button", { name: "坐上去" }));

    // The curtain is up and says where we are going.
    const curtain = await screen.findByRole("dialog", { name: "正在去镇中心" });
    expect(curtain.textContent).toContain("正在去广场");
    expect(screen.getByTestId("probe").textContent).toBe("/street");

    await waitFor(
      () => expect(screen.getByTestId("probe").textContent).toBe("/town/plaza"),
      { timeout: 3000 },
    );
  });

  it("lets the timetable pick a different stop", async () => {
    const user = userEvent.setup();
    renderStreet();
    await openBusStop(user);

    await user.click(screen.getByRole("button", { name: "图书馆" }));

    await waitFor(
      () => expect(screen.getByTestId("probe").textContent).toBe("/town/library"),
      { timeout: 3000 },
    );
  });

  it("arrives immediately when skipped, and the skip is focused", async () => {
    const user = userEvent.setup();
    renderStreet();
    await openBusStop(user);
    await user.click(screen.getByRole("button", { name: "坐上去" }));

    const skip = await screen.findByRole("button", { name: "跳过" });
    await waitFor(() => expect(document.activeElement).toBe(skip));

    await user.click(skip);
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("/town/plaza"));
  });

  it("never strands anyone: the ride cannot outlive the arrival", async () => {
    const user = userEvent.setup();
    renderStreet();
    await openBusStop(user);
    await user.click(screen.getByRole("button", { name: "坐上去" }));

    await waitFor(
      () => expect(screen.getByTestId("probe").textContent).toBe("/town/plaza"),
      { timeout: 3000 },
    );
    // The curtain is gone once we are there.
    expect(screen.queryByRole("dialog", { name: "正在去镇中心" })).toBeNull();
  });

  it("skips the ride under reduced motion but still arrives", async () => {
    prefersReducedMotion(true);
    const user = userEvent.setup();
    renderStreet();
    await openBusStop(user);

    await user.click(screen.getByRole("button", { name: "坐上去" }));

    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("/town/plaza"));
    expect(screen.queryByRole("dialog", { name: "正在去镇中心" })).toBeNull();
  });
});
