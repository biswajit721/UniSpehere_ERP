/**
 * Date helpers for calendar dates (YYYY-MM-DD) that never depend on the browser's timezone offset.
 * `new Date().toISOString().slice(0, 10)` returns the UTC date, which is "yesterday" in India between
 * 00:00 and 05:30 - the old attendance screen used it to pre-fill today's date.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** Today's date in the user's own timezone as YYYY-MM-DD. */
export function todayLocal(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const parse = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** "2026-09-18" -> "18 September 2026" */
export function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(parse(iso));
}

/** "2026-09-18" -> "18 Sep 2026" */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(parse(iso));
}

/** "2026-09-18" -> "Fri" */
export function weekdayShort(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(parse(iso));
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** 120 -> "2 h", 90 -> "1 h 30 min", 45 -> "45 min" */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} h ${m} min`;
  return h ? `${h} h` : `${m} min`;
}

export function isOutside(date: string, start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  return date < start || date > end;
}
