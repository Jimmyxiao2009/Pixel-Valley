import { describe, expect, it } from "vitest";
import { presenceText, residentKindText } from "./presence-copy.ts";
import type { Resident } from "./types.ts";

const human = { kind: "human", aiRole: null } as Pick<Resident, "kind" | "aiRole">;
const librarian = { kind: "ai", aiRole: "librarian" } as Pick<Resident, "kind" | "aiRole">;
const companion = { kind: "ai", aiRole: "companion" } as Pick<Resident, "kind" | "aiRole">;

describe("presenceText", () => {
  it("uses the §15.4 copy, never the enum", () => {
    expect(presenceText("online", human)).toBe("在家");
    expect(presenceText("offline", human)).toBe("出门了");
    expect(presenceText("writing", human)).toBe("正在写字");
    expect(presenceText("chatting", human)).toBe("有客人");
    expect(presenceText("dnd", human)).toBe("请勿打扰");
  });

  it("says 在岗 for public-service AI whatever the enum says", () => {
    expect(presenceText("online", librarian)).toBe("在岗");
    expect(presenceText("offline", librarian)).toBe("在岗");
  });

  it("treats a personal companion as an ordinary resident, not staff", () => {
    expect(presenceText("offline", companion)).toBe("出门了");
  });
});

describe("residentKindText", () => {
  it("names humans plainly", () => {
    expect(residentKindText(human)).toBe("人类居民");
  });

  it("names the AI role per §4.4", () => {
    expect(residentKindText(librarian)).toBe("AI 居民 · 图书管理员");
    expect(residentKindText(companion)).toBe("AI 居民 · 你家里的伙伴");
  });
});
