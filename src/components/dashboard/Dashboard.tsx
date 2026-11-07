"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BookOpen, Briefcase, Crosshair, FlaskConical, Gauge, Layers, Percent, Scale, Sigma, TrendingDown, Trophy, Upload,
} from "lucide-react";
import { useData, useLookups } from "@/lib/data/store";
import { combineAccounts } from "@/lib/engine/accounts";
import { computeStats, dailyPnl, groupBy, monthlyPnl } from "@/lib/engine/metrics";
import { ASSET_CLASS_LABEL, type AssetClass } from "@/lib/engine/instruments";
import { closedInRange, curveToChart, dailySeries, scopedCurve } from "@/lib/analytics";
import { addDays, dayKey, type DayRange } from "@/lib/dates";
import { dateTime, dayLabel, money, pct, pnlClass, pnlTone, ratio, rMult } from "@/lib/format";
import { calcTrade } from "@/lib/engine/pnl";
import { Badge, ButtonLink, Card, CardHeader, EmptyState, StatCard, cx } from "@/components/ui";
import { EquityChart, PnlBars, RingChart } from "@/components/charts";
import { RangeFilter, useRange } from "@/components/app/RangeFilter";
import { CountUp } from "@/components/motion";
import { isDemoStrategy } from "@/lib/demo/seed";

export function Dashboard() {
  const data = useData();
  const { profile, user, scopedAccounts, scopedTrades, summaries, cash, tz, currency, scope, journal, strategies } = data;
  const lookups = useLookups();
  const rangeState = useRange("all", "limus-range-dashboard");
  const { range, today } = rangeState;

  const name = profile?.display_name?.split(" ")[0] || user.email?.split("@")[0] || "trader";
  const scopedSummaries = scopedAccounts.map((a) => summaries.get(a.id)!).filter(Boolean);
  const portfolio = combineAccounts(scopedSummaries, currency);
  const accountsInCurrency = scopedAccounts.filter((a) => a.currency === currency);

  const closed = useMemo(() => closedInRange(scopedTrades.filter((t) => accountsInCurrency.some((a) => a.id === t.account_id)), range, tz), [scopedTrades, accountsInCurrency, range, tz]);
  const stats = useMemo(() => computeStats(closed), [closed]);
  const curve = useMemo(() => scopedCurve(accountsInCurrency, scopedTrades, cash, range, tz), [accountsInCurrency, scopedTrades, cash, range, tz]);
  const avgPlannedRR = useMemo(() => {
    const rr = closed.map((t) => calcTrade({ direction: t.direction, status: "closed", entryPrice: t.entry_price, stopLoss: t.stop_loss, takeProfit: t.take_profit, quantity: t.quantity, contractSize: t.contract_size, fxRate: t.fx_rate }).plannedRR).filter((x): x is number => x !== null);
    return rr.length ? rr.reduce((a, b) => a + b, 0) / rr.length : null;
  }, [closed]);

  const daily = useMemo(() => dailyPnl(closed, tz), [closed, tz]);
  const dailyFrom = range.from && range.from > addDays(today, -60) ? range.from : addDays(today, -29);
  const dailyData = dailySeries(daily, dailyFrom, range.to ?? today);

  const monthly = useMemo(() => {
    const m = monthlyPnl(scopedTrades.filter((t) => accountsInCurrency.some((a) => a.id === t.account_id)), tz);
    const out = [];
    const [y, mo] = today.split("-").map(Number);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(y, mo - 1 - i, 1));
      const key = d.toISOString().slice(0, 7);
      const b = m.get(key);
      out.push({ label: dayLabel(key + "-01", { month: "short" }), sub: dayLabel(key + "-01", { month: "long", year: "numeric" }), value: b?.pnl ?? 0, trades: b?.trades ?? 0 });
    }
    return out;
  }, [scopedTrades, accountsInCurrency, tz, today]);

  const allocation = useMemo(() => {
    const rows = groupBy(closed, (t) => (t as typeof closed[number]).asset_class);
    return rows.sort((a, b) => b.trades - a.trades).map((r) => ({ label: ASSET_CLASS_LABEL[r.key as AssetClass], value: r.trades, display: money(r.netPnl, currency, { compact: true }) }));
  }, [closed, currency]);

  const strategyRows = useMemo(() => groupBy(closed, (t) => (t as typeof closed[number]).strategy_id), [closed]);
  const best = strategyRows.filter((r) => r.trades >= 3).sort((a, b) => b.netPnl - a.netPnl)[0] ?? strategyRows.sort((a, b) => b.netPnl - a.netPnl)[0];
  const bestStrategy = best ? lookups.strategy.get(best.key) : null;

  const comparison = useMemo(() => {
    let cur: DayRange, prev: DayRange;
    if (range.from && range.to) {
      const len = Math.round((Date.parse(range.to) - Date.parse(range.from)) / 86400_000) + 1;
      cur = range;
      prev = { from: addDays(range.from, -len), to: addDays(range.from, -1) };
    } else {
      cur = { from: addDays(today, -29), to: today };
      prev = { from: addDays(today, -59), to: addDays(today, -30) };
    }
    const scoped = scopedTrades.filter((t) => accountsInCurrency.some((a) => a.id === t.account_id));
    return { cur: computeStats(closedInRange(scoped, cur, tz)), prev: computeStats(closedInRange(scoped, prev, tz)), label: range.from && range.to ? "vs previous period" : "Last 30 days vs prior 30" };
  }, [range, today, scopedTrades, accountsInCurrency, tz]);

  const openTrades = scopedTrades.filter((t) => t.status === "open");
  const recent = [...scopedTrades].sort((a, b) => (b.exit_at ?? b.entry_at).localeCompare(a.exit_at ?? a.entry_at)).slice(0, 6);
  const scopedTradeIds = new Set(scopedTrades.map((t) => t.id));
  const recentJournal = journal.filter((j) => (j.trade_id ? scopedTradeIds.has(j.trade_id) : scope.kind !== "demo")).slice(0, 4);

  if (scopedAccounts.length === 0) {
    return (
      <>
        <Header name={name} rangeState={rangeState} />
        <Card><EmptyState icon={<Briefcase />} title="No accounts in this view" description="Create a trading account to start tracking balances and trades." action={<ButtonLink href="/app/portfolio?new=1" variant="primary">Create account</ButtonLink>} /></Card>
      </>
    );
  }

  const noTrades = scopedTrades.length === 0;

  return (
    <>
      <Header name={name} rangeState={rangeState} />

      {portfolio.excluded.length > 0 && (
        <p className="-mt-3 mb-5 text-[12.5px] text-muted">
          Totals are in {currency}. {portfolio.excluded.map((s) => s.account.name).join(", ")} use{portfolio.excluded.length === 1 ? "s" : ""} a different currency and {portfolio.excluded.length === 1 ? "is" : "are"} shown separately in Portfolio.
        </p>
      )}

      {noTrades && (
        <Card className="mb-6">
          <EmptyState icon={<BookOpen />} title="Log your first trade" description="Your dashboard fills in as you add trades. Add one manually, import a CSV from your broker, or explore the demo account."
            action={<>
              <ButtonLink href="/app/journal/new" variant="primary">Add trade</ButtonLink>
              <ButtonLink href="/app/import" icon={<Upload className="size-4" />}>Import CSV</ButtonLink>
              {!data.hasDemo && <ButtonLink href="/app/settings#demo" icon={<FlaskConical className="size-4" />}>Load demo data</ButtonLink>}
            </>} />
        </Card>
      )}

      {/* Portfolio summary */}
      <Card className="mb-6 overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,320px)_1fr]">
          <div className="relative overflow-hidden border-b border-line p-5 lg:border-b-0 lg:border-r">
            <div aria-hidden className="pointer-events-none absolute -left-16 -top-24 size-64 rounded-full bg-primary-soft/60 blur-3xl" />
            <div className="relative">
            <p className="text-[13px] text-muted">Total portfolio balance</p>
            <p className="tnum mt-1 text-[34px] font-medium leading-none tracking-[-0.04em]"><CountUp value={money(portfolio.balance, currency)} duration={1.4} /></p>
            <p className={cx("tnum mt-2 flex items-center gap-1 text-[13px]", pnlClass(portfolio.netProfit))}>
              {portfolio.netProfit >= 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
              {money(portfolio.netProfit, currency, { sign: true })} <span className="text-muted">({pct(portfolio.returnPct, 2, true)} all-time)</span>
            </p>
            <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 text-[13px]">
              <Metric label="Initial capital" value={money(portfolio.initialBalance, currency)} />
              <Metric label="Current equity" value={money(portfolio.equity, currency)} />
              <Metric label="Realised P&L" value={money(portfolio.realisedPnl, currency, { sign: true })} tone={pnlTone(portfolio.realisedPnl)} />
              <Metric label="Unrealised P&L" value={money(portfolio.unrealisedPnl, currency, { sign: true })} tone={pnlTone(portfolio.unrealisedPnl)} />
              <Metric label="Net deposits" value={money(portfolio.deposits - portfolio.withdrawals, currency)} />
              <Metric label="Total return" value={pct(portfolio.returnPct, 2, true)} tone={pnlTone(portfolio.returnPct)} />
            </dl>
            </div>
          </div>
          <div className="min-w-0 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[15px] font-medium tracking-[-0.02em]">Equity curve</h3>
              <span className="text-[12px] text-muted">Balance after each closed trade</span>
            </div>
            <EquityChart data={curveToChart(curve.points, tz)} currency={currency} height={250} />
          </div>
        </div>
      </Card>

      {/* KPI grid */}
      <div className="stagger mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={<Sigma />} label="Net profit (period)" value={money(stats.netPnl, currency, { sign: true })} tone={pnlTone(stats.netPnl)} sub={`${stats.totalTrades} trades`} />
        <StatCard icon={<Percent />} label="Win rate" value={pct(stats.winRate, 1)} sub={<span><span className="text-profit">{stats.wins}W</span> · <span className="text-loss">{stats.losses}L</span></span>} />
        <StatCard icon={<Scale />} label="Profit factor" value={ratio(stats.profitFactor)} hint="Gross profit ÷ gross loss" />
        <StatCard icon={<Crosshair />} label="Avg risk : reward" value={avgPlannedRR ? `1 : ${avgPlannedRR.toFixed(2)}` : "—"} sub={`Avg ${rMult(stats.avgR)}`} hint="Average planned reward-to-risk from stop and target" />
        <StatCard icon={<Activity />} label="Total trades" value={stats.totalTrades} sub={stats.breakeven ? `${stats.breakeven} breakeven` : undefined} />
        <StatCard icon={<Trophy />} label="Winning trades" value={stats.wins} sub={stats.avgWin !== null ? `avg ${money(stats.avgWin, currency, { compact: true })}` : undefined} />
        <StatCard icon={<TrendingDown />} label="Max drawdown" value={pct(curve.dd.maxDrawdownPct, 2)} sub={money(-curve.dd.maxDrawdown, currency, { compact: true })} tone={curve.dd.maxDrawdown > 0 ? "loss" : null} hint="Largest peak-to-trough fall in balance in this period" />
        <StatCard icon={<Gauge />} label="Open positions" value={openTrades.length} sub={portfolio.openRisk ? `${money(portfolio.openRisk, currency, { compact: true })} at risk` : undefined} />
      </div>

      <div className="stagger mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Daily P&L" subtitle={`${dayLabel(dailyFrom)} – ${dayLabel(range.to ?? today)}`} />
          <div className="p-4 pt-3"><PnlBars data={dailyData} currency={currency} height={230} /></div>
        </Card>
        <Card>
          <CardHeader title="Monthly performance" subtitle="Last 12 months" />
          <div className="p-4 pt-3"><PnlBars data={monthly} currency={currency} height={230} /></div>
        </Card>
      </div>

      <div className="stagger mb-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Asset allocation" subtitle="Share of closed trades by asset class" />
          <div className="p-5">
            {allocation.length ? <RingChart items={allocation} centerValue={stats.totalTrades} centerLabel="Trades" /> : <p className="py-10 text-center text-[13px] text-muted">No closed trades in this period</p>}
          </div>
        </Card>
        <Card>
          <CardHeader title="Best-performing strategy" subtitle="By net P&L in this period" />
          <div className="p-5">
            {best && best.trades > 0 ? (
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-md bg-primary-soft text-primary-text"><Layers className="size-4" /></span>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-medium">{bestStrategy?.name ?? "No strategy assigned"}</p>
                    {bestStrategy && isDemoStrategy(bestStrategy) && <Badge tone="warn">Demo</Badge>}
                  </div>
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-4 text-[13px]">
                  <Metric label="Net P&L" value={money(best.netPnl, currency, { sign: true })} tone={pnlTone(best.netPnl)} />
                  <Metric label="Win rate" value={pct(best.winRate, 1)} />
                  <Metric label="Trades" value={String(best.trades)} />
                  <Metric label="Avg R" value={rMult(best.avgR)} />
                </dl>
                {bestStrategy && <Link href={`/app/strategies/${bestStrategy.id}`} className="mt-5 inline-flex items-center gap-1 text-[13px] text-primary-text hover:underline">View strategy <ArrowRight className="size-3.5" /></Link>}
              </div>
            ) : (
              <p className="py-8 text-center text-[13px] text-muted">{strategies.length ? "Assign strategies to trades to compare them." : "Create a strategy and tag your trades with it."}</p>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Performance comparison" subtitle={comparison.label} />
          <div className="p-5">
            <ul className="space-y-3.5 text-[13px]">
              <CompareRow label="Net P&L" cur={money(comparison.cur.netPnl, currency, { sign: true })} prev={money(comparison.prev.netPnl, currency)} up={comparison.cur.netPnl >= comparison.prev.netPnl} />
              <CompareRow label="Win rate" cur={pct(comparison.cur.winRate)} prev={pct(comparison.prev.winRate)} up={(comparison.cur.winRate ?? 0) >= (comparison.prev.winRate ?? 0)} />
              <CompareRow label="Profit factor" cur={ratio(comparison.cur.profitFactor)} prev={ratio(comparison.prev.profitFactor)} up={(comparison.cur.profitFactor ?? 0) >= (comparison.prev.profitFactor ?? 0)} />
              <CompareRow label="Expectancy" cur={money(comparison.cur.expectancy, currency)} prev={money(comparison.prev.expectancy, currency)} up={(comparison.cur.expectancy ?? 0) >= (comparison.prev.expectancy ?? 0)} />
              <CompareRow label="Trades" cur={String(comparison.cur.totalTrades)} prev={String(comparison.prev.totalTrades)} neutral />
            </ul>
          </div>
        </Card>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Recent trading activity" action={<Link href="/app/journal" className="text-[13px] text-primary-text hover:underline">View journal</Link>} />
          <div className="mt-2 overflow-x-auto">
            {recent.length === 0 ? <p className="px-5 pb-6 pt-4 text-[13px] text-muted">No trades yet.</p> : (
              <table className="w-full min-w-[520px] text-[13px]">
                <thead><tr className="border-y border-line bg-subtle text-left text-[12px] text-muted">
                  <th className="px-5 py-2 font-medium">Symbol</th><th className="px-3 py-2 font-medium">Side</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Date</th><th className="px-5 py-2 text-right font-medium">Net P&L</th>
                </tr></thead>
                <tbody className="rows-in">
                  {recent.map((t) => (
                    <tr key={t.id} className="row-hover border-b border-line last:border-0">
                      <td className="px-5 py-2.5"><Link href={`/app/journal/${t.id}`} className="font-medium hover:underline">{t.symbol}</Link></td>
                      <td className="px-3 py-2.5"><Badge tone={t.direction === "long" ? "profit" : "loss"}>{t.direction === "long" ? "Buy" : "Sell"}</Badge></td>
                      <td className="px-3 py-2.5 capitalize text-muted">{t.status}</td>
                      <td className="px-3 py-2.5 text-muted">{dateTime(t.exit_at ?? t.entry_at, tz)}</td>
                      <td className={cx("tnum px-5 py-2.5 text-right font-medium", pnlClass(t.net_pnl))}>{t.status === "closed" ? money(t.net_pnl, lookups.account.get(t.account_id)?.currency ?? currency, { sign: true }) : t.status === "open" ? <span className="text-muted">Open</span> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Recent journal entries" action={<Link href="/app/journal?tab=notes" className="text-[13px] text-primary-text hover:underline">All notes</Link>} />
          <ul className="px-5 pb-4 pt-3">
            {recentJournal.length === 0 ? <li className="py-4 text-[13px] text-muted">Journal notes you add to trades show up here.</li> : recentJournal.map((j) => {
              const trade = j.trade_id ? scopedTrades.find((t) => t.id === j.trade_id) : null;
              return (
                <li key={j.id} className="border-b border-line py-3 last:border-0">
                  <Link href={trade ? `/app/journal/${trade.id}` : `/app/calendar?day=${j.entry_date}`} className="block hover:opacity-80">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[13.5px] font-medium">{trade ? `${trade.symbol} · ${trade.direction === "long" ? "Buy" : "Sell"}` : j.title || "Daily note"}</p>
                      <span className="shrink-0 text-[12px] text-faint">{dayLabel(j.entry_date, { day: "numeric", month: "short" })}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted">{j.lessons || j.post_trade_analysis || j.notes || j.pre_trade_analysis || "No notes"}</p>
                    {(j.emotional_state || j.mistakes.length > 0) && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {j.emotional_state && <Badge>{j.emotional_state}</Badge>}
                        {j.mistakes.slice(0, 2).map((m) => <Badge key={m} tone="loss">{m}</Badge>)}
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader title="Account summaries" action={<Link href="/app/portfolio" className="text-[13px] text-primary-text hover:underline">Manage accounts</Link>} />
        <div className="stagger grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {scopedSummaries.map((s) => (
            <Link key={s.account.id} href={`/app/portfolio/${s.account.id}`} className="lift block rounded-lg p-4 shadow-[0_0_0_1px_var(--line)]">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[14px] font-medium">{s.account.name}</p>
                {s.account.is_demo ? <Badge tone="warn">Demo</Badge> : <Badge tone={s.account.status === "active" ? "profit" : s.account.status === "breached" ? "loss" : "neutral"}>{s.account.status}</Badge>}
              </div>
              <p className="mt-0.5 text-[12px] text-muted">{s.account.broker || "No broker"} · {s.account.currency}</p>
              <p className="tnum mt-3 text-[20px] font-medium tracking-[-0.03em]">{money(s.balance, s.account.currency)}</p>
              <p className="tnum mt-1 text-[12.5px]"><span className={pnlClass(s.netProfit)}>{money(s.netProfit, s.account.currency, { sign: true })}</span> <span className="text-muted">· {pct(s.returnPct, 2, true)} · DD {pct(s.drawdown.maxDrawdownPct, 1)}</span></p>
            </Link>
          ))}
        </div>
      </Card>
      <p className="mt-4 text-[12px] text-faint">Today in your timezone: {dayLabel(dayKey(new Date(), tz), { weekday: "long", day: "numeric", month: "long" })} ({tz}).</p>
    </>
  );
}

function Header({ name, rangeState }: { name: string; rangeState: ReturnType<typeof useRange> }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="hidden size-9 items-center justify-center rounded-lg bg-subtle text-ink-3 shadow-[0_0_0_1px_var(--line)] sm:flex"><Gauge className="size-[18px]" strokeWidth={1.5} /></span>
        <h1 className="text-[24px] font-medium tracking-[-0.04em] sm:text-[26px]">Welcome back, {name}</h1>
      </div>
      <RangeFilter state={rangeState} />
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "profit" | "loss" | null }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[12px] text-muted">{label}</dt>
      <dd className={cx("tnum mt-0.5 truncate text-[14px] font-medium transition-colors", tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "text-ink")}>{value}</dd>
    </div>
  );
}

function CompareRow({ label, cur, prev, up, neutral }: { label: string; cur: string; prev: string; up?: boolean; neutral?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="tnum flex items-center gap-2">
        <span className="font-medium text-ink">{cur}</span>
        {!neutral && cur !== prev && (up ? <ArrowUpRight className="size-3.5 text-profit" aria-label="improved" /> : <ArrowDownRight className="size-3.5 text-loss" aria-label="worse" />)}
        <span className="text-[12px] text-faint">was {prev}</span>
      </span>
    </li>
  );
}
