const FOCUS_TTL_MS = 90_000;

type FocusKey = `${string}:${string}`;

function focusKey(residentId: string, conversationId: string): FocusKey {
  return `${residentId}:${conversationId}`;
}

export class MemoryPresenceAdapter {
  private readonly writing = new Set<string>();
  private readonly chattingHosts = new Set<string>();
  private readonly focus = new Map<FocusKey, { open: boolean; at: number }>();

  setWriting(residentId: string, on: boolean): void {
    if (on) {
      this.writing.add(residentId);
    } else {
      this.writing.delete(residentId);
    }
  }

  isWriting(residentId: string): boolean {
    return this.writing.has(residentId);
  }

  setFocus(residentId: string, conversationId: string, open: boolean, at: number): void {
    this.focus.set(focusKey(residentId, conversationId), { open, at });
  }

  getFocus(
    residentId: string,
    conversationId: string,
    nowMs: number,
  ): { open: boolean; at: number } | undefined {
    const row = this.focus.get(focusKey(residentId, conversationId));
    if (!row) {
      return undefined;
    }
    if (row.open && nowMs - row.at > FOCUS_TTL_MS) {
      return { open: false, at: row.at };
    }
    return row;
  }

  setChattingHost(residentId: string, on: boolean): void {
    if (on) {
      this.chattingHosts.add(residentId);
    } else {
      this.chattingHosts.delete(residentId);
    }
  }

  isChattingHost(residentId: string): boolean {
    return this.chattingHosts.has(residentId);
  }
}
