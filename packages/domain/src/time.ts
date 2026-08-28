export function shanghaiDateKey(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function ageHours(createdAt: string, now: Date): number {
  return Math.max(0, (now.getTime() - Date.parse(createdAt)) / (60 * 60 * 1000));
}
