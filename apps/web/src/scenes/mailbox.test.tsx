import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ConversationListItem, Message, ResidentHomeResponse } from "@pixel-valley/domain";
import { MailScene } from "./MailScene";
import { ApiError } from "../data/api";

const FakeApiError = ApiError as unknown as new (code: string, status?: number) => Error;

const fetchConversations = vi.fn<() => Promise<{ items: ConversationListItem[] }>>();
const fetchConversationMessages =
  vi.fn<(id: string) => Promise<{ conversation: unknown; messages: Message[] }>>();
const sendConversationMessage = vi.fn<(id: string, content: string) => Promise<Message>>();
const setConversationFocus = vi.fn<(id: string, open: boolean) => Promise<void>>();
const fetchResidentHome = vi.fn<(id: string) => Promise<ResidentHomeResponse>>();
const blockResident = vi.fn<(id: string) => Promise<void>>();
const unblockResident = vi.fn<(id: string) => Promise<void>>();

vi.mock("../data/api", () => ({
  // Declared inside the factory: vi.mock is hoisted above module scope.
  ApiError: class ApiError extends Error {
    code: string;
    status: number;
    constructor(code: string, status = 403) {
      super(code);
      this.code = code;
      this.status = status;
    }
  },
  fetchConversations: () => fetchConversations(),
  fetchConversationMessages: (id: string) => fetchConversationMessages(id),
  sendConversationMessage: (id: string, content: string) => sendConversationMessage(id, content),
  setConversationFocus: (id: string, open: boolean) => setConversationFocus(id, open),
  fetchResidentHome: (id: string) => fetchResidentHome(id),
  blockResident: (id: string) => blockResident(id),
  unblockResident: (id: string) => unblockResident(id),
}));

function message(id: string, sender: string, content: string): Message {
  return {
    id,
    conversationId: "c-lin",
    senderResidentId: sender,
    content,
    createdAt: new Date().toISOString(),
    via: "knock",
  };
}

function item(
  id: string,
  peerId: string,
  peerName: string,
  unreadCount = 0,
  kind: "human" | "ai" = "human",
): ConversationListItem {
  return {
    conversation: {
      id,
      kind: "direct",
      participantResidentIds: ["you", peerId],
      lastMessageAt: new Date().toISOString(),
      lastMessagePreview: `${peerName}说的最后一句`,
    },
    unreadCount,
    peer: {
      id: peerId,
      displayName: peerName,
      handle: peerId,
      kind,
      observerPresence: "online",
    },
  };
}

function relationView(overrides: { blocking?: boolean; blockedBy?: boolean } = {}) {
  return {
    relation: {
      isNeighbor: false,
      blocking: overrides.blocking ?? false,
      blockedBy: overrides.blockedBy ?? false,
      isSelf: false,
    },
  } as unknown as ResidentHomeResponse;
}

/** §4.5: block lives behind the thread header's overflow menu. */
async function openThreadMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "更多" }));
}

function renderMail(at = "/mail") {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path="/mail" element={<MailScene />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  for (const fn of [
    fetchConversations,
    fetchConversationMessages,
    sendConversationMessage,
    setConversationFocus,
    fetchResidentHome,
    blockResident,
    unblockResident,
  ]) {
    fn.mockReset();
  }
  fetchConversations.mockResolvedValue({ items: [item("c-lin", "lin", "林", 2)] });
  fetchConversationMessages.mockResolvedValue({
    conversation: {},
    messages: [message("m1", "lin", "修好了那个 bug")],
  });
  setConversationFocus.mockResolvedValue(undefined);
  fetchResidentHome.mockResolvedValue(relationView());
  blockResident.mockResolvedValue(undefined);
  unblockResident.mockResolvedValue(undefined);
});

describe("mailbox (§4.12)", () => {
  it("lists the server's conversations", async () => {
    renderMail();
    expect(await screen.findByRole("button", { name: /林/ })).toBeTruthy();
    expect(screen.getByText("林说的最后一句")).toBeTruthy();
  });

  it("shows an empty inbox in words", async () => {
    fetchConversations.mockResolvedValue({ items: [] });
    renderMail();
    expect(await screen.findByText("信箱里还没有纸条")).toBeTruthy();
  });

  it("surfaces a load failure with a retry", async () => {
    fetchConversations.mockRejectedValueOnce(new Error("offline"));
    fetchConversations.mockResolvedValue({ items: [item("c-lin", "lin", "林")] });
    const user = userEvent.setup();
    renderMail();

    expect(await screen.findByRole("alert")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "再试一次" }));
    expect(await screen.findByRole("button", { name: /林/ })).toBeTruthy();
  });

  it("states unread as words, not only a dot", async () => {
    renderMail();
    expect(await screen.findByText("2 条未读")).toBeTruthy();
  });

  it("takes unread from the server, and drops it once the server says so", async () => {
    const user = userEvent.setup();
    renderMail();
    await user.click(await screen.findByRole("button", { name: /林/ }));

    // Reading the thread is what clears it, server-side.
    await waitFor(() => expect(fetchConversationMessages).toHaveBeenCalledWith("c-lin"));
    expect(screen.getByText("2 条未读")).toBeTruthy();

    fetchConversations.mockResolvedValue({ items: [item("c-lin", "lin", "林", 0)] });
    await openThreadMenu(user);
    await user.click(screen.getByRole("button", { name: "挡住 Ta" }));
    await user.click(await screen.findByRole("button", { name: "算了" }));

    // Nothing local cleared it; the count only changes when the server says so.
    expect(screen.getByText("2 条未读")).toBeTruthy();
  });

  it("loads the real messages when a thread opens", async () => {
    const user = userEvent.setup();
    renderMail();
    await user.click(await screen.findByRole("button", { name: /林/ }));
    expect(await screen.findByText("修好了那个 bug")).toBeTruthy();
  });

  it("renders an AI peer with the ◇ identity and does not crash", async () => {
    fetchConversations.mockResolvedValue({ items: [item("c-nan", "nanfeng", "南风", 0, "ai")] });
    const user = userEvent.setup();
    renderMail();

    await user.click(await screen.findByRole("button", { name: /南风/ }));
    const thread = await screen.findByRole("region", { name: "与南风的对话" });
    expect(within(thread).getAllByText("AI 居民").length).toBeGreaterThan(0);
  });

  it("switches threads and re-reads the new one", async () => {
    fetchConversations.mockResolvedValue({
      items: [item("c-lin", "lin", "林"), item("c-ava", "ava", "Ava")],
    });
    const user = userEvent.setup();
    renderMail();

    await user.click(await screen.findByRole("button", { name: /林/ }));
    await waitFor(() => expect(fetchConversationMessages).toHaveBeenCalledWith("c-lin"));

    await user.click(screen.getByRole("button", { name: /Ava/ }));
    await waitFor(() => expect(fetchConversationMessages).toHaveBeenCalledWith("c-ava"));
  });
});

describe("sending", () => {
  it("appends the message the server returned", async () => {
    sendConversationMessage.mockResolvedValue(message("m2", "you", "刚修好，恭喜"));
    const user = userEvent.setup();
    renderMail();

    await user.click(await screen.findByRole("button", { name: /林/ }));
    await user.type(await screen.findByRole("textbox"), "刚修好，恭喜");
    await user.click(screen.getByRole("button", { name: "说出去" }));

    expect(await screen.findByText("刚修好，恭喜")).toBeTruthy();
    expect(sendConversationMessage).toHaveBeenCalledWith("c-lin", "刚修好，恭喜");
  });

  it("adds no fake message when the send fails, and keeps the words", async () => {
    sendConversationMessage.mockRejectedValue(new FakeApiError("blocked"));
    const user = userEvent.setup();
    renderMail();

    await user.click(await screen.findByRole("button", { name: /林/ }));
    const box = await screen.findByRole("textbox");
    await user.type(box, "送不出去的话");
    await user.click(screen.getByRole("button", { name: "说出去" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    // The typed words survive, and no bubble was invented.
    expect((box as HTMLTextAreaElement).value).toBe("送不出去的话");
    const log = screen.getByRole("log");
    expect(within(log).queryByText("送不出去的话")).toBeNull();
  });

  it("never leaks the internal gate code", async () => {
    sendConversationMessage.mockRejectedValue(new FakeApiError("forbidden"));
    const user = userEvent.setup();
    renderMail();

    await user.click(await screen.findByRole("button", { name: /林/ }));
    await user.type(await screen.findByRole("textbox"), "试一句");
    await user.click(screen.getByRole("button", { name: "说出去" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).not.toMatch(/forbidden|blocked|dnd/);
    expect(alert.textContent).toContain("没送出去");
  });

  it("sends from the keyboard with Enter", async () => {
    sendConversationMessage.mockResolvedValue(message("m3", "you", "用键盘说的"));
    const user = userEvent.setup();
    renderMail();

    await user.click(await screen.findByRole("button", { name: /林/ }));
    const box = await screen.findByRole("textbox");
    await user.type(box, "用键盘说的{Enter}");

    await waitFor(() => expect(sendConversationMessage).toHaveBeenCalledWith("c-lin", "用键盘说的"));
  });
});

describe("focus lifecycle (§5.2)", () => {
  it("opens focus when a thread opens", async () => {
    const user = userEvent.setup();
    renderMail();
    await user.click(await screen.findByRole("button", { name: /林/ }));
    await waitFor(() => expect(setConversationFocus).toHaveBeenCalledWith("c-lin", true));
  });

  it("closes focus on the old thread and opens the new one when switching", async () => {
    fetchConversations.mockResolvedValue({
      items: [item("c-lin", "lin", "林"), item("c-ava", "ava", "Ava")],
    });
    const user = userEvent.setup();
    renderMail();

    await user.click(await screen.findByRole("button", { name: /林/ }));
    await waitFor(() => expect(setConversationFocus).toHaveBeenCalledWith("c-lin", true));

    await user.click(screen.getByRole("button", { name: /Ava/ }));
    await waitFor(() => expect(setConversationFocus).toHaveBeenCalledWith("c-lin", false));
    await waitFor(() => expect(setConversationFocus).toHaveBeenCalledWith("c-ava", true));
  });

  it("closes focus when the mailbox unmounts", async () => {
    const user = userEvent.setup();
    const view = renderMail();
    await user.click(await screen.findByRole("button", { name: /林/ }));
    await waitFor(() => expect(setConversationFocus).toHaveBeenCalledWith("c-lin", true));

    view.unmount();
    await waitFor(() => expect(setConversationFocus).toHaveBeenCalledWith("c-lin", false));
  });
});

describe("blocking from the thread (§5.4)", () => {
  it("confirms first, then writes to the server and re-reads", async () => {
    const user = userEvent.setup();
    renderMail();

    await user.click(await screen.findByRole("button", { name: /林/ }));
    await openThreadMenu(user);
    await user.click(screen.getByRole("button", { name: "挡住 Ta" }));

    const confirm = await screen.findByRole("alertdialog");
    expect(confirm.textContent).toContain("挡住林");
    expect(blockResident).not.toHaveBeenCalled();

    fetchResidentHome.mockResolvedValue(relationView({ blocking: true }));
    await user.click(within(confirm).getByRole("button", { name: "挡住 Ta" }));

    await waitFor(() => expect(blockResident).toHaveBeenCalledWith("lin"));
    // Re-read, never a local mute.
    await waitFor(() => expect(fetchConversations).toHaveBeenCalledTimes(2));
  });

  it("closes the composer the moment the block lands", async () => {
    fetchResidentHome.mockResolvedValue(relationView({ blocking: true }));
    const user = userEvent.setup();
    renderMail();

    await user.click(await screen.findByRole("button", { name: /林/ }));

    const box = await screen.findByRole("textbox");
    await waitFor(() => expect((box as HTMLTextAreaElement).disabled).toBe(true));
    expect((box as HTMLTextAreaElement).placeholder).toBe("你挡住了 Ta。");
  });

  it("shows the other side of a block without naming it", async () => {
    fetchResidentHome.mockResolvedValue(relationView({ blockedBy: true }));
    const user = userEvent.setup();
    renderMail();

    await user.click(await screen.findByRole("button", { name: /林/ }));
    const box = await screen.findByRole("textbox");
    await waitFor(() => expect((box as HTMLTextAreaElement).disabled).toBe(true));
    // Not "Ta 挡住了你" — a closed door looks the same from outside.
    expect((box as HTMLTextAreaElement).placeholder).toBe("这家谢绝访客。");
  });

  it("offers to undo a block and re-reads afterwards", async () => {
    fetchResidentHome.mockResolvedValue(relationView({ blocking: true }));
    const user = userEvent.setup();
    renderMail();

    await user.click(await screen.findByRole("button", { name: /林/ }));
    await openThreadMenu(user);
    await user.click(await screen.findByRole("button", { name: "取消挡住" }));

    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "取消挡住" }));

    await waitFor(() => expect(unblockResident).toHaveBeenCalledWith("lin"));
  });

  it("drives the confirmation from the keyboard", async () => {
    const user = userEvent.setup();
    renderMail();

    await user.click(await screen.findByRole("button", { name: /林/ }));
    const menu = screen.getByRole("button", { name: "更多" });
    menu.focus();
    await user.keyboard("{Enter}");
    const trigger = await screen.findByRole("button", { name: "挡住 Ta" });
    trigger.focus();
    await user.keyboard("{Enter}");

    const confirm = await screen.findByRole("alertdialog");
    const yes = within(confirm).getByRole("button", { name: "挡住 Ta" });
    yes.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(blockResident).toHaveBeenCalledWith("lin"));
  });
});
