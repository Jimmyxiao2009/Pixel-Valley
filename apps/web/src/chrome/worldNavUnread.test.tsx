import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ConversationListItem, MeResponse, Message } from "@pixel-valley/domain";
import { unreadBadgeText, unreadLabel, WorldNav } from "./WorldNav";
import { MailScene } from "../scenes/MailScene";

const refresh = vi.fn<() => Promise<MeResponse | null>>();
const fetchConversations = vi.fn<() => Promise<{ items: ConversationListItem[] }>>();
const fetchConversationMessages =
  vi.fn<(id: string) => Promise<{ conversation: unknown; messages: Message[] }>>();

let unreadTotal = 0;

vi.mock("../session/SessionProvider", () => ({
  useSession: () => ({
    status: "authenticated" as const,
    me: { resident: { id: "you" }, account: {}, unreadTotal } as unknown as MeResponse,
    login: vi.fn(),
    logout: vi.fn(),
    refresh,
  }),
}));

vi.mock("../data/api", () => ({
  ApiError: class ApiError extends Error {
    code = "unknown";
    status = 500;
  },
  fetchConversations: () => fetchConversations(),
  fetchConversationMessages: (id: string) => fetchConversationMessages(id),
  sendConversationMessage: vi.fn(),
  setConversationFocus: vi.fn(() => Promise.resolve()),
  fetchResidentHome: vi.fn(() =>
    Promise.resolve({
      relation: { isNeighbor: false, blocking: false, blockedBy: false, isSelf: false },
    }),
  ),
  blockResident: vi.fn(),
  unblockResident: vi.fn(),
}));

function renderNav() {
  return render(
    <MemoryRouter initialEntries={["/home"]}>
      <WorldNav />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  refresh.mockReset();
  fetchConversations.mockReset();
  fetchConversationMessages.mockReset();
  refresh.mockResolvedValue(null);
  unreadTotal = 0;
});

describe("unread badge text", () => {
  it("stays silent at zero", () => {
    expect(unreadBadgeText(0)).toBeNull();
    expect(unreadBadgeText(-1)).toBeNull();
  });

  it("counts up to 99 and then caps", () => {
    expect(unreadBadgeText(1)).toBe("1");
    expect(unreadBadgeText(99)).toBe("99");
    expect(unreadBadgeText(100)).toBe("99+");
  });

  it("puts the count in the accessible name", () => {
    expect(unreadLabel("信箱", 0)).toBe("信箱");
    expect(unreadLabel("信箱", 3)).toBe("信箱，3 条未读");
  });
});

describe("WorldNav mailbox key (§2.2)", () => {
  it("shows no number noise when nothing is unread", () => {
    unreadTotal = 0;
    renderNav();
    const mail = screen.getByRole("link", { name: "信箱" });
    expect(mail.textContent).toBe("信箱");
  });

  it("shows the count and says it out loud", () => {
    unreadTotal = 3;
    renderNav();
    const mail = screen.getByRole("link", { name: "信箱，3 条未读" });
    expect(within(mail).getByText("3")).toBeTruthy();
  });

  it("caps a very large count", () => {
    unreadTotal = 250;
    renderNav();
    expect(screen.getByRole("link", { name: "信箱，250 条未读" }).textContent).toContain("99+");
  });

  it("carries unread on the mailbox key only", () => {
    unreadTotal = 5;
    renderNav();
    for (const label of ["回家", "上街", "去镇上"]) {
      expect(screen.getByRole("link", { name: label }).textContent).toBe(label);
    }
  });

  it("does not rely on colour alone", () => {
    unreadTotal = 2;
    const { container } = renderNav();
    // The badge is text inside the key, readable without any styling.
    expect(container.querySelector(".world-nav__unread")?.textContent).toBe("2");
  });
});

describe("reading refreshes the server total", () => {
  it("asks the session to re-read after a thread is opened", async () => {
    unreadTotal = 2;
    fetchConversations.mockResolvedValue({
      items: [
        {
          conversation: {
            id: "c-lin",
            kind: "direct",
            participantResidentIds: ["you", "lin"],
            lastMessageAt: new Date().toISOString(),
            lastMessagePreview: "在吗",
          },
          unreadCount: 2,
          peer: {
            id: "lin",
            displayName: "林",
            handle: "lin",
            kind: "human",
            observerPresence: "online",
          },
        } as ConversationListItem,
      ],
    });
    fetchConversationMessages.mockResolvedValue({ conversation: {}, messages: [] });

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/mail"]}>
        <Routes>
          <Route path="/mail" element={<MailScene />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole("button", { name: /林/ }));

    // The GET marks it read server-side; the shell re-reads rather than guessing.
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    await waitFor(() => expect(fetchConversations).toHaveBeenCalledTimes(2));
  });
});
