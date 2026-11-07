// Builds report data from the user's records. Pure, so it can be tested and reused by PDF/CSV export.

import type { CashTransaction, ReportPeriod, Strategy, Trade, TradingAccount } from "@/lib/types";
import { computeStats, dailyPnl, groupBy, recoveryFactor, type GroupRow, type Stats, type EquityPoint, type DrawdownSummary } from "@/lib/engine/metrics";
import { ASSET_CLASS_LABEL, type AssetClass } from "@/lib/engine/instruments";
import { closedInRange, scopedCurve } from "@/lib/analytics";
import { addDays, startOfWeek, daysInMonth } from "@/lib/dates";

export interface ReportSpec {
  period: ReportPeriod;
  from: string;
  to: string;
  accountId: string | null;
  strategyId: string | null;
  title: string;
}

export interface ReportData {
  spec: ReportSpec;
  currency: string;
  accountNames: string[];
  strategyName: string | null;
  stats: Stats;
  recovery: number | null;
  curve: EquityPoint[];
  dd: DrawdownSummary;
  startBalance: number;
  endBalance: number;
  days: { day: string; pnl: number; trades: number; wins: number; losses: number }[];
  byAsset: GroupRow[];
  byStrategy: GroupRow[];
  bySymbol: GroupRow[];
  trades: Trade[];
  deposits: number;
  withdrawals: number;
}

/** Date range for a report period anchored on a day (YYYY-MM-DD). */
export function periodRange(period: ReportPeriod, anchor: string): { from: string; to: string } {
  switch (period) {
    case "daily": return { from: anchor, to: anchor };
    case "weekly": { const f = startOfWeek(anchor); return { from: f, to: addDays(f, 6) }; }
    case "monthly": { const [y, m] = anchor.split("-").map(Number); return { from: `${anchor.slice(0, 7)}-01`, to: `${anchor.slice(0, 7)}-${String(daysInMonth(y, m)).padStart(2, "0")}` }; }
    case "yearly": return { from: `${anchor.slice(0, 4)}-01-01`, to: `${anchor.slice(0, 4)}-12-31` };
    default: return { from: anchor, to: anchor };
  }
}

export function buildReport(spec: ReportSpec, ctx: { accounts: TradingAccount[]; trades: Trade[]; cash: CashTransaction[]; strategies: Strategy[]; tz: string; currency: string }): ReportData {
  const accounts = spec.accountId ? ctx.accounts.filter((a) => a.id === spec.accountId) : ctx.accounts.filter((a) => a.currency === ctx.currency);
  const currency = accounts[0]?.currency ?? ctx.currency;
  const ids = new Set(accounts.map((a) => a.id));
  const range = { from: spec.from, to: spec.to };
  let trades = ctx.trades.filter((t) => ids.has(t.account_id));
  if (spec.strategyId) trades = trades.filter((t) => t.strategy_id === spec.strategyId);
  const closed = closedInRange(trades, range, ctx.tz).sort((a, b) => a.exit_at!.localeCompare(b.exit_at!));
  const stats = computeStats(closed);
  const curveRes = spec.strategyId
    ? scopedCurve(accounts, trades, [], range, ctx.tz)
    : scopedCurve(accounts, ctx.trades, ctx.cash, range, ctx.tz);
  const flows = ctx.cash.filter((c) => ids.has(c.account_id) && (!spec.from || c.occurred_at.slice(0, 10) >= spec.from) && (!spec.to || c.occurred_at.slice(0, 10) <= spec.to));
  const strategyName = (id: string) => ctx.strategies.find((s) => s.id === id)?.name ?? "Deleted strategy";
  return {
    spec,
    currency,
    accountNames: accounts.map((a) => a.name),
    strategyName: spec.strategyId ? strategyName(spec.strategyId) : null,
    stats,
    recovery: recoveryFactor(stats.netPnl, curveRes.dd.maxDrawdown),
    curve: curveRes.points,
    dd: curveRes.dd,
    startBalance: curveRes.points[0]?.balance ?? 0,
    endBalance: curveRes.points.at(-1)?.balance ?? 0,
    days: [...dailyPnl(closed, ctx.tz).values()].sort((a, b) => a.day.localeCompare(b.day)),
    byAsset: groupBy(closed, (t) => (t as Trade).asset_class, (k) => ASSET_CLASS_LABEL[k as AssetClass]).sort((a, b) => b.netPnl - a.netPnl),
    byStrategy: groupBy(closed, (t) => (t as Trade).strategy_id ?? "none", (k) => (k === "none" ? "No strategy" : strategyName(k))).sort((a, b) => b.netPnl - a.netPnl),
    bySymbol: groupBy(closed, (t) => (t as Trade).symbol).sort((a, b) => b.netPnl - a.netPnl),
    trades: closed,
    deposits: flows.filter((c) => c.type === "deposit").reduce((a, c) => a + c.amount, 0),
    withdrawals: flows.filter((c) => c.type === "withdrawal").reduce((a, c) => a + c.amount, 0),
  };
}

/** Compact summary stored with a saved report. */
export function summarize(r: ReportData) {
  return {
    currency: r.currency, netPnl: r.stats.netPnl, trades: r.stats.totalTrades, winRate: r.stats.winRate,
    profitFactor: r.stats.profitFactor === Infinity ? "inf" : r.stats.profitFactor, maxDrawdownPct: r.dd.maxDrawdownPct, accounts: r.accountNames,
  };
}
