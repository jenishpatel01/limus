"use client";

import { useMemo, useState } from "react";
import { Download, FileText, Save, Trash2 } from "lucide-react";
import { useData, useLookups } from "@/lib/data/store";
import { api } from "@/lib/data/api";
import type { ReportPeriod, SavedReport } from "@/lib/types";
import { buildReport, periodRange, summarize, type ReportSpec } from "@/lib/reports/build";
import { download, toCsv, tradesToRows } from "@/lib/reports/csv";
import { curveToChart } from "@/lib/analytics";
import { dayKey } from "@/lib/dates";
import { dayLabel, money, pct, pnlTone, ratio, rMult, relativeTime } from "@/lib/format";
import { Button, Card, CardHeader, EmptyState, Field, IconButton, Input, PageHeader, Segmented, Select, StatCard, toast } from "@/components/ui";
import { EquityChart, PnlBars } from "@/components/charts";
import { BreakdownCard } from "@/components/analytics/Analytics";

const TYPES: { value: ReportPeriod; label: string }[] = [
  { value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly" },
  { value: "account", label: "Account" }, { value: "strategy", label: "Strategy" }, { value: "custom", label: "Custom" },
];

export function ReportsPage() {
  const data = useData();
  const { scopedAccounts, scopedTrades, cash, strategies, tz, currency, reports, addReport, removeReport, user } = data;
  const lookups = useLookups();
  const today = dayKey(new Date(), tz);
  const [period, setPeriod] = useState<ReportPeriod>("monthly");
  const [anchor, setAnchor] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [year, setYear] = useState(today.slice(0, 4));
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [accountId, setAccountId] = useState("");
  const [strategyId, setStrategyId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const earliest = scopedTrades.reduce((m, t) => (t.exit_at && t.exit_at < m ? t.exit_at : m), today + "T23:59");
  const spec: ReportSpec | null = useMemo(() => {
    let r: { from: string; to: string };
    if (period === "daily" || period === "weekly") r = periodRange(period, anchor);
    else if (period === "monthly") r = periodRange("monthly", `${month}-01`);
    else if (period === "yearly") r = periodRange("yearly", `${year}-01-01`);
    else if (period === "custom") r = { from, to };
    else r = { from: from || dayKey(earliest, tz), to: to || today };
    if (!r.from || !r.to || r.to < r.from) return null;
    if (period === "account" && !accountId) return null;
    if (period === "strategy" && !strategyId) return null;
    const acc = accountId ? scopedAccounts.find((a) => a.id === accountId)?.name : null;
    const st = strategyId ? strategies.find((s) => s.id === strategyId)?.name : null;
    const label = { daily: `Daily report · ${dayLabel(r.from)}`, weekly: `Weekly report · ${dayLabel(r.from, { day: "numeric", month: "short" })} – ${dayLabel(r.to)}`, monthly: `Monthly report · ${dayLabel(r.from, { month: "long", year: "numeric" })}`, yearly: `Yearly report · ${r.from.slice(0, 4)}`, account: `Account report · ${acc ?? ""}`, strategy: `Strategy report · ${st ?? ""}`, custom: `Performance report · ${dayLabel(r.from)} – ${dayLabel(r.to)}` }[period];
    return { period, from: r.from, to: r.to, accountId: accountId || null, strategyId: strategyId || null, title: label };
  }, [period, anchor, month, year, from, to, accountId, strategyId, scopedAccounts, strategies, earliest, today, tz]);

  const report = useMemo(() => spec ? buildReport(spec, { accounts: scopedAccounts, trades: scopedTrades, cash, strategies, tz, currency }) : null, [spec, scopedAccounts, scopedTrades, cash, strategies, tz, currency]);

  async function exportPdf() {
    if (!report) return;
    setBusy("pdf");
    try {
      const { reportPdf } = await import("@/lib/reports/pdf");
      download(`${report.spec.title.replace(/[^\w-]+/g, "-").toLowerCase()}.pdf`, reportPdf(report, tz));
      toast("PDF downloaded");
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't create the PDF", "error"); } finally { setBusy(null); }
  }
  function exportCsv() {
    if (!report) return;
    const summary = [
      { metric: "Report", value: report.spec.title }, { metric: "From", value: report.spec.from }, { metric: "To", value: report.spec.to },
      { metric: "Accounts", value: report.accountNames.join("; ") }, { metric: "Currency", value: report.currency },
      { metric: "Net P&L", value: report.stats.netPnl }, { metric: "Trades", value: report.stats.totalTrades }, { metric: "Win rate %", value: report.stats.winRate },
      { metric: "Profit factor", value: report.stats.profitFactor === Infinity ? "inf" : report.stats.profitFactor }, { metric: "Expectancy", value: report.stats.expectancy },
      { metric: "Average R", value: report.stats.avgR }, { metric: "Max drawdown %", value: report.dd.maxDrawdownPct }, { metric: "Recovery factor", value: report.recovery },
    ];
    const csv = toCsv(summary) + "\n\n" + toCsv(tradesToRows(report.trades, lookups.account, lookups.strategy, lookups.journalByTrade, tz));
    download(`${report.spec.title.replace(/[^\w-]+/g, "-").toLowerCase()}.csv`, csv);
    toast("CSV downloaded");
  }
  async function save() {
    if (!report) return;
    setBusy("save");
    try {
      const r = await api.createReport({ user_id: user.id, title: report.spec.title.slice(0, 160), period: report.spec.period, range_start: report.spec.from, range_end: report.spec.to, filters: { accountId: report.spec.accountId, strategyId: report.spec.strategyId }, summary: summarize(report) });
      addReport(r);
      toast("Report saved to history");
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "error"); } finally { setBusy(null); }
  }
  function open(r: SavedReport) {
    setPeriod(r.period);
    const f = r.filters as { accountId?: string | null; strategyId?: string | null };
    setAccountId(f.accountId ?? ""); setStrategyId(f.strategyId ?? "");
    setAnchor(r.range_start); setMonth(r.range_start.slice(0, 7)); setYear(r.range_start.slice(0, 4)); setFrom(r.range_start); setTo(r.range_end);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const showAccount = ["account", "custom", "daily", "weekly", "monthly", "yearly"].includes(period);
  return (
    <>
      <PageHeader title="Reports" icon={<FileText />} description="Performance reports from your trades, ready to download as PDF or CSV." />
      <Card className="mb-6 p-5">
        <Segmented size="md" ariaLabel="Report type" value={period} onChange={setPeriod} options={TYPES} />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(period === "daily" || period === "weekly") && <Field label={period === "daily" ? "Day" : "Any day in the week"} htmlFor="r-day"><Input id="r-day" type="date" value={anchor} max={today} onChange={(e) => setAnchor(e.target.value)} /></Field>}
          {period === "monthly" && <Field label="Month" htmlFor="r-month"><Input id="r-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></Field>}
          {period === "yearly" && <Field label="Year" htmlFor="r-year"><Input id="r-year" type="number" min={2000} max={2100} value={year} onChange={(e) => setYear(e.target.value)} /></Field>}
          {(period === "custom" || period === "account" || period === "strategy") && <>
            <Field label="From" htmlFor="r-from" optional={period !== "custom"}><Input id="r-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="To" htmlFor="r-to" optional={period !== "custom"}><Input id="r-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          </>}
          {showAccount && (
            <Field label="Account" htmlFor="r-acc" optional={period !== "account"}>
              <Select id="r-acc" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">{period === "account" ? "Choose an account…" : `All accounts in view (${currency})`}</option>
                {scopedAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}
              </Select>
            </Field>
          )}
          {(period === "strategy" || period === "custom") && (
            <Field label="Strategy" htmlFor="r-strat" optional={period !== "strategy"}>
              <Select id="r-strat" value={strategyId} onChange={(e) => setStrategyId(e.target.value)}>
                <option value="">{period === "strategy" ? "Choose a strategy…" : "All strategies"}</option>
                {strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
          )}
        </div>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
          <Button variant="primary" icon={<Download className="size-4" />} disabled={!report} loading={busy === "pdf"} onClick={exportPdf}>Download PDF</Button>
          <Button icon={<Download className="size-4" />} disabled={!report} onClick={exportCsv}>Download CSV</Button>
          <Button icon={<Save className="size-4" />} disabled={!report} loading={busy === "save"} onClick={save}>Save to history</Button>
        </div>
      </Card>

      {!report ? (
        <Card><EmptyState icon={<FileText />} title="Choose what to report on" description={period === "account" ? "Pick an account." : period === "strategy" ? "Pick a strategy." : "Check the dates. The end date can't be before the start."} /></Card>
      ) : (
        <>
          <div className="mb-4">
            <h2 className="text-[20px] font-medium tracking-[-0.03em]">{report.spec.title}</h2>
            <p className="text-[13px] text-muted">{dayLabel(report.spec.from)} – {dayLabel(report.spec.to)} · {report.accountNames.join(", ") || "No accounts"}{report.strategyName ? ` · ${report.strategyName}` : ""}</p>
          </div>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Net P&L" value={money(report.stats.netPnl, report.currency, { sign: true })} tone={pnlTone(report.stats.netPnl)} sub={`${report.stats.totalTrades} trades`} />
            <StatCard label="Win rate" value={pct(report.stats.winRate)} sub={`${report.stats.wins}W · ${report.stats.losses}L`} />
            <StatCard label="Profit factor" value={ratio(report.stats.profitFactor)} sub={`Expectancy ${money(report.stats.expectancy, report.currency, { compact: true })}`} />
            <StatCard label="Average R" value={rMult(report.stats.avgR)} sub={`Max DD ${pct(report.dd.maxDrawdownPct, 2)}`} />
          </div>
          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <Card><CardHeader title="Balance" subtitle={`${money(report.startBalance, report.currency)} → ${money(report.endBalance, report.currency)}`} /><div className="p-4 pt-3"><EquityChart data={curveToChart(report.curve, tz)} currency={report.currency} height={230} /></div></Card>
            <Card><CardHeader title="Daily results" subtitle={`${report.days.length} trading day${report.days.length === 1 ? "" : "s"}`} /><div className="p-4 pt-3"><PnlBars data={report.days.map((d) => ({ label: dayLabel(d.day, { day: "numeric", month: "short" }), sub: dayLabel(d.day), value: d.pnl, trades: d.trades }))} currency={report.currency} height={230} /></div></Card>
          </div>
          {report.stats.totalTrades > 0 ? (
            <div className="mb-6 grid gap-4 lg:grid-cols-2">
              <BreakdownCard title="By strategy" rows={report.byStrategy} currency={report.currency} />
              <BreakdownCard title="By asset class" rows={report.byAsset} currency={report.currency} />
            </div>
          ) : <Card className="mb-6"><EmptyState title="No closed trades in this period" description="The report is empty. Try a different period or account." /></Card>}
        </>
      )}

      <Card>
        <CardHeader title="Report history" subtitle="Saved reports regenerate from your current data when opened." />
        <ul className="px-5 pb-4 pt-2">
          {reports.length === 0 ? <li className="py-4 text-[13px] text-muted">No saved reports yet.</li> : reports.map((r) => {
            const s = r.summary as { netPnl?: number; trades?: number; currency?: string };
            return (
              <li key={r.id} className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0">
                <button type="button" onClick={() => open(r)} className="min-w-0 text-left hover:opacity-80">
                  <p className="truncate text-[13.5px] font-medium">{r.title}</p>
                  <p className="text-[12px] text-muted">Saved {relativeTime(r.created_at)} · {s.trades ?? 0} trades · net {money(s.netPnl ?? 0, s.currency ?? currency, { sign: true })}</p>
                </button>
                <IconButton label={`Delete ${r.title}`} size="sm" onClick={async () => { try { await removeReport(r.id); toast("Report removed"); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't delete", "error"); } }}><Trash2 className="size-3.5" /></IconButton>
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
