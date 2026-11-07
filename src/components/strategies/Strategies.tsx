"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Archive, ArrowLeft, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { useData, useLookups } from "@/lib/data/store";
import type { Strategy, Trade } from "@/lib/types";
import { ASSET_CLASSES, ASSET_CLASS_LABEL, SESSIONS, SESSION_LABEL, type AssetClass, type TradingSession } from "@/lib/engine/instruments";
import { computeStats, equityCurve, type Stats } from "@/lib/engine/metrics";
import { curveToChart } from "@/lib/analytics";
import { dateTime, money, pct, pnlClass, pnlTone, ratio, rMult } from "@/lib/format";
import { isDemoStrategy } from "@/lib/demo/seed";
import {
  Badge, Button, ButtonLink, Card, CardHeader, ChipGroup, ConfirmDialog, EmptyState, Field, Input, Modal, PageHeader, StatCard, TagInput, Textarea, Toggle, cx, toast,
} from "@/components/ui";
import { BreakdownBars, EquityChart } from "@/components/charts";
import { AttachmentManager } from "@/components/journal/Screenshots";

function useStrategyStats() {
  const { scopedTrades, scopedAccounts, currency } = useData();
  return useMemo(() => {
    const inCur = new Set(scopedAccounts.filter((a) => a.currency === currency).map((a) => a.id));
    const by = new Map<string, Trade[]>();
    for (const t of scopedTrades) if (t.strategy_id && inCur.has(t.account_id)) by.set(t.strategy_id, [...(by.get(t.strategy_id) ?? []), t]);
    const stats = new Map<string, Stats>();
    for (const [id, ts] of by) stats.set(id, computeStats(ts));
    return { stats, trades: by };
  }, [scopedTrades, scopedAccounts, currency]);
}

export function StrategiesPage() {
  const { strategies, scope, currency } = useData();
  const { stats } = useStrategyStats();
  const [modal, setModal] = useState<Strategy | "new" | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const list = strategies.filter((s) => (scope.kind === "demo" ? true : !isDemoStrategy(s)) && (showArchived || !s.is_archived));
  const empty = (): Stats => computeStats([]);
  const rows = list.map((s) => ({ s, st: stats.get(s.id) ?? empty() })).sort((a, b) => b.st.netPnl - a.st.netPnl);

  return (
    <>
      <PageHeader title="Strategies" icon={<Layers />} description="Your playbook, with live performance for each strategy."
        actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setModal("new")}>New strategy</Button>} />
      <div className="mb-4 flex items-center justify-end gap-2 text-[13px] text-muted">Show archived <Toggle label="Show archived strategies" checked={showArchived} onChange={setShowArchived} /></div>

      {rows.length === 0 ? (
        <Card><EmptyState icon={<Layers />} title="No strategies yet" description="Write down your setups: entry and exit conditions, risk rules and the markets they're for. Then tag trades with them to see what works." action={<Button variant="primary" onClick={() => setModal("new")}>Create a strategy</Button>} /></Card>
      ) : (
        <>
          <div className="stagger mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map(({ s, st }) => (
              <Link key={s.id} href={`/app/strategies/${s.id}`} className="group">
                <Card as="div" className="lift flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[15.5px] font-medium tracking-[-0.02em]">{s.name}</h3>
                    <div className="flex gap-1">{isDemoStrategy(s) && <Badge tone="warn">Demo</Badge>}{s.is_archived && <Badge>Archived</Badge>}</div>
                  </div>
                  <p className="mt-1 line-clamp-2 min-h-[2.6em] text-[13px] leading-relaxed text-muted">{s.description || "No description"}</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {s.asset_classes.map((c) => <Badge key={c}>{ASSET_CLASS_LABEL[c]}</Badge>)}
                    {s.sessions.map((x) => <Badge key={x} tone="primary">{SESSION_LABEL[x]}</Badge>)}
                  </div>
                  <dl className="mt-auto grid grid-cols-3 gap-3 border-t border-line pt-4 text-[12px]" style={{ marginTop: "1.25rem" }}>
                    <div><dt className="text-muted">Net P&amp;L</dt><dd className={cx("tnum mt-0.5 text-[14px] font-medium", pnlClass(st.netPnl))}>{money(st.netPnl, currency, { compact: true, sign: true })}</dd></div>
                    <div><dt className="text-muted">Win rate</dt><dd className="tnum mt-0.5 text-[14px] font-medium">{pct(st.winRate)}</dd></div>
                    <div><dt className="text-muted">Trades</dt><dd className="tnum mt-0.5 text-[14px] font-medium">{st.totalTrades}</dd></div>
                    <div><dt className="text-muted">Avg R</dt><dd className="tnum mt-0.5 font-medium">{rMult(st.avgR)}</dd></div>
                    <div><dt className="text-muted">Profit factor</dt><dd className="tnum mt-0.5 font-medium">{ratio(st.profitFactor)}</dd></div>
                    <div><dt className="text-muted">Expectancy</dt><dd className="tnum mt-0.5 font-medium">{money(st.expectancy, currency, { compact: true })}</dd></div>
                  </dl>
                </Card>
              </Link>
            ))}
          </div>

          <Card>
            <CardHeader title="Strategy comparison" subtitle={`Closed trades in the current view (${currency})`} />
            <div className="px-5 pb-2 pt-4"><BreakdownBars rows={rows.map(({ s, st }) => ({ label: s.name, value: st.netPnl }))} currency={currency} /></div>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead><tr className="border-y border-line bg-subtle text-left text-[12px] text-muted">
                  <th className="px-5 py-2 font-medium">Strategy</th><th className="px-3 py-2 text-right font-medium">Trades</th><th className="px-3 py-2 text-right font-medium">Win rate</th><th className="px-3 py-2 text-right font-medium">Profit factor</th><th className="px-3 py-2 text-right font-medium">Avg R</th><th className="px-3 py-2 text-right font-medium">Expectancy</th><th className="px-5 py-2 text-right font-medium">Net P&amp;L</th>
                </tr></thead>
                <tbody>
                  {rows.map(({ s, st }) => (
                    <tr key={s.id} className="border-b border-line last:border-0 hover:bg-subtle">
                      <td className="px-5 py-2.5"><Link href={`/app/strategies/${s.id}`} className="font-medium hover:underline">{s.name}</Link></td>
                      <td className="tnum px-3 py-2.5 text-right">{st.totalTrades}</td>
                      <td className="tnum px-3 py-2.5 text-right">{pct(st.winRate)}</td>
                      <td className="tnum px-3 py-2.5 text-right">{ratio(st.profitFactor)}</td>
                      <td className="tnum px-3 py-2.5 text-right">{rMult(st.avgR)}</td>
                      <td className="tnum px-3 py-2.5 text-right">{money(st.expectancy, currency)}</td>
                      <td className={cx("tnum px-5 py-2.5 text-right font-medium", pnlClass(st.netPnl))}>{money(st.netPnl, currency, { sign: true })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
      {modal && <StrategyModal open onClose={() => setModal(null)} strategy={modal === "new" ? null : modal} />}
    </>
  );
}

export function StrategyModal({ open, onClose, strategy }: { open: boolean; onClose: () => void; strategy?: Strategy | null }) {
  const { saveStrategy } = useData();
  const router = useRouter();
  const [f, setF] = useState({
    name: strategy?.name ?? "", description: strategy?.description ?? "", entry: strategy?.entry_conditions ?? "", exit: strategy?.exit_conditions ?? "",
    risk: strategy?.risk_rules ?? "", classes: strategy?.asset_classes ?? ([] as AssetClass[]), sessions: strategy?.sessions ?? ([] as TradingSession[]), tags: strategy?.tags ?? ([] as string[]),
  });
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!f.name.trim()) return;
    setSaving(true);
    try {
      const s = await saveStrategy({ name: f.name.trim(), description: f.description.trim() || null, entry_conditions: f.entry.trim() || null, exit_conditions: f.exit.trim() || null, risk_rules: f.risk.trim() || null, asset_classes: f.classes, sessions: f.sessions, tags: f.tags }, strategy?.id);
      toast(strategy ? "Strategy updated" : "Strategy created");
      onClose();
      if (!strategy) router.push(`/app/strategies/${s.id}`);
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "error"); } finally { setSaving(false); }
  }
  return (
    <Modal open={open} onClose={onClose} size="lg" title={strategy ? "Edit strategy" : "New strategy"}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={saving} disabled={!f.name.trim()} onClick={save}>{strategy ? "Save changes" : "Create strategy"}</Button></>}>
      <div className="grid gap-4">
        <Field label="Name" htmlFor="s-name"><Input id="s-name" maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. London Breakout" /></Field>
        <Field label="Description" htmlFor="s-desc" optional><Textarea id="s-desc" rows={2} maxLength={4000} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Entry conditions" htmlFor="s-entry" optional><Textarea id="s-entry" rows={4} maxLength={4000} value={f.entry} onChange={(e) => setF({ ...f, entry: e.target.value })} placeholder="What must be true before you enter?" /></Field>
          <Field label="Exit conditions" htmlFor="s-exit" optional><Textarea id="s-exit" rows={4} maxLength={4000} value={f.exit} onChange={(e) => setF({ ...f, exit: e.target.value })} placeholder="Targets, trailing, time stops…" /></Field>
        </div>
        <Field label="Risk management rules" htmlFor="s-risk" optional><Textarea id="s-risk" rows={3} maxLength={4000} value={f.risk} onChange={(e) => setF({ ...f, risk: e.target.value })} placeholder="Risk per trade, max attempts, news rules…" /></Field>
        <Field label="Asset classes"><ChipGroup options={ASSET_CLASSES.map((c) => ({ value: c, label: ASSET_CLASS_LABEL[c] }))} value={f.classes} onChange={(v) => setF({ ...f, classes: v })} /></Field>
        <Field label="Trading sessions"><ChipGroup options={SESSIONS.map((s) => ({ value: s, label: SESSION_LABEL[s] }))} value={f.sessions} onChange={(v) => setF({ ...f, sessions: v })} /></Field>
        <Field label="Tags" optional><TagInput value={f.tags} onChange={(v) => setF({ ...f, tags: v })} /></Field>
      </div>
    </Modal>
  );
}

export function StrategyDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { strategies, attachments, tz, currency, deleteStrategy, saveStrategy } = useData();
  const lookups = useLookups();
  const { trades: byStrategy } = useStrategyStats();
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  const s = strategies.find((x) => x.id === id);
  const trades = useMemo(() => byStrategy.get(id) ?? [], [byStrategy, id]);
  const st = useMemo(() => computeStats(trades), [trades]);
  const curve = useMemo(() => equityCurve(0, null, trades), [trades]);
  if (!s) return <Card><EmptyState title="Strategy not found" action={<ButtonLink href="/app/strategies">Back to strategies</ButtonLink>} /></Card>;
  const shots = attachments.filter((a) => a.strategy_id === s.id);
  const recent = [...trades].sort((a, b) => (b.exit_at ?? b.entry_at).localeCompare(a.exit_at ?? a.entry_at)).slice(0, 10);

  return (
    <>
      <Link href="/app/strategies" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"><ArrowLeft className="size-3.5" />Strategies</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2"><h1 className="text-[26px] font-medium tracking-[-0.04em]">{s.name}</h1>{isDemoStrategy(s) && <Badge tone="warn">Demo</Badge>}{s.is_archived && <Badge>Archived</Badge>}</div>
          {s.description && <p className="mt-1 text-[14px] leading-relaxed text-muted">{s.description}</p>}
          <div className="mt-3 flex flex-wrap gap-1">{s.asset_classes.map((c) => <Badge key={c}>{ASSET_CLASS_LABEL[c]}</Badge>)}{s.sessions.map((x) => <Badge key={x} tone="primary">{SESSION_LABEL[x]}</Badge>)}{s.tags.filter((t) => t !== "demo").map((t) => <Badge key={t}>#{t}</Badge>)}</div>
        </div>
        <div className="flex gap-2">
          <Button icon={<Archive className="size-4" />} onClick={async () => { await saveStrategy({ is_archived: !s.is_archived }, s.id); toast(s.is_archived ? "Strategy restored" : "Strategy archived"); }}>{s.is_archived ? "Restore" : "Archive"}</Button>
          <Button icon={<Trash2 className="size-4" />} onClick={() => setDel(true)}>Delete</Button>
          <Button variant="primary" icon={<Pencil className="size-4" />} onClick={() => setEdit(true)}>Edit</Button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatCard label="Trades" value={st.totalTrades} sub={`${st.wins}W · ${st.losses}L`} />
        <StatCard label="Win rate" value={pct(st.winRate)} />
        <StatCard label="Net P&L" value={money(st.netPnl, currency, { sign: true })} tone={pnlTone(st.netPnl)} />
        <StatCard label="Average R" value={rMult(st.avgR)} tone={pnlTone(st.avgR)} />
        <StatCard label="Profit factor" value={ratio(st.profitFactor)} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        {[["Entry conditions", s.entry_conditions], ["Exit conditions", s.exit_conditions], ["Risk management", s.risk_rules]].map(([t, v]) => (
          <Card key={t} className="p-5"><h3 className="text-[14px] font-medium">{t}</h3><p className={cx("mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed", v ? "text-body" : "text-faint")}>{v || "Not written yet."}</p></Card>
        ))}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card><CardHeader title="Cumulative P&L" subtitle="Closed trades with this strategy" /><div className="p-4 pt-3"><EquityChart data={curveToChart(curve.points, tz, "balance")} currency={currency} baseline={0} /></div></Card>
        <Card>
          <CardHeader title="Recent trades" />
          <ul className="px-5 pb-4 pt-2">
            {recent.length === 0 ? <li className="py-4 text-[13px] text-muted">No trades tagged with this strategy in the current view.</li> : recent.map((t) => (
              <li key={t.id} className="border-b border-line last:border-0">
                <Link href={`/app/journal/${t.id}`} className="flex items-center justify-between py-2.5 text-[13px] hover:opacity-80">
                  <span><span className="font-medium">{t.symbol}</span> <Badge tone={t.direction === "long" ? "profit" : "loss"}>{t.direction === "long" ? "Buy" : "Sell"}</Badge><span className="ml-2 text-[12px] text-muted">{dateTime(t.exit_at ?? t.entry_at, tz)}</span></span>
                  <span className={cx("tnum font-medium", pnlClass(t.net_pnl))}>{t.status === "closed" ? money(t.net_pnl, lookups.account.get(t.account_id)?.currency ?? currency, { sign: true }) : "Open"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card><CardHeader title="Screenshots" subtitle="Example charts for this setup" /><div className="p-5"><AttachmentManager parent={{ strategyId: s.id }} items={shots} /></div></Card>

      {edit && <StrategyModal open onClose={() => setEdit(false)} strategy={s} />}
      <ConfirmDialog open={del} onClose={() => setDel(false)} title={`Delete ${s.name}?`} description="The strategy and its screenshots are deleted. Trades keep their data but will no longer be linked to it."
        onConfirm={async () => { try { await deleteStrategy(s.id); toast("Strategy deleted"); router.replace("/app/strategies"); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't delete", "error"); } }} />
    </>
  );
}
