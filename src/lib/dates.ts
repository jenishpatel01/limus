// Timezone-aware date helpers. Days are bucketed in the user's timezone.

const dayFmtCache = new Map<string, Intl.DateTimeFormat>();

function dayFormatter(tz: string) {
  let f = dayFmtCache.get(tz);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    } catch {
      f = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" });
    }
    dayFmtCache.set(tz, f);
  }
  return f;
}

/** YYYY-MM-DD of an instant in a timezone. */
export function dayKey(input: string | Date, tz: string): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return dayFormatter(tz).format(d);
}

export const monthKey = (day: string) => day.slice(0, 7);

/** Offset (ms) of a timezone at an instant: local wall time − UTC. */
function tzOffset(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The UTC instant of 00:00 on a given YYYY-MM-DD in a timezone. */
export function startOfDayInTz(day: string, tz: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d));
  let off = 0;
  try { off = tzOffset(guess, tz); } catch { off = 0; }
  const first = new Date(guess.getTime() - off);
  let off2 = off;
  try { off2 = tzOffset(first, tz); } catch { /* keep */ }
  return off2 === off ? first : new Date(guess.getTime() - off2);
}

/** "YYYY-MM-DDTHH:mm" wall-clock time in a timezone → UTC ISO string. */
export function wallToUtc(local: string, tz: string): string | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let off = 0;
  try { off = tzOffset(new Date(guess), tz); } catch { off = 0; }
  let t = guess - off;
  try {
    const off2 = tzOffset(new Date(t), tz);
    if (off2 !== off) t = guess - off2;
  } catch { /* keep */ }
  return new Date(t).toISOString();
}

/** UTC ISO → "YYYY-MM-DDTHH:mm" wall-clock time in a timezone (for datetime-local inputs). */
export function utcToWall(iso: string | null | undefined, tz: string): string {
  if (!iso) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(iso));
    const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
    return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
  } catch { return iso.slice(0, 16); }
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday for a YYYY-MM-DD. */
export function weekdayIndex(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export function startOfWeek(day: string): string {
  return addDays(day, -weekdayIndex(day));
}

export type RangePreset = "today" | "week" | "month" | "3m" | "6m" | "year" | "all" | "custom";

export const RANGE_PRESETS: { id: RangePreset; label: string; short: string }[] = [
  { id: "today", label: "Today", short: "1D" },
  { id: "week", label: "This week", short: "1W" },
  { id: "month", label: "This month", short: "1M" },
  { id: "3m", label: "3 months", short: "3M" },
  { id: "6m", label: "6 months", short: "6M" },
  { id: "year", label: "This year", short: "YTD" },
  { id: "all", label: "All time", short: "All" },
  { id: "custom", label: "Custom", short: "Custom" },
];

/** Inclusive day range [from, to]; null bounds mean open-ended. */
export interface DayRange { from: string | null; to: string | null }

export function presetRange(preset: RangePreset, today: string, custom?: DayRange): DayRange {
  switch (preset) {
    case "today": return { from: today, to: today };
    case "week": return { from: startOfWeek(today), to: today };
    case "month": return { from: today.slice(0, 8) + "01", to: today };
    case "3m": return { from: addDays(today, -91), to: today };
    case "6m": return { from: addDays(today, -182), to: today };
    case "year": return { from: today.slice(0, 5) + "01-01", to: today };
    case "custom": return custom ?? { from: null, to: null };
    default: return { from: null, to: null };
  }
}

export function inRange(day: string, r: DayRange): boolean {
  return (!r.from || day >= r.from) && (!r.to || day <= r.to);
}

export function browserTimezone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}
