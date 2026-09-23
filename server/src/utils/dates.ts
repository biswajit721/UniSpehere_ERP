/**
 * Date helpers for "date-only" values (attendance dates, session windows, admission dates).
 *
 * The database stores these as DATE columns and Prisma hands them back as JS Dates at
 * UTC midnight. Every helper here works purely in UTC on the YYYY-MM-DD string, so results
 * never depend on the server's local timezone (the old code used toDateString(), which did).
 */
import { ApiError } from "./ApiError";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "2026-09-18" -> Date at UTC midnight. Throws 400 for anything that isn't a real calendar date. */
export function parseDateOnly(value: string, fieldName = "date"): Date {
  if (!DATE_RE.test(value)) {
    throw ApiError.badRequest(`${fieldName} must be in YYYY-MM-DD format`);
  }
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw ApiError.badRequest(`${fieldName} is not a valid calendar date`);
  }
  return d;
}

export function formatDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Today's calendar date in the institution's timezone (APP_TIMEZONE, else the server's own). */
export function todayDateOnly(now: Date = new Date()): string {
  const timeZone = process.env.APP_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone;
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

export function diffInDays(later: Date, earlier: Date): number {
  return Math.round((later.getTime() - earlier.getTime()) / 86_400_000);
}

const DAY_CODES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
export type DayCode = (typeof DAY_CODES)[number];

/** Weekday of a date-only value, matching the DayOfWeek enum used by the timetable (SUN has no slots). */
export function weekdayCode(d: Date): DayCode {
  return DAY_CODES[d.getUTCDay()];
}

export function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
}

export function timeToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Whole-number-safe percentage rounded to one decimal place; 0 when nothing was conducted. */
export function percentage(present: number, conducted: number): number {
  if (conducted <= 0) return 0;
  return Math.round((present / conducted) * 1000) / 10;
}
