// The backend partitions items by UTC calendar day (see backend/app/main.py),
// so the dashboard's "day" must also be computed in UTC — otherwise, near
// UTC midnight, "today" in the browser's local timezone would silently pull
// up the wrong (or an empty) shard.

export function toDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function lastNDays(n: number): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i += 1) {
    const d = new Date(now);
    d.setUTCDate(now.getUTCDate() - i);
    days.push(toDateKey(d));
  }
  return days;
}

export function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatDateHeading(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (dateKey === todayKey()) return "Today";
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (dateKey === toDateKey(yesterday)) return "Yesterday";
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}
