// Aggregate performance statistics. Pure functions over closed trades.
// Formulas are documented in docs/ANALYTICS.md and covered by tests.

import { round } from "./pnl";
import { dayKey, monthKey, weekdayIndex, WEEKDAYS } from "../dates";

/** Minimal shape needed for statistics. */
export interface StatTrade {
  id: string;
  net_pnl: number | null;
  gross_pnl: number | null;
  r_multiple: number | null;
  commission: number;
  fees: number;
  entry_at: string;
  exit_at: string | null;
  status: string;
}

export interface Stats {
  totalTrades: number;
  wins: number;
  losses: number;
  breakeven: number;
  /** wins / closed trades × 100 */
  winRate: number | null;
  netPnl: number;
  grossProfit: number;
  /** Positive number: sum of losing trades' absolute net P&L. */
  grossLoss: number;
  /** grossProfit / grossLoss; Infinity when there are wins but no losses. */
  profitFactor: number | null;
  avgWin: number | null;
  /** Positive number. */
  avgLoss: number | null;
  /** avgWin / avgLoss */
  payoffRatio: number | null;
  /** Average net P&L per trade = winRate·avgWin − lossRate·avgLoss. */
  expectancy: number | null;
  avgR: number | null;
  rTrades: number;
  totalR: number;
  largestWin: number | null;
  largestLoss: number | null;
  maxConsecWins: number;
  maxConsecLosses: number;
  /** Positive = current winning streak, negative = losing streak. */
  currentStreak: number;
  totalCosts: number;
  avgHoldMinutes: number | null;
}

export function closedOnly<T extends StatTrade>(trades: T[]): T[] {
  return trades
    .filter((t) => t.status === "closed" && t.net_pnl !== null && t.exit_at)
    .sort((a, b) => (a.exit_at! < b.exit_at! ? -1 : a.exit_at! > b.exit_at! ? 1 : a.id < b.id ? -1 : 1));
}

export function computeStats(input: StatTrade[]): Stats {
  const trades = closedOnly(input);
  let wins = 0, losses = 0, breakeven = 0, grossProfit = 0, grossLoss = 0, netPnl = 0, totalCosts = 0;
  let largestWin: number | null = null, largestLoss: number | null = null;
  let rSum = 0, rTrades = 0, holdSum = 0, holdCount = 0;
  let streak = 0, maxW = 0, maxL = 0;

  for (const t of trades) {
    const p = t.net_pnl!;
    netPnl += p;
    totalCosts += (t.commission ?? 0) + (t.fees ?? 0);
    if (p > 0) {
      wins++; grossProfit += p;
      largestWin = largestWin === null ? p : Math.max(largestWin, p);
      streak = streak > 0 ? streak + 1 : 1;
      maxW = Math.max(maxW, streak);
    } else if (p < 0) {
      losses++; grossLoss += -p;
      largestLoss = largestLoss === null ? p : Math.min(largestLoss, p);
      streak = streak < 0 ? streak - 1 : -1;
      maxL = Math.max(maxL, -streak);
    } else {
      breakeven++; streak = 0;
    }
    if (t.r_multiple !== null && Number.isFinite(t.r_multiple)) { rSum += t.r_multiple; rTrades++; }
    const hold = (new Date(t.exit_at!).getTime() - new Date(t.entry_at).getTime()) / 60000;
    if (Number.isFinite(hold) && hold >= 0) { holdSum += hold; holdCount++; }
  }

  const n = trades.length;
  const avgWin = wins ? grossProfit / wins : null;
  const avgLoss = losses ? grossLoss / losses : null;
  return {
    totalTrades: n,
    wins, losses, breakeven,
    winRate: n ? round((wins / n) * 100, 2) : null,
    netPnl: round(netPnl),
    grossProfit: round(grossProfit),
    grossLoss: round(grossLoss),
    profitFactor: grossLoss > 0 ? round(grossProfit / grossLoss, 2) : grossProfit > 0 ? Infinity : null,
    avgWin: avgWin === null ? null : round(avgWin),
    avgLoss: avgLoss === null ? null : round(avgLoss),
    payoffRatio: avgWin !== null && avgLoss ? round(avgWin / avgLoss, 2) : null,
    expectancy: n ? round(netPnl / n) : null,
    avgR: rTrades ? round(rSum / rTrades, 2) : null,
    rTrades,
    totalR: round(rSum, 2),
    largestWin: largestWin === null ? null : round(largestWin),
    largestLoss: largestLoss === null ? null : round(largestLoss),
    maxConsecWins: maxW,
    maxConsecLosses: maxL,
    currentStreak: streak,
    totalCosts: round(totalCosts),
    avgHoldMinutes: holdCount ? round(holdSum / holdCount, 1) : null,
  };
}

// ───────────── Equity & drawdown ─────────────

export interface CashFlow { at: string; amount: number } // +deposit, −withdrawal

export interface EquityPoint {
  at: string;
  balance: number;
  /** Cumulative trading P&L since the start of the series. */
  cumPnl: number;
  drawdown: number;
  drawdownPct: number;
  kind: "start" | "trade" | "cash";
}

export interface DrawdownSummary {
  maxDrawdown: number;
  maxDrawdownPct: number;
  currentDrawdown: number;
  currentDrawdownPct: number;
}

/**
 * Balance curve from a starting balance, closed trades and cash flows.
 * Deposits and withdrawals move the balance and the running peak together,
 * so they never count as drawdown. Drawdown = peak − balance; % is of the peak.
 */
export function equityCurve(startBalance: number, startAt: string | null, trades: StatTrade[], flows: CashFlow[] = []): { points: EquityPoint[]; dd: DrawdownSummary } {
  type Ev = { at: string; amount: number; kind: "trade" | "cash"; order: number };
  const events: Ev[] = [
    ...closedOnly(trades).map((t, i) => ({ at: t.exit_at!, amount: t.net_pnl!, kind: "trade" as const, order: i })),
    ...flows.map((f, i) => ({ at: f.at, amount: f.amount, kind: "cash" as const, order: i })),
  ].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.kind === b.kind ? a.order - b.order : a.kind === "cash" ? -1 : 1));

  let balance = startBalance, peak = startBalance, cum = 0;
  let maxDD = 0, maxDDPct = 0;
  const points: EquityPoint[] = [{ at: startAt ?? events[0]?.at ?? new Date(0).toISOString(), balance: round(balance), cumPnl: 0, drawdown: 0, drawdownPct: 0, kind: "start" }];
  for (const e of events) {
    balance += e.amount;
    if (e.kind === "cash") peak += e.amount;
    else cum += e.amount;
    if (balance > peak) peak = balance;
    const dd = Math.max(0, peak - balance);
    const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
    if (dd > maxDD) maxDD = dd;
    if (ddPct > maxDDPct) maxDDPct = ddPct;
    points.push({ at: e.at, balance: round(balance), cumPnl: round(cum), drawdown: round(dd), drawdownPct: round(ddPct, 2), kind: e.kind });
  }
  const last = points[points.length - 1];
  return {
    points,
    dd: { maxDrawdown: round(maxDD), maxDrawdownPct: round(maxDDPct, 2), currentDrawdown: last.drawdown, currentDrawdownPct: last.drawdownPct },
  };
}

/** Net profit / max drawdown. */
export function recoveryFactor(netPnl: number, maxDrawdown: number): number | null {
  return maxDrawdown > 0 ? round(netPnl / maxDrawdown, 2) : null;
}

// ───────────── Breakdowns ─────────────

export interface GroupRow {
  key: string;
  label: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  netPnl: number;
  avgR: number | null;
  profitFactor: number | null;
  expectancy: number | null;
}

export function groupBy<T extends StatTrade>(trades: T[], keyOf: (t: T) => string | null, labelOf: (k: string) => string = (k) => k): GroupRow[] {
  const groups = new Map<string, T[]>();
  for (const t of closedOnly(trades)) {
    const k = keyOf(t);
    if (k === null) continue;
    const arr = groups.get(k);
    if (arr) arr.push(t); else groups.set(k, [t]);
  }
  return [...groups.entries()].map(([key, ts]) => {
    const s = computeStats(ts);
    return { key, label: labelOf(key), trades: s.totalTrades, wins: s.wins, losses: s.losses, winRate: s.winRate, netPnl: s.netPnl, avgR: s.avgR, profitFactor: s.profitFactor, expectancy: s.expectancy };
  });
}

export interface DayBucket { day: string; pnl: number; trades: number; wins: number; losses: number }

/** Realised P&L by close day in the user's timezone. */
export function dailyPnl(trades: StatTrade[], tz: string): Map<string, DayBucket> {
  const out = new Map<string, DayBucket>();
  for (const t of closedOnly(trades)) {
    const d = dayKey(t.exit_at!, tz);
    const b = out.get(d) ?? { day: d, pnl: 0, trades: 0, wins: 0, losses: 0 };
    b.pnl = round(b.pnl + t.net_pnl!);
    b.trades++;
    if (t.net_pnl! > 0) b.wins++; else if (t.net_pnl! < 0) b.losses++;
    out.set(d, b);
  }
  return out;
}

export function monthlyPnl(trades: StatTrade[], tz: string): Map<string, DayBucket> {
  const out = new Map<string, DayBucket>();
  for (const b of dailyPnl(trades, tz).values()) {
    const m = monthKey(b.day);
    const cur = out.get(m) ?? { day: m, pnl: 0, trades: 0, wins: 0, losses: 0 };
    cur.pnl = round(cur.pnl + b.pnl); cur.trades += b.trades; cur.wins += b.wins; cur.losses += b.losses;
    out.set(m, cur);
  }
  return out;
}

/** Grouped by the weekday the trade was opened (user timezone). */
export function weekdayBreakdown(trades: StatTrade[], tz: string): GroupRow[] {
  const rows = groupBy(trades, (t) => String(weekdayIndex(dayKey(t.entry_at, tz))), (k) => WEEKDAYS[Number(k)]);
  return rows.sort((a, b) => Number(a.key) - Number(b.key));
}
