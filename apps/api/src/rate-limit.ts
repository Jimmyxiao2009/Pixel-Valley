export class MemoryRateLimiter {
  private readonly hits = new Map<string, number[]>();

  allow(key: string, limit: number, windowMs: number, nowMs: number): boolean {
    const fresh = (this.hits.get(key) ?? []).filter((stamp) => nowMs - stamp < windowMs);
    if (fresh.length >= limit) {
      this.hits.set(key, fresh);
      return false;
    }
    fresh.push(nowMs);
    this.hits.set(key, fresh);
    return true;
  }
}
