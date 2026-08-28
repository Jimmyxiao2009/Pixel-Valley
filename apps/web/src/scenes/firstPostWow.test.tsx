import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { MeResponse, Post } from "@pixel-valley/domain";
import { HomeScene } from "./HomeScene";

const FIRST_AT = "2026-08-26T12:00:00.000Z";
const LATER_AT = "2026-08-26T12:05:00.000Z";

const refresh = vi.fn<() => Promise<MeResponse | null>>();
const createPost = vi.fn<() => Promise<Post>>();
let sessionValue: MeResponse;

vi.mock("../session/SessionProvider", () => ({
  useSession: () => ({
    status: "authenticated" as const,
    me: sessionValue,
    login: vi.fn(),
    logout: vi.fn(),
    refresh,
  }),
}));

vi.mock("../data/api", () => ({
  createPost: () => createPost(),
  fetchNeighborhood: () =>
    Promise.resolve({ neighborhood: { id: "wutong", name: "梧桐街", kind: "residential", slotCount: 12 } }),
  fetchResident: () => Promise.resolve(null),
  fetchResidentPosts: () => Promise.resolve({ items: [], nextCursor: null }),
}));

function meWith(firstPostAt: string | null): MeResponse {
  return {
    resident: {
      id: "you",
      handle: "you",
      displayName: "你",
      homeNeighborhoodId: "wutong",
      companionResidentId: "doumiao",
      onboarding: { firstPostAt },
    },
    account: { id: "account-you", email: "you@pixel-valley.local", createdAt: FIRST_AT },
    unreadTotal: 0,
  } as unknown as MeResponse;
}

function postAt(createdAt: string): Post {
  return {
    id: `post-${createdAt}`,
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

/** Reports the live route + wow nav state so assertions read real navigation. */
function RouteProbe() {
  const location = useLocation();
  const wow = (location.state as { wow?: boolean } | null)?.wow === true;
  return <div data-testid="probe">{`${location.pathname}${wow ? "?wow" : ""}`}</div>;
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/home"]}>
      <RouteProbe />
      <Routes>
        <Route path="/home" element={<HomeScene />} />
        <Route path="/street" element={<p>街</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function publish(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "电脑" }));
  await user.type(screen.getByRole("textbox"), "今晚灯很暖");
  await user.click(screen.getByRole("button", { name: "贴到房顶" }));
}

beforeEach(() => {
  localStorage.clear();
  refresh.mockReset();
  createPost.mockReset();
});

afterEach(() => {
  localStorage.clear();
});

describe("first-post wow (§3.1.A.4)", () => {
  it("opens the door to /street after the first post", async () => {
    sessionValue = meWith(null);
    createPost.mockResolvedValue(postAt(FIRST_AT));
    refresh.mockResolvedValue(meWith(FIRST_AT));

    const user = userEvent.setup();
    renderHome();
    expect(screen.getByTestId("probe").textContent).toBe("/home");

    await publish(user);

    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("/street?wow"));
  });

  it("keeps later posts in the room", async () => {
    sessionValue = meWith(FIRST_AT);
    createPost.mockResolvedValue(postAt(LATER_AT));
    refresh.mockResolvedValue(meWith(FIRST_AT));

    const user = userEvent.setup();
    renderHome();

    await publish(user);

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.getByTestId("probe").textContent).toBe("/home");
    expect(screen.getByText("已经贴在房顶上了。出门就能看见。")).toBeTruthy();
  });

  it("gives success feedback at t=0, without waiting on the refresh", async () => {
    sessionValue = meWith(null);
    createPost.mockResolvedValue(postAt(FIRST_AT));
    let releaseRefresh: (value: MeResponse) => void = () => {};
    refresh.mockReturnValue(
      new Promise<MeResponse>((resolve) => {
        releaseRefresh = resolve;
      }),
    );

    const user = userEvent.setup();
    renderHome();
    await publish(user);

    // Refresh is still in flight, yet the resident already knows it worked.
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(screen.getByText("已经贴在房顶上了。出门就能看见。")).toBeTruthy();
    expect(screen.getByTestId("probe").textContent).toBe("/home");

    releaseRefresh(meWith(FIRST_AT));
    await waitFor(() => expect(screen.getByTestId("probe").textContent).toBe("/street?wow"));
  });

  it("does not navigate when the server never recorded a first post", async () => {
    sessionValue = meWith(null);
    createPost.mockResolvedValue(postAt(FIRST_AT));
    refresh.mockResolvedValue(meWith(null));

    const user = userEvent.setup();
    renderHome();
    await publish(user);

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.getByTestId("probe").textContent).toBe("/home");
  });

  it("does not re-fire on a reload once onboarding is recorded", async () => {
    // A refreshed page starts from the server's onboarding state, so the
    // composer is the only thing that can trigger the door.
    sessionValue = meWith(FIRST_AT);
    renderHome();
    expect(screen.getByTestId("probe").textContent).toBe("/home");
    expect(refresh).not.toHaveBeenCalled();
  });
});
