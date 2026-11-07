"use client";

import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { useData, useLookups } from "@/lib/data/store";
import type { Trade } from "@/lib/types";
import { ASSET_CLASSES, ASSET_CLASS_LABEL, SESSION_LABEL, type AssetClass, type TradingSession } from "@/lib/engine/instruments";
import { computeStats, groupBy, monthlyPnl, recoveryFactor, weekdayBreakdown, type GroupRow } from "@/lib/engine/metrics";
import { closedInRange, curveToChart, scopedCurve } from "@/lib/analytics";
import { MONTHS } from "@/lib/dates";
import { duration, money, pct, pnlClass, pnlTone, ratio, rMult } from "@/lib/format";
import { Card, CardHeader, EmptyState, PageHeader, Segmented, Select, StatCard, cx } from "@/components/ui";
import { BreakdownBars, DrawdownChart, EquityChart, PnlBars } from "@/components/charts";
import { RangeFilter, useRange } from "@/components/app/RangeFilter";

export function AnalyticsPage() {
  const { scopedAccounts, scopedTrades, cash, tz, currency, strategies } = useData();
  const lookups = useLookups();
  const rangeState = useRange("all", "limus-range-analytics");
  const [accountId, setAccountId] = useState("");
  const [assetClass, setAssetClass] = useState("");
  const [strategyId, setStrategyId] = useState("");
  const [direction, setDirection] = useState("");

  const accountsInView = scopedAccounts.filter((a) => (accountId ? a.id === accountId : a.currency === currency));
  const cur = accountsInView[0]?.currency ?? currency;
  const excludedCount = accountId ? 0 : scopedAccounts.filter((a) => a.currency !== currency).length;

  const trades = useMemo(() => {
    const ids = new Set(accountsInView.map((a) => a.id));
    return scopedTrades.filter((t) => ids.has(t.account_id) && (!assetClass || t.asset_class === assetClass) && (!strategyId || (strategyId === "none" ? !t.strategy_id : t.strategy_id === strategyId)) && (!direction || t.direction === direction));
  }, [scopedTrades, accountsInView, assetClass, strategyId, direction]);

  const closed = useMemo(() => closedInRange(trades, rangeState.range, tz), [trades, rangeState.range, tz]);
  const stats = useMemo(() => computeStats(closed), [closed]);
  const filtersActive = Boolean(assetClass || strategyId || direction);
  // With trade-level filters the curve is cumulative P&L of the filtered trades from the account balance at the range start.
  const curve = useMemo(() => scopedCurve(accountsInView, filtersActive ? trades : scopedTrades, filtersActive ? [] : cash, rangeState.range, tz), [accountsInView, trades, scopedTrades, cash, rangeState.range, tz, filtersActive]);
  const rf = recoveryFactor(stats.netPnl, curve.dd.maxDrawdown);

  const longShort = useMemo(() => groupBy(closed, (t) => (t as Trade).direction, (k) => (k === "long" ? "Long (buy)" : "Short (sell)")), [closed]);
  const byAsset = useMemo(() => groupBy(closed, (t) => (t as Trade).asset_class, (k) => ASSET_CLASS_LABEL[k as AssetClass]).sort((a, b) => b.netPnl - a.netPnl), [closed]);
  const bySession = useMemo(() => groupBy(closed, (t) => (t as Trade).session, (k) => SESSION_LABEL[k as TradingSession]).sort((a, b) => b.netPnl - a.netPnl), [closed]);
  const byWeekday = useMemo(() => weekdayBreakdown(closed, tz), [closed, tz]);
  const byStrategy = useMemo(() => groupBy(closed, (t) => (t as Trade).strategy_id ?? "none", (k) => (k === "none" ? "No strategy" : lookups.strategy.get(k)?.name ?? "Deleted strategy")).sort((a, b) => b.netPnl - a.netPnl), [closed, lookups]);
  const bySymbol = useMemo(() => groupBy(closed, (t) => (t as Trade).symbol).sort((a, b) => b.trades - a.trades).slice(0, 10), [closed]);
  const monthly = useMemo(() => monthlyPnl(closed, tz), [closed, tz]);
  const rDist = useMemo(() => {
    const labels = ["≤ −2R", "−2 to −1R", "−1 to 0R", "0 to 1R", "1 to 2R", "2 to 3R", "3 to 4R", "≥ 4R"];
    const counts = new Array(labels.length).fill(0);
    for (const t of closed) {
      if (t.r_multiple === null) continue;
      const r = t.r_multiple;
      const i = r <= -2 ? 0 : r <= -1 ? 1 : r < 0 ? 2 : r < 1 ? 3 : r < 2 ? 4 : r < 3 ? 5 : r < 4 ? 6 : 7;
      counts[i]++;
    }
    return labels.map((label, i) => ({ label, value: counts[i], positive: i >= 3 }));
  }, [closed]);

  const hasData = closed.length > 0;

  return (
    <>
      <PageHeader title="Analytics" icon={<BarChart3 />} description="How your trading performs, from the trades you've closed." actions={<RangeFilter state={rangeState} />} />

      <Card className="mb-6 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Select aria-label="Account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">All accounts in view ({currency})</option>
            {scopedAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}
          </Select>
          <Select aria-label="Asset class" value={assetClass} onChange={(e) => setAssetClass(e.target.value)}><option value="">All asset classes</option>{ASSET_CLASSES.map((c) => <option key={c} value={c}>{ASSET_CLASS_LABEL[c]}</option>)}</Select>
          <Select aria-label="Strategy" value={strategyId} onChange={(e) => setStrategyId(e.target.value)}><option value="">All strategies</option><option value="none">No strategy</option>{strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
          <Segmented size="md" ariaLabel="Direction" value={direction} onChange={setDirection} options={[{ value: "", label: "Both" }, { value: "long", label: "Long" }, { value: "short", label: "Short" }]} className="w-full [&>button]:flex-1" />
        </div>
        {excludedCount > 0 && <p className="mt-2 px-1 text-[12px] text-muted">{excludedCount} account{excludedCount === 1 ? "" : "s"} in another currency {excludedCount === 1 ? "is" : "are"} excluded. Pick it above to analyse it on its own.</p>}
      </Card>

      {!hasData ? (
        <Card><EmptyState icon={<BarChart3 />} title="No closed trades match" description="Analytics are calculated from closed trades. Change the filters or date range, or log some trades." /></Card>
      ) : (
        <>
          <div className="stagger mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
            <StatCard label="Net P&L" value={money(stats.netPnl, cur, { sign: true })} tone={pnlTone(stats.netPnl)} sub={`${stats.totalTrades} trades`} />
            <StatCard label="Win rate" value={pct(stats.winRate)} sub={`${stats.wins}W · ${stats.losses}L · ${stats.breakeven}BE`} hint="Winning trades ÷ closed trades" />
            <StatCard label="Profit factor" value={ratio(stats.profitFactor)} hint="Gross profit ÷ gross loss" />
            <StatCard label="Expectancy" value={money(stats.expectancy, cur)} tone={pnlTone(stats.expectancy)} hint="Average net P&L per trade" sub="per trade" />
            <StatCard label="Average R" value={rMult(stats.avgR)} tone={pnlTone(stats.avgR)} sub={`${stats.rTrades} with a stop`} />
            <StatCard label="Total R" value={rMult(stats.totalR)} tone={pnlTone(stats.totalR)} />
            <StatCard label="Average win" value={money(stats.avgWin, cur)} tone={stats.avgWin ? "profit" : null} sub={`largest ${money(stats.largestWin, cur, { compact: true })}`} />
            <StatCard label="Average loss" value={stats.avgLoss !== null ? money(-stats.avgLoss, cur) : "—"} tone={stats.avgLoss ? "loss" : null} sub={`largest ${money(stats.largestLoss, cur, { compact: true })}`} />
            <StatCard label="Payoff ratio" value={ratio(stats.payoffRatio)} hint="Average win ÷ average loss" />
            <StatCard label="Max drawdown" value={pct(curve.dd.maxDrawdownPct, 2)} tone={curve.dd.maxDrawdown ? "loss" : null} sub={money(-curve.dd.maxDrawdown, cur, { compact: true })} />
            <StatCard label="Recovery factor" value={ratio(rf)} hint="Net profit ÷ max drawdown" />
            <StatCard label="Streaks" value={<span><span className="text-profit">{stats.maxConsecWins}W</span> <span className="text-faint">/</span> <span className="text-loss">{stats.maxConsecLosses}L</span></span>} sub={`avg hold ${duration(stats.avgHoldMinutes)}`} hint="Most consecutive wins / losses" />
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <Card><CardHeader title="Equity curve" subtitle={filtersActive ? "Balance from filtered trades only" : "Balance including deposits and withdrawals"} /><div className="p-4 pt-3"><EquityChart data={curveToChart(curve.points, tz)} currency={cur} /></div></Card>
            <Card><CardHeader title="Drawdown curve" subtitle="% below the running peak" /><div className="p-4 pt-3"><DrawdownChart data={curveToChart(curve.points, tz, "drawdownPct")} height={260} /></div></Card>
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Long vs short" />
              <div className="grid grid-cols-2 gap-px overflow-hidden rounded-b-lg bg-line mt-4">
                {(["long", "short"] as const).map((d) => {
                  const r = longShort.find((x) => x.key === d);
                  return (
                    <div key={d} className="bg-surface p-5">
                      <p className="text-[13px] font-medium">{d === "long" ? "Long (buy)" : "Short (sell)"}</p>
                      <p className={cx("tnum mt-2 text-[22px] font-medium tracking-[-0.03em]", pnlClass(r?.netPnl))}>{money(r?.netPnl ?? 0, cur, { sign: true })}</p>
                      <dl className="mt-3 space-y-1.5 text-[12.5px]">
                        <Mini label="Trades" value={String(r?.trades ?? 0)} />
                        <Mini label="Win rate" value={pct(r?.winRate)} />
                        <Mini label="Profit factor" value={ratio(r?.profitFactor)} />
                        <Mini label="Avg R" value={rMult(r?.avgR)} />
                      </dl>
                    </div>
                  );
                })}
              </div>
            </Card>
            <Card>
              <CardHeader title="R-multiple distribution" subtitle="Closed trades with a stop loss or risk amount" />
              <div className="p-4 pt-3">
                <RDistribution data={rDist} />
              </div>
            </Card>
          </div>

          <Card className="mb-6">
            <CardHeader title="Monthly P&L heatmap" subtitle={`Net P&L by close month (${cur})`} />
            <div className="overflow-x-auto p-5"><Heatmap monthly={monthly} currency={cur} /></div>
          </Card>

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <BreakdownCard title="Strategy comparison" rows={byStrategy} currency={cur} />
            <BreakdownCard title="Asset-class performance" rows={byAsset} currency={cur} />
            <BreakdownCard title="Session performance" rows={bySession} currency={cur} subtitle="By entry time (UTC session hours)" />
            <Card>
              <CardHeader title="Weekday performance" subtitle="By the day the trade was opened" />
              <div className="p-4 pt-3"><PnlBars data={byWeekday.map((r) => ({ label: r.label, value: r.netPnl, trades: r.trades }))} currency={cur} height={220} /></div>
            </Card>
          </div>

          <BreakdownCard title="Top symbols" subtitle="10 most traded" rows={bySymbol} currency={cur} />
        </>
      )}
    </>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><dt className="text-muted">{label}</dt><dd className="tnum text-ink">{value}</dd></div>;
}

export function BreakdownCard({ title, subtitle, rows, currency }: { title: string; subtitle?: string; rows: GroupRow[]; currency: string }) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <div className="px-5 pb-2 pt-4"><BreakdownBars rows={rows.map((r) => ({ label: r.label, value: r.netPnl }))} currency={currency} /></div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[480px] text-[12.5px]">
          <thead><tr className="border-y border-line bg-subtle text-left text-muted"><th className="px-5 py-2 font-medium">Name</th><th className="px-2 py-2 text-right font-medium">Trades</th><th className="px-2 py-2 text-right font-medium">Win rate</th><th className="px-2 py-2 text-right font-medium">PF</th><th className="px-2 py-2 text-right font-medium">Avg R</th><th className="px-5 py-2 text-right font-medium">Net P&amp;L</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-line last:border-0">
                <td className="max-w-[180px] truncate px-5 py-2">{r.label}</td>
                <td className="tnum px-2 py-2 text-right">{r.trades}</td>
                <td className="tnum px-2 py-2 text-right">{pct(r.winRate)}</td>
                <td className="tnum px-2 py-2 text-right">{ratio(r.profitFactor)}</td>
                <td className="tnum px-2 py-2 text-right">{rMult(r.avgR)}</td>
                <td className={cx("tnum px-5 py-2 text-right font-medium", pnlClass(r.netPnl))}>{money(r.netPnl, currency, { sign: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function RDistribution({ data }: { data: { label: string; value: number; positive: boolean }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex h-[220px] items-end gap-2" role="img" aria-label={data.map((d) => `${d.label}: ${d.value}`).join(", ")}>
      {data.map((d) => (
        <div key={d.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5" title={`${d.label}: ${d.value} trades`}>
          <span className="tnum text-[11px] text-muted">{d.value || ""}</span>
          <div className={cx("w-full max-w-10 rounded-[4px]", d.positive ? "bg-profit" : "bg-loss")} style={{ height: `${(d.value / max) * 75}%`, minHeight: d.value ? 3 : 0 }} />
          <span className="w-full truncate text-center text-[10.5px] text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Year × month grid. Diverging colour: green for profit, red for loss, intensity by size; value printed in each cell. */
export function Heatmap({ monthly, currency }: { monthly: Map<string, { pnl: number; trades: number }>; currency: string }) {
  const years = [...new Set([...monthly.keys()].map((k) => k.slice(0, 4)))].sort().reverse();
  const max = Math.max(...[...monthly.values()].map((b) => Math.abs(b.pnl)), 1);
  if (!years.length) return <p className="text-[13px] text-muted">No data</p>;
  return (
    <table className="w-full min-w-[760px] border-separate border-spacing-1 text-[11.5px]">
      <thead><tr><th className="w-14" />{MONTHS.map((m) => <th key={m} className="font-medium text-muted">{m}</th>)}<th className="font-medium text-muted">Year</th></tr></thead>
      <tbody>
        {years.map((y) => {
          let total = 0;
          return (
            <tr key={y}>
              <th className="pr-2 text-left font-medium text-ink-3">{y}</th>
              {MONTHS.map((m, i) => {
                const b = monthly.get(`${y}-${String(i + 1).padStart(2, "0")}`);
                if (b) total += b.pnl;
                const a = b ? 0.12 + (Math.abs(b.pnl) / max) * 0.6 : 0;
                return (
                  <td key={m} title={b ? `${m} ${y}: ${money(b.pnl, currency)} · ${b.trades} trades` : `${m} ${y}: no trades`}
                    className="tnum h-11 rounded-md px-1 text-center"
                    style={{ background: b ? `color-mix(in oklab, ${b.pnl >= 0 ? "var(--profit)" : "var(--loss)"} ${Math.round(a * 100)}%, var(--surface))` : "var(--bg-subtle)" }}>
                    {b ? <span className="font-medium text-ink">{money(b.pnl, currency, { compact: true })}</span> : <span className="text-faint">·</span>}
                  </td>
                );
              })}
              <td className={cx("tnum px-2 text-right font-medium", pnlClass(total))}>{money(total, currency, { compact: true, sign: true })}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
