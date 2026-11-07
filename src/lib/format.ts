// Display formatting. Missing values render as an em dash, never as 0.

const moneyCache = new Map<string, Intl.NumberFormat>();

export function money(value: number | null | undefined, currency = "USD", opts: { sign?: boolean; compact?: boolean } = {}): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const key = `${currency}|${opts.compact ? 1 : 0}`;
  let f = moneyCache.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat("en-US", { style: "currency", currency, notation: opts.compact ? "compact" : "standard", maximumFractionDigits: opts.compact ? 1 : 2, minimumFractionDigits: opts.compact ? 0 : 2 });
    } catch {
      f = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
    }
    moneyCache.set(key, f);
  }
  const s = f.format(Math.abs(value) < 0.005 ? 0 : value);
  if (opts.sign && value > 0.004) return "+" + s;
  return s;
}

export function num(value: number | null | undefined, dp = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { maximumFractionDigits: dp, minimumFractionDigits: 0 });
}

export function fixed(value: number | null | undefined, dp = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { maximumFractionDigits: dp, minimumFractionDigits: dp });
}

export function pct(value: number | null | undefined, dp = 1, sign = false): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const s = `${value.toFixed(dp)}%`;
  return sign && value > 0 ? `+${s}` : s;
}

export function ratio(value: number | null | undefined, dp = 2): string {
  if (value === null || value === undefined) return "—";
  if (value === Infinity) return "∞";
  return value.toFixed(dp);
}

export function rMult(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}R`;
}

/** Prices: keep up to the precision the user typed (max 10 dp). */
export function price(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const dp = abs >= 1000 ? 2 : abs >= 10 ? 3 : abs >= 1 ? 5 : 6;
  return value.toLocaleString("en-US", { maximumFractionDigits: Math.max(dp, decimalsOf(value)), minimumFractionDigits: Math.min(2, dp) });
}

function decimalsOf(v: number): number {
  const s = String(v);
  const i = s.indexOf(".");
  return i < 0 ? 0 : Math.min(10, s.length - i - 1);
}

export function dateTime(iso: string | null | undefined, tz: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
  } catch { return iso; }
}

export function date(iso: string | null | undefined, tz: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
  } catch { return iso; }
}

/** Format a YYYY-MM-DD day key without timezone shifts. */
export function dayLabel(day: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d || 1)));
}

export function duration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return "—";
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
  return `${Math.floor(minutes / 1440)}d ${Math.round((minutes % 1440) / 60)}h`;
}

export function pnlTone(v: number | null | undefined): "profit" | "loss" | null {
  if (v === null || v === undefined || Math.abs(v) < 0.005) return null;
  return v > 0 ? "profit" : "loss";
}

export function pnlClass(v: number | null | undefined): string {
  const t = pnlTone(v);
  return t === "profit" ? "text-profit" : t === "loss" ? "text-loss" : "text-ink";
}

export function relativeTime(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
