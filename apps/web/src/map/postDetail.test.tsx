import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { AiRole, PostDetailResponse, Presence } from "@pixel-valley/domain";
import { PostDetailSheet } from "./PostDetailSheet";

const fetchPost = vi.fn<(id: string, options?: unknown) => Promise<PostDetailResponse>>();
const createReply = vi.fn<(postId: string, content: string) => Promise<unknown>>();
const reactToPost = vi.fn<(postId: string) => Promise<unknown>>();
const fetchResidentHome = vi.fn();

vi.mock("../data/api", () => ({
  ApiError: class ApiError extends Error {
    code = "unknown";
    status = 500;
  },
  fetchPost: (id: string, options?: unknown) => fetchPost(id, options),
  createReply: (postId: string, content: string) => createReply(postId, content),
  reactToPost: (postId: string) => reactToPost(postId),
  fetchResidentHome: () => fetchResidentHome(),
  addNeighborEdge: vi.fn(),
  removeNeighborEdge: vi.fn(),
  recordVisit: vi.fn(() => Promise.resolve()),
  openConversation: vi.fn(),
  blockResident: vi.fn(),
  unblockResident: vi.fn(),
  fetchConversationMessages: vi.fn(),
  sendConversationMessage: vi.fn(),
  setConversationFocus: vi.fn(),
}));

type Author = {
  id: string;
  displayName: string;
  handle: string;
  kind: "human" | "ai";
  aiRole: AiRole | null;
  observerPresence: Presence;
  homeNeighborhoodId?: string | null;
};

const LIN: Author = {
  id: "lin",
  displayName: "林",
  handle: "lin",
  kind: "human",
  aiRole: null,
  observerPresence: "online",
  homeNeighborhoodId: "wutong",
};

const NANFENG: Author = {
  id: "nanfeng",
  displayName: "南风",
  handle: "nanfeng",
  kind: "ai",
  aiRole: "librarian",
  observerPresence: "online",
  homeNeighborhoodId: "zhenxin",
};

function reply(id: string, author: Author | null, content: string) {
  return {
    id,
    postId: "post-lin",
    authorResidentId: author?.id ?? "gone",
    content,
    createdAt: new Date(Date.now() - 600_000).toISOString(),
    author,
  };
}

function detail(overrides: Partial<PostDetailResponse> = {}): PostDetailResponse {
  return {
    post: {
      id: "post-lin",
      authorResidentId: "lin",
      type: "post",
      title: null,
      content: "修好了那个折磨我一周的 bug",
      visibility: "public",
      createdAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
      editedAt: null,
      deletedAt: null,
      replyCount: 0,
      reactionCount: 3,
      tags: ["技术"],
      flags: { hot: false, pinned: false, aiGenerated: false },
    },
    author: LIN as unknown as PostDetailResponse["author"],
    replies: [],
    reacted: false,
    ...overrides,
  } as PostDetailResponse;
}

function Probe() {
  const location = useLocation();
  return <div data-testid="probe">{`${location.pathname}${location.search}`}</div>;
}

function renderSheet(onClose = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={["/town/plaza"]}>
      <Probe />
      <Routes>
        <Route
          path="/town/:zone"
          element={
            <PostDetailSheet
              postId="post-lin"
              excerpt="修好了那个折磨我一周的…"
              authorName="林"
              count24h={0}
              onClose={onClose}
            />
          }
        />
        <Route path="/n/:neighborhoodId" element={<p>户籍街</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  for (const fn of [fetchPost, createReply, reactToPost, fetchResidentHome]) {
    fn.mockReset();
  }
  fetchPost.mockResolvedValue(detail());
  createReply.mockResolvedValue({});
  reactToPost.mockResolvedValue({});
  fetchResidentHome.mockResolvedValue({
    resident: { ...LIN, bio: "", interests: [], avatarSprite: "lin" },
    house: null,
    neighborhood: null,
    relation: { isNeighbor: false, blocking: false, blockedBy: false, isSelf: false },
    latestBubble: null,
    messageGate: { ok: true, via: "knock" },
  });
});

describe("post detail (§4.11)", () => {
  it("shows the sheet at t=0 with the excerpt while the full text loads", async () => {
    let release: (value: PostDetailResponse) => void = () => {};
    fetchPost.mockReturnValue(new Promise((resolve) => (release = resolve)));
    renderSheet();

    // The shell is already there before any network answer.
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("修好了那个折磨我一周的…")).toBeTruthy();

    release(detail());
    expect(await screen.findByText("修好了那个折磨我一周的 bug")).toBeTruthy();
  });

  it("renders the server's full text, not the excerpt it was handed", async () => {
    renderSheet();
    expect(await screen.findByText("修好了那个折磨我一周的 bug")).toBeTruthy();
    expect(screen.queryByText("修好了那个折磨我一周的…")).toBeNull();
  });

  it("shows the author, the time and the tag", async () => {
    renderSheet();
    expect(await screen.findByRole("button", { name: "林，人类居民" })).toBeTruthy();
    expect(screen.getByText(/@lin/)).toBeTruthy();
    expect(screen.getByText("3 小时前")).toBeTruthy();
    expect(screen.getByText("技术")).toBeTruthy();
  });

  it("identifies an AI author with the words, not only the diamond", async () => {
    fetchPost.mockResolvedValue(
      detail({ author: NANFENG as unknown as PostDetailResponse["author"] }),
    );
    renderSheet();
    const line = await screen.findByRole("button", { name: "南风，AI 居民" });
    // §6.3: staff read as on duty. The handle line splits across nodes.
    expect(line.textContent).toContain("在岗");
    expect(line.textContent).toContain("AI 居民");
  });

  it("keeps the PR-9 doorstep link working", async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(await screen.findByRole("button", { name: "去作者家门口" }));
    await waitFor(() =>
      expect(screen.getByTestId("probe").textContent).toBe("/n/wutong?focusResidentId=lin"),
    );
  });

  it("offers a retry when the post cannot be read", async () => {
    fetchPost.mockRejectedValueOnce(new Error("offline"));
    fetchPost.mockResolvedValue(detail());
    const user = userEvent.setup();
    renderSheet();

    expect(await screen.findByRole("alert")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "再试一次" }));
    expect(await screen.findByText("修好了那个折磨我一周的 bug")).toBeTruthy();
  });

  it("does not let a slow post overwrite the one now open", async () => {
    let releaseFirst: (value: PostDetailResponse) => void = () => {};
    fetchPost.mockReturnValueOnce(new Promise((resolve) => (releaseFirst = resolve)));
    fetchPost.mockResolvedValue(
      detail({ post: { ...detail().post, id: "post-neko", content: "第二条帖子" } }),
    );

    const { rerender } = render(
      <MemoryRouter initialEntries={["/town/plaza"]}>
        <Routes>
          <Route
            path="/town/:zone"
            element={
              <PostDetailSheet
                postId="post-lin"
                excerpt="摘要一"
                authorName="林"
                count24h={0}
                onClose={vi.fn()}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    // The reader moves to another post before the first one answers.
    rerender(
      <MemoryRouter initialEntries={["/town/plaza"]}>
        <Routes>
          <Route
            path="/town/:zone"
            element={
              <PostDetailSheet
                postId="post-neko"
                excerpt="摘要二"
                authorName="Neko"
                count24h={0}
                onClose={vi.fn()}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("第二条帖子")).toBeTruthy();

    releaseFirst(detail({ post: { ...detail().post, content: "第一条帖子" } }));

    await waitFor(() => expect(screen.queryByText("第一条帖子")).toBeNull());
    expect(screen.getByText("第二条帖子")).toBeTruthy();
  });
});

describe("拍一拍", () => {
  it("shows the server's count in words", async () => {
    renderSheet();
    expect(await screen.findByRole("button", { name: "拍一拍，已有 3 人拍过" })).toBeTruthy();
  });

  it("calls the real API and adopts the server's new state", async () => {
    fetchPost.mockResolvedValueOnce(detail());
    reactToPost.mockResolvedValue({});
    fetchPost.mockResolvedValueOnce(
      detail({ post: { ...detail().post, reactionCount: 4 }, reacted: true }),
    );

    const user = userEvent.setup();
    renderSheet();
    await user.click(await screen.findByRole("button", { name: "拍一拍，已有 3 人拍过" }));

    expect(reactToPost).toHaveBeenCalledWith("post-lin");
    expect(await screen.findByRole("button", { name: "已经拍过了，共 4 人拍过" })).toBeTruthy();
  });

  it("is add-only: once pressed there is no un-拍", async () => {
    fetchPost.mockResolvedValue(detail({ reacted: true }));
    renderSheet();
    const button = await screen.findByRole("button", { name: /已经拍过了/ });
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("invents no count when the server refuses", async () => {
    reactToPost.mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    renderSheet();

    await user.click(await screen.findByRole("button", { name: "拍一拍，已有 3 人拍过" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "拍一拍，已有 3 人拍过" })).toBeTruthy();
  });

  it("can be pressed from the keyboard", async () => {
    fetchPost.mockResolvedValueOnce(detail());
    fetchPost.mockResolvedValueOnce(
      detail({ post: { ...detail().post, reactionCount: 4 }, reacted: true }),
    );
    const user = userEvent.setup();
    renderSheet();

    const button = await screen.findByRole("button", { name: "拍一拍，已有 3 人拍过" });
    button.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => expect(reactToPost).toHaveBeenCalledWith("post-lin"));
  });
});

describe("回复", () => {
  it("says so when nobody has answered yet", async () => {
    renderSheet();
    expect(await screen.findByText("还没有人接话")).toBeTruthy();
  });

  it("lists the server's replies with their authors", async () => {
    fetchPost.mockResolvedValue(
      detail({
        replies: [
          reply("r1", LIN, "谢谢"),
          reply("r2", NANFENG, "记在书单上了"),
        ] as PostDetailResponse["replies"],
      }),
    );
    renderSheet();

    expect(await screen.findByText("2 条回复")).toBeTruthy();
    const first = screen.getByRole("article", { name: "林的回复" });
    expect(within(first).getByText("谢谢")).toBeTruthy();

    const second = screen.getByRole("article", { name: "南风的回复" });
    expect(within(second).getByText("记在书单上了")).toBeTruthy();
    // AI identity survives into the reply list.
    expect(within(second).getByText("AI 居民")).toBeTruthy();
  });

  it("survives a reply whose author is gone", async () => {
    fetchPost.mockResolvedValue(
      detail({ replies: [reply("r1", null, "旧话")] as PostDetailResponse["replies"] }),
    );
    renderSheet();
    expect(await screen.findByText("旧话")).toBeTruthy();
  });

  it("sends a reply and shows the server's version of the list", async () => {
    fetchPost.mockResolvedValueOnce(detail());
    fetchPost.mockResolvedValueOnce(
      detail({ replies: [reply("r1", LIN, "恭喜")] as PostDetailResponse["replies"] }),
    );

    const user = userEvent.setup();
    renderSheet();
    await screen.findByText("还没有人接话");

    await user.type(screen.getByRole("textbox"), "恭喜");
    await user.click(screen.getByRole("button", { name: "接一句" }));

    expect(createReply).toHaveBeenCalledWith("post-lin", "恭喜");
    expect(await screen.findByText("恭喜")).toBeTruthy();
    expect(screen.getByText("回复贴上去了。")).toBeTruthy();
  });

  it("adds no reply and keeps the words when the server refuses", async () => {
    createReply.mockRejectedValue(new Error("blocked"));
    const user = userEvent.setup();
    renderSheet();
    await screen.findByText("还没有人接话");

    const box = screen.getByRole("textbox");
    await user.type(box, "送不出去的话");
    await user.click(screen.getByRole("button", { name: "接一句" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect((box as HTMLTextAreaElement).value).toBe("送不出去的话");
    expect(screen.getByText("还没有人接话")).toBeTruthy();
  });

  it("will not send an empty reply", async () => {
    const user = userEvent.setup();
    renderSheet();
    await screen.findByText("还没有人接话");

    const send = screen.getByRole("button", { name: "接一句" });
    expect(send.hasAttribute("disabled")).toBe(true);

    await user.type(screen.getByRole("textbox"), "   ");
    expect(screen.getByRole("button", { name: "接一句" }).hasAttribute("disabled")).toBe(true);
    expect(createReply).not.toHaveBeenCalled();
  });

  it("shows the length against the limit", async () => {
    const user = userEvent.setup();
    renderSheet();
    await screen.findByText("还没有人接话");
    await user.type(screen.getByRole("textbox"), "四个字");
    expect(screen.getByText("3/1000")).toBeTruthy();
  });
});

describe("overlay behaviour", () => {
  it("opens the shared peek card from the post author", async () => {
    const user = userEvent.setup();
    renderSheet();
    await user.click(await screen.findByRole("button", { name: "林，人类居民" }));
    expect(await screen.findByRole("dialog", { name: "林" })).toBeTruthy();
  });

  it("opens the shared peek card from a reply author", async () => {
    fetchPost.mockResolvedValue(
      detail({ replies: [reply("r1", LIN, "谢谢")] as PostDetailResponse["replies"] }),
    );
    const user = userEvent.setup();
    renderSheet();

    const article = await screen.findByRole("article", { name: "林的回复" });
    await user.click(within(article).getByRole("button", { name: "林，人类居民" }));
    expect(await screen.findByRole("dialog", { name: "林" })).toBeTruthy();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderSheet(onClose);
    await screen.findByText("修好了那个折磨我一周的 bug");

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("Escape closes only the peek card while it is open", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderSheet(onClose);
    await user.click(await screen.findByRole("button", { name: "林，人类居民" }));
    await screen.findByRole("dialog", { name: "林" });

    await user.keyboard("{Escape}");

    // Back to the post, not out of it.
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "林" })).toBeNull());
    expect(screen.getByText("修好了那个折磨我一周的 bug")).toBeTruthy();
  });

  it("puts focus inside the sheet when it opens", async () => {
    renderSheet();
    await screen.findByText("修好了那个折磨我一周的 bug");
    await waitFor(() => {
      const sheet = screen.getByRole("dialog", { name: "林的帖子" });
      expect(sheet.contains(document.activeElement)).toBe(true);
    });
  });
});
