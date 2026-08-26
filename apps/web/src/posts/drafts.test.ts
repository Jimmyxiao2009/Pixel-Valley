import { describe, expect, it } from "vitest";
import { draftStorageKey, parseComposerDraft } from "./drafts";

describe("composer drafts", () => {
  it("uses pv.draft.{residentId}", () => {
    expect(draftStorageKey("you")).toBe("pv.draft.you");
    expect(draftStorageKey("lin")).toBe("pv.draft.lin");
  });

  it("parses JSON, plain strings, and invalid payloads", () => {
    expect(parseComposerDraft(null)).toEqual({ content: "", tag: null });
    expect(parseComposerDraft(JSON.stringify({ content: "今晚灯很暖", tag: "生活" }))).toEqual({
      content: "今晚灯很暖",
      tag: "生活",
    });
    expect(parseComposerDraft(JSON.stringify({ content: "一句", tag: "八卦" }))).toEqual({
      content: "一句",
      tag: null,
    });
    expect(parseComposerDraft('"纯文本草稿"')).toEqual({ content: "纯文本草稿", tag: null });
    expect(parseComposerDraft("未写成 JSON 的一句")).toEqual({
      content: "未写成 JSON 的一句",
      tag: null,
    });
    expect(parseComposerDraft("{")).toEqual({ content: "{", tag: null });
  });
});
