import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { MeResponse, NeighborhoodTile, NeighborhoodView } from "@pixel-valley/domain";
import { NeighborhoodScene } from "./NeighborhoodScene";

type FetchCall = { id: string; focusResidentId?: string };

const fetchNeighborhood =
  vi.fn<(id: string, options?: { focusResidentId?: string }) => Promise<NeighborhoodView>>();
const fetchStreetMine = vi.fn();
const calls: FetchCall[] = [];

vi.mock("../session/SessionProvider", () => ({
  useSession: () => ({
    status: "authenticated" as const,
    me: {
      // Home is elsewhere, so 梧桐街 is someone else's street to this viewer.
      resident: { id: "you", homeNeighborhoodId: "huaihua" },
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
  fetchNeighborhood: (id: string, options?: { focusResidentId?: string }) => {
    calls.push({ id, focusResidentId: options?.focusResidentId });
    return fetchNeighborhood(id, options);
  },
  fetchStreetMine: () => fetchStreetMine(),
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

/** 梧桐街 per §12.8: 林 at 0, Neko at 2, 你 at 4, Ava at 6. */
function tiles(): NeighborhoodTile[] {
  const houses: Record<number, string> = {
    0: "house-lin",
    2: "house-neko",
    4: "house-you",
    6: "house-ava",
  };
  return Array.from({ length: 12 }, (_, slotIndex) => ({
    neighborhoodId: "wutong",
    slotIndex,
    kind: houses[slotIndex] ? ("house" as const) : slotIndex === 9 ? ("bus-stop" as const) : ("vacant" as const),
    houseId: houses[slotIndex] ?? null,
  }));
}

function view(focusResidentId?: string): NeighborhoodView {
  const slotOf: Record<string, number> = { lin: 0, neko: 2, you: 4, ava: 6 };
  const slot = focusResidentId ? slotOf[focusResidentId] : undefined;
  return {
    neighborhood: { id: "wutong", name: "梧桐街", kind: "residential", slotCount: 12 },
    tiles: tiles(),
    houses: [
      { id: "house-lin", residentId: "lin", neighborhoodId: "wutong", slotIndex: 0 },
      { id: "house-neko", residentId: "neko", neighborhoodId: "wutong", slotIndex: 2 },
      { id: "house-you", residentId: "you", neighborhoodId: "wutong", slotIndex: 4 },
      { id: "house-ava", residentId: "ava", neighborhoodId: "wutong", slotIndex: 6 },
    ] as NeighborhoodView["houses"],
    residents: [
      { id: "lin", displayName: "林", handle: "lin", kind: "human", observerPresence: "online" },
      { id: "neko", displayName: "Neko", handle: "neko", kind: "human", observerPresence: "offline" },
      { id: "you", displayName: "你", handle: "you", kind: "human", observerPresence: "online" },
      { id: "ava", displayName: "Ava", handle: "ava", kind: "human", observerPresence: "offline" },
    ] as NeighborhoodView["residents"],
    bubbles: [],
    focus: slot === undefined ? null : { residentId: focusResidentId!, slotIndex: slot },
  };
}

function Probe() {
  const location = useLocation();
  return <div data-testid="probe">{`${location.pathname}${location.search}`}</div>;
}

function renderStreet(at: string) {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <Probe />
      <Routes>
        <Route path="/n/:neighborhoodId" element={<NeighborhoodScene mode="canonical" />} />
        <Route path="/street" element={<NeighborhoodScene mode="mine" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  calls.length = 0;
  fetchNeighborhood.mockReset();
  fetchStreetMine.mockReset();
  fetchNeighborhood.mockImplementation((_id, options) =>
    Promise.resolve(view(options?.focusResidentId)),
  );
  fetchStreetMine.mockResolvedValue({
    neighborhood: { id: "wutong", name: "梧桐街", kind: "residential", slotCount: 12 },
    slots: Array.from({ length: 12 }, (_, layoutIndex) => ({
      layoutIndex,
      kind: layoutIndex === 4 ? "self" : "vacant",
      houseId: layoutIndex === 4 ? "house-you" : null,
      residentId: layoutIndex === 4 ? "you" : null,
    })),
    residents: [{ id: "you", displayName: "你", handle: "you", kind: "human" }],
    houses: [{ id: "house-you", residentId: "you", neighborhoodId: "wutong", slotIndex: 4 }],
    bubbles: [],
  });
});

describe("canonical street focus (§12.4.2)", () => {
  it("passes the focus query through to the server", async () => {
    renderStreet("/n/wutong?focusResidentId=lin");
    await waitFor(() => expect(calls[0]).toEqual({ id: "wutong", focusResidentId: "lin" }));
  });

  it("asks for no focus when the query is absent", async () => {
    renderStreet("/n/wutong");
    await waitFor(() => expect(calls[0]).toEqual({ id: "wutong", focusResidentId: undefined }));
  });

  it("announces the house it found", async () => {
    renderStreet("/n/wutong?focusResidentId=lin");
    const note = await screen.findByText("找到林的家了。");
    expect(note.getAttribute("role")).toBe("status");
    expect(note.getAttribute("aria-live")).toBe("polite");
  });

  it("marks the target house, and only that house", async () => {
    renderStreet("/n/wutong?focusResidentId=lin");
    // The marker is in the accessible name, not only in the styling.
    expect(await screen.findByRole("button", { name: "林的家，你要找的就是这家" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Neko的家" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Ava的家$/ })).toBeTruthy();
  });

  it("leaves the canonical slot order untouched", async () => {
    renderStreet("/n/wutong?focusResidentId=ava");
    await screen.findByRole("button", { name: "Ava的家，你要找的就是这家" });

    // Ava is still on her own lot; nobody was swapped to the centre.
    const payload = await fetchNeighborhood.mock.results[0]!.value;
    expect(payload.houses.find((h: { residentId: string }) => h.residentId === "ava").slotIndex).toBe(6);
    expect(payload.houses.find((h: { residentId: string }) => h.residentId === "lin").slotIndex).toBe(0);
  });

  it("says so when the resident does not live on this street", async () => {
    fetchNeighborhood.mockResolvedValue(view(undefined));
    renderStreet("/n/wutong?focusResidentId=nanfeng");

    expect(await screen.findByText("这家不在这条街上。")).toBeTruthy();
    // The street is still perfectly usable.
    expect(screen.getByRole("button", { name: "林的家" })).toBeTruthy();
  });

  it("clears the marker when the focus query goes away", async () => {
    const user = userEvent.setup();
    renderStreet("/n/wutong?focusResidentId=lin");
    await screen.findByText("找到林的家了。");

    // Leaving to my own street and back drops the focus entirely.
    await user.click(screen.getByRole("button", { name: "回我的街" }));
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("/street"));
    expect(screen.queryByText("找到林的家了。")).toBeNull();
  });

  it("does not let a stale focus answer overwrite a newer one", async () => {
    let releaseLin: (value: NeighborhoodView) => void = () => {};
    fetchNeighborhood.mockImplementation((_id, options) => {
      if (options?.focusResidentId === "lin") {
        return new Promise<NeighborhoodView>((resolve) => (releaseLin = resolve));
      }
      return Promise.resolve(view(options?.focusResidentId));
    });

    const { rerender } = render(
      <MemoryRouter initialEntries={["/n/wutong?focusResidentId=lin", "/n/wutong?focusResidentId=neko"]} initialIndex={1}>
        <Probe />
        <Routes>
          <Route path="/n/:neighborhoodId" element={<NeighborhoodScene mode="canonical" />} />
        </Routes>
      </MemoryRouter>,
    );
    void rerender;

    expect(await screen.findByText("找到Neko的家了。")).toBeTruthy();

    // The slow 林 request finally answers; it must not steal the marker.
    releaseLin(view("lin"));
    await waitFor(() => expect(screen.queryByText("找到林的家了。")).toBeNull());
    expect(screen.getByText("找到Neko的家了。")).toBeTruthy();
  });
});

describe("my street ignores canonical focus (KD-19)", () => {
  it("never sends a focus query for the derived street", async () => {
    renderStreet("/street?focusResidentId=lin");
    await waitFor(() => expect(fetchStreetMine).toHaveBeenCalled());
    expect(calls).toHaveLength(0);
    expect(screen.queryByText("找到林的家了。")).toBeNull();
  });
});

describe("finding the way home (§3.10)", () => {
  it("offers 回我的街 while visiting, pointing at the derived street", async () => {
    const user = userEvent.setup();
    renderStreet("/n/wutong?focusResidentId=lin");
    await screen.findByText("找到林的家了。");

    await user.click(screen.getByRole("button", { name: "回我的街" }));
    // /street, never /n/{my home street}.
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("/street"));
  });
});
