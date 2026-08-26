import {
  clampPostContent,
  isClosedTag,
  type ClosedTag,
} from "@pixel-valley/domain";

export type ComposerDraft = {
  content: string;
  tag: ClosedTag | null;
};

export function draftStorageKey(residentId: string): string {
  return `pv.draft.${residentId}`;
}

const EMPTY_DRAFT: ComposerDraft = { content: "", tag: null };

export function parseComposerDraft(raw: string | null): ComposerDraft {
  if (!raw) {
    return { ...EMPTY_DRAFT };
  }

  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value === "string") {
      return { content: clampPostContent(value), tag: null };
    }
    if (value && typeof value === "object" && "content" in value) {
      const record = value as { content: unknown; tag?: unknown };
      const content = typeof record.content === "string" ? clampPostContent(record.content) : "";
      const tag = isClosedTag(record.tag) ? record.tag : null;
      return { content, tag };
    }
  } catch {
    return { content: clampPostContent(raw), tag: null };
  }

  return { ...EMPTY_DRAFT };
}

export function loadComposerDraft(residentId: string): ComposerDraft {
  try {
    return parseComposerDraft(localStorage.getItem(draftStorageKey(residentId)));
  } catch {
    return { ...EMPTY_DRAFT };
  }
}

export function saveComposerDraft(residentId: string, draft: ComposerDraft): void {
  try {
    const key = draftStorageKey(residentId);
    if (draft.content.length === 0 && draft.tag === null) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, JSON.stringify({ content: draft.content, tag: draft.tag }));
  } catch {
    // Private mode / quota must not block closing the composer.
  }
}

export function clearComposerDraft(residentId: string): void {
  try {
    localStorage.removeItem(draftStorageKey(residentId));
  } catch {
    // ignore
  }
}
