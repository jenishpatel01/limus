// App-level helpers that combine the pure engine with accounts, ranges and timezones.

import type { CashTransaction, Trade, TradingAccount } from "./types";
import { equityCurve, type EquityPoint } from "./engine/metrics";
import { dayKey, inRange, startOfDayInTz, addDays, type DayRange } from "./dates";
import { dayLabel } from "./format";

/** Closed trades whose close day falls in the range (user timezone). */
export function closedInRange(trades: Trade[], range: DayRange, tz: string): Trade[] {
  return trades.filter((t) => t.status === "closed" && t.exit_at && t.net_pnl !== null && inRange(dayKey(t.exit_at, tz), range));
}

/** Balance curve for a set of accounts limited to a range. Starts from the balance at the range start. */
export function scopedCurve(accounts: TradingAccount[], trades: Trade[], cash: CashTransaction[], range: DayRange, tz: string) {
  const ids = new Set(accounts.map((a) => a.id));
  const startIso = range.from ? startOfDayInTz(range.from, tz).toISOString() : null;
  const endIso = range.to ? startOfDayInTz(addDays(range.to, 1), tz).toISOString() : null;
  const myTrades = trades.filter((t) => ids.has(t.account_id) && t.status === "closed" && t.exit_at && t.net_pnl !== null);
  const myCash = cash.filter((c) => ids.has(c.account_id));
  let start = accounts.reduce((a, x) => a + x.initial_balance, 0);
  if (startIso) {
    for (const t of myTrades) if (t.exit_at! < startIso) start += t.net_pnl!;
    for (const c of myCash) if (c.occurred_at < startIso) start += c.type === "deposit" ? c.amount : -c.amount;
  }
  const within = (iso: string) => (!startIso || iso >= startIso) && (!endIso || iso < endIso);
  return equityCurve(
    start,
    startIso,
    myTrades.filter((t) => within(t.exit_at!)),
    myCash.filter((c) => within(c.occurred_at)).map((c) => ({ at: c.occurred_at, amount: c.type === "deposit" ? c.amount : -c.amount })),
  );
}

export function curveToChart(points: EquityPoint[], tz: string, field: "balance" | "drawdownPct" = "balance") {
  return points.map((p) => {
    const d = dayKey(p.at, tz);
    return { label: dayLabel(d, { day: "numeric", month: "short" }), sub: dayLabel(d), value: p[field] };
  });
}

/** Last N days of daily P&L, including empty days. */
export function dailySeries(map: Map<string, { pnl: number; trades: number }>, from: string, to: string) {
  const out: { label: string; sub: string; value: number; trades: number }[] = [];
  for (let d = from, guard = 0; d <= to && guard < 400; d = addDays(d, 1), guard++) {
    const b = map.get(d);
    out.push({ label: dayLabel(d, { day: "numeric", month: "short" }), sub: dayLabel(d, { weekday: "short", day: "numeric", month: "short", year: "numeric" }), value: b?.pnl ?? 0, trades: b?.trades ?? 0 });
  }
  return out;
}
