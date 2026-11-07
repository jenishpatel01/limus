"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Copy, Download, Eye, MoreHorizontal, Pencil, Plus, Search, SlidersHorizontal, Trash2, Upload, X } from "lucide-react";
import { useData, useLookups } from "@/lib/data/store";
import type { Trade } from "@/lib/types";
import { ASSET_CLASSES, ASSET_CLASS_LABEL } from "@/lib/engine/instruments";
import { dayKey, inRange } from "@/lib/dates";
import { dateTime, money, num, pnlClass, price, rMult } from "@/lib/format";
import { download, toCsv, tradesToRows } from "@/lib/reports/csv";
import {
  Badge, Button, ButtonLink, Card, Checkbox, ConfirmDialog, EmptyState, IconButton, Menu, MenuItem, PageHeader, Select, Tabs, cx, toast,
} from "@/components/ui";
import { RangeFilter, useRange } from "@/components/app/RangeFilter";
import { DailyNotes } from "./DailyNotes";
import { Collapse } from "@/components/motion";

type SortKey = "date_desc" | "date_asc" | "pnl_desc" | "pnl_asc" | "r_desc" | "symbol";
const PAGE = 50;

export function JournalPage() {
  const params = useSearchParams();
  const [tab, setTab] = useState<"trades" | "notes">(params.get("tab") === "notes" ? "notes" : "trades");
  const { scopedTrades, journal } = useData();
  const dailyCount = journal.filter((j) => !j.trade_id).length;

  return (
    <>
      <PageHeader title="Trading Journal" icon={<BookOpen />} description="Every trade with its numbers, screenshots and notes."
        actions={<>
          <ButtonLink href="/app/import" icon={<Upload className="size-4" />}>Import CSV</ButtonLink>
          <ButtonLink href="/app/journal/new" variant="primary" icon={<Plus className="size-4" />}>New trade</ButtonLink>
        </>} />
      <Tabs className="mb-5" value={tab} onChange={setTab} tabs={[{ value: "trades", label: "Trades", count: scopedTrades.length }, { value: "notes", label: "Daily notes", count: dailyCount }]} />
      {tab === "trades" ? <TradeList initialQuery={params.get("q") ?? ""} focusSearch={params.get("focus") === "search"} /> : <DailyNotes />}
    </>
  );
}

function TradeList({ initialQuery, focusSearch }: { initialQuery: string; focusSearch: boolean }) {
  const router = useRouter();
  const { scopedTrades, tz, currency, strategies, deleteTrades, duplicateTrade } = useData();
  const lookups = useLookups();
  const rangeState = useRange("all", "limus-range-journal");
  const searchRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState(initialQuery);
  const [status, setStatus] = useState("");
  const [direction, setDirection] = useState("");
  const [assetClass, setAssetClass] = useState("");
  const [strategy, setStrategy] = useState("");
  const [outcome, setOutcome] = useState("");
  const [sort, setSort] = useState<SortKey>("date_desc");
  const [pageState, setPageState] = useState({ key: "", page: 0 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => { if (focusSearch) searchRef.current?.focus(); }, [focusSearch]);
  const [lastQuery, setLastQuery] = useState(initialQuery);
  if (lastQuery !== initialQuery) { setLastQuery(initialQuery); setQ(initialQuery); }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = scopedTrades.filter((t) => {
      if (status && t.status !== status) return false;
      if (direction && t.direction !== direction) return false;
      if (assetClass && t.asset_class !== assetClass) return false;
      if (strategy && (strategy === "none" ? t.strategy_id : t.strategy_id !== strategy)) return false;
      if (outcome) {
        if (t.status !== "closed" || t.net_pnl === null) return false;
        if (outcome === "win" && !(t.net_pnl > 0)) return false;
        if (outcome === "loss" && !(t.net_pnl < 0)) return false;
        if (outcome === "be" && t.net_pnl !== 0) return false;
      }
      if (!inRange(dayKey(t.entry_at, tz), rangeState.range)) return false;
      if (needle) {
        const j = lookups.journalByTrade.get(t.id);
        const strat = t.strategy_id ? lookups.strategy.get(t.strategy_id)?.name ?? "" : "";
        const hay = [t.symbol, t.setup, strat, ...t.tags, j?.lessons, j?.post_trade_analysis, j?.pre_trade_analysis, ...(j?.mistakes ?? []), j?.emotional_state].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const by = {
      date_desc: (a: Trade, b: Trade) => b.entry_at.localeCompare(a.entry_at),
      date_asc: (a: Trade, b: Trade) => a.entry_at.localeCompare(b.entry_at),
      pnl_desc: (a: Trade, b: Trade) => (b.net_pnl ?? -Infinity) - (a.net_pnl ?? -Infinity),
      pnl_asc: (a: Trade, b: Trade) => (a.net_pnl ?? Infinity) - (b.net_pnl ?? Infinity),
      r_desc: (a: Trade, b: Trade) => (b.r_multiple ?? -Infinity) - (a.r_multiple ?? -Infinity),
      symbol: (a: Trade, b: Trade) => a.symbol.localeCompare(b.symbol) || b.entry_at.localeCompare(a.entry_at),
    }[sort];
    return list.sort(by);
  }, [scopedTrades, q, status, direction, assetClass, strategy, outcome, sort, rangeState.range, tz, lookups]);

  // Any filter change returns to the first page.
  const filterKey = JSON.stringify([q, status, direction, assetClass, strategy, outcome, sort, rangeState.range]);
  const page = pageState.key === filterKey ? pageState.page : 0;
  const setPage = (fn: (p: number) => number) => setPageState({ key: filterKey, page: fn(page) });
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const visible = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const filteredNet = filtered.reduce((a, t) => a + (t.status === "closed" ? t.net_pnl ?? 0 : 0), 0);
  const activeFilters = [status, direction, assetClass, strategy, outcome].filter(Boolean).length + (rangeState.preset !== "all" ? 1 : 0);
  const allVisibleSelected = visible.length > 0 && visible.every((t) => selected.has(t.id));

  function exportCsv(list: Trade[]) {
    if (!list.length) return toast("Nothing to export", "info");
    download(`limus-trades-${dayKey(new Date(), tz)}.csv`, toCsv(tradesToRows(list, lookups.account, lookups.strategy, lookups.journalByTrade, tz)));
    toast(`Exported ${list.length} trade${list.length === 1 ? "" : "s"}`);
  }

  async function doDelete() {
    if (!confirm) return;
    setDeleting(true);
    try {
      await deleteTrades(confirm);
      toast(confirm.length === 1 ? "Trade deleted" : `${confirm.length} trades deleted`);
      setSelected(new Set());
      setConfirm(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't delete", "error");
    } finally { setDeleting(false); }
  }

  async function duplicate(id: string) {
    try {
      const copy = await duplicateTrade(id);
      toast("Trade duplicated. Review the copy.");
      router.push(`/app/journal/${copy.id}/edit`);
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't duplicate", "error"); }
  }

  const resetFilters = () => { setStatus(""); setDirection(""); setAssetClass(""); setStrategy(""); setOutcome(""); rangeState.setPreset("all"); setQ(""); };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 basis-full sm:basis-auto sm:flex-1 sm:max-w-sm">
          <span className="sr-only">Search trades</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search symbol, tag, setup, notes…"
            className="h-9 w-full rounded-md bg-surface pl-8 pr-8 text-[14px] shadow-[0_0_0_1px_var(--line-strong)] outline-none placeholder:text-faint focus:shadow-[0_0_0_1px_var(--primary),0_0_0_4px_var(--primary-soft)]" />
          {q && <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-ink"><X className="size-3.5" /></button>}
        </label>
        <Button icon={<SlidersHorizontal className="size-4" />} onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
          Filters{activeFilters > 0 && <Badge tone="primary">{activeFilters}</Badge>}
        </Button>
        <Select aria-label="Sort trades" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="w-auto">
          <option value="date_desc">Newest first</option>
          <option value="date_asc">Oldest first</option>
          <option value="pnl_desc">Highest P&amp;L</option>
          <option value="pnl_asc">Lowest P&amp;L</option>
          <option value="r_desc">Highest R</option>
          <option value="symbol">Symbol A–Z</option>
        </Select>
        <Button icon={<Download className="size-4" />} onClick={() => exportCsv(filtered)} className="ml-auto">Export</Button>
      </div>

      <Collapse open={showFilters}>
        <Card className="mb-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any status</option><option value="closed">Closed</option><option value="open">Open</option><option value="cancelled">Cancelled</option></Select>
            <Select aria-label="Direction" value={direction} onChange={(e) => setDirection(e.target.value)}><option value="">Buy &amp; sell</option><option value="long">Buy / long</option><option value="short">Sell / short</option></Select>
            <Select aria-label="Asset class" value={assetClass} onChange={(e) => setAssetClass(e.target.value)}><option value="">All asset classes</option>{ASSET_CLASSES.map((c) => <option key={c} value={c}>{ASSET_CLASS_LABEL[c]}</option>)}</Select>
            <Select aria-label="Strategy" value={strategy} onChange={(e) => setStrategy(e.target.value)}><option value="">All strategies</option><option value="none">No strategy</option>{strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
            <Select aria-label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)}><option value="">Any outcome</option><option value="win">Winners</option><option value="loss">Losers</option><option value="be">Breakeven</option></Select>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[12.5px] text-muted">Entry date <RangeFilter state={rangeState} /></div>
            {activeFilters > 0 && <Button size="sm" variant="ghost" onClick={resetFilters}>Clear filters</Button>}
          </div>
        </Card>
      </Collapse>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted">
        <span><span className="tnum text-ink">{filtered.length}</span> trade{filtered.length === 1 ? "" : "s"} · net <span className={cx("tnum font-medium", pnlClass(filteredNet))}>{money(filteredNet, currency, { sign: true })}</span></span>
        {selected.size > 0 && (
          <span className="flex items-center gap-2">
            <span className="text-ink">{selected.size} selected</span>
            <Button size="sm" icon={<Download className="size-3.5" />} onClick={() => exportCsv(filtered.filter((t) => selected.has(t.id)))}>Export</Button>
            <Button size="sm" variant="danger" icon={<Trash2 className="size-3.5" />} onClick={() => setConfirm([...selected])}>Delete</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </span>
        )}
      </div>

      {scopedTrades.length === 0 ? (
        <Card><EmptyState icon={<BookOpen />} title="No trades yet" description="Add your first trade or import your history from a CSV file." action={<><ButtonLink href="/app/journal/new" variant="primary">Add trade</ButtonLink><ButtonLink href="/app/import">Import CSV</ButtonLink></>} /></Card>
      ) : filtered.length === 0 ? (
        <Card><EmptyState icon={<Search />} title="No trades match" description="Try a different search or clear the filters." action={<Button onClick={resetFilters}>Clear filters</Button>} /></Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-subtle text-left text-[12px] text-muted">
                    <th className="w-10 py-2.5 pl-4"><Checkbox checked={allVisibleSelected} onChange={(v) => setSelected((s) => { const n = new Set(s); visible.forEach((t) => (v ? n.add(t.id) : n.delete(t.id))); return n; })} label={<span className="sr-only">Select all on page</span>} /></th>
                    <th className="px-3 py-2.5 font-medium">Opened</th>
                    <th className="px-3 py-2.5 font-medium">Symbol</th>
                    <th className="px-3 py-2.5 font-medium">Side</th>
                    <th className="px-3 py-2.5 text-right font-medium">Size</th>
                    <th className="px-3 py-2.5 text-right font-medium">Entry</th>
                    <th className="px-3 py-2.5 text-right font-medium">Exit</th>
                    <th className="px-3 py-2.5 text-right font-medium">Net P&amp;L</th>
                    <th className="px-3 py-2.5 text-right font-medium">R</th>
                    <th className="px-3 py-2.5 font-medium">Strategy</th>
                    <th className="w-12 py-2.5 pr-3" />
                  </tr>
                </thead>
                <tbody key={`${page}-${filtered.length}`} className="rows-in">
                  {visible.map((t) => {
                    const acc = lookups.account.get(t.account_id);
                    const strat = t.strategy_id ? lookups.strategy.get(t.strategy_id) : null;
                    return (
                      <tr key={t.id} className={cx("row-hover group border-b border-line last:border-0", selected.has(t.id) && "bg-primary-soft/30")}>
                        <td className="py-2.5 pl-4"><Checkbox checked={selected.has(t.id)} onChange={(v) => setSelected((s) => { const n = new Set(s); if (v) n.add(t.id); else n.delete(t.id); return n; })} label={<span className="sr-only">Select {t.symbol}</span>} /></td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-muted">{dateTime(t.entry_at, tz)}</td>
                        <td className="px-3 py-2.5">
                          <Link href={`/app/journal/${t.id}`} className="font-medium text-ink hover:underline">{t.symbol}</Link>
                          <span className="ml-1.5 text-[11.5px] text-faint">{ASSET_CLASS_LABEL[t.asset_class]}</span>
                          {t.status !== "closed" && <Badge className="ml-1.5" tone={t.status === "open" ? "primary" : "neutral"}>{t.status}</Badge>}
                        </td>
                        <td className="px-3 py-2.5"><Badge tone={t.direction === "long" ? "profit" : "loss"}>{t.direction === "long" ? "Buy" : "Sell"}</Badge></td>
                        <td className="tnum px-3 py-2.5 text-right">{num(t.quantity, 4)}</td>
                        <td className="tnum px-3 py-2.5 text-right">{price(t.entry_price)}</td>
                        <td className="tnum px-3 py-2.5 text-right">{price(t.exit_price)}</td>
                        <td className={cx("tnum px-3 py-2.5 text-right font-medium", pnlClass(t.net_pnl))}>{t.status === "closed" ? money(t.net_pnl, acc?.currency ?? currency, { sign: true }) : "—"}</td>
                        <td className={cx("tnum px-3 py-2.5 text-right", pnlClass(t.r_multiple))}>{rMult(t.r_multiple)}</td>
                        <td className="max-w-[160px] truncate px-3 py-2.5 text-muted">{strat?.name ?? "—"}</td>
                        <td className="py-2.5 pr-3 text-right"><RowMenu trade={t} onDuplicate={duplicate} onDelete={(id) => setConfirm([id])} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <ul className="stagger space-y-2 md:hidden">
            {visible.map((t) => {
              const acc = lookups.account.get(t.account_id);
              return (
                <li key={t.id}>
                  <Card as="div" className="flex items-center gap-3 p-3.5">
                    <Link href={`/app/journal/${t.id}`} className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{t.symbol}</span>
                        <Badge tone={t.direction === "long" ? "profit" : "loss"}>{t.direction === "long" ? "Buy" : "Sell"}</Badge>
                        {t.status !== "closed" && <Badge tone="primary">{t.status}</Badge>}
                      </div>
                      <p className="mt-1 truncate text-[12px] text-muted">{dateTime(t.entry_at, tz)} · {num(t.quantity, 4)} @ {price(t.entry_price)}</p>
                    </Link>
                    <div className="text-right">
                      <p className={cx("tnum text-[14px] font-medium", pnlClass(t.net_pnl))}>{t.status === "closed" ? money(t.net_pnl, acc?.currency ?? currency, { sign: true }) : "—"}</p>
                      <p className="tnum text-[12px] text-muted">{rMult(t.r_multiple)}</p>
                    </div>
                    <RowMenu trade={t} onDuplicate={duplicate} onDelete={(id) => setConfirm([id])} />
                  </Card>
                </li>
              );
            })}
          </ul>

          {pages > 1 && (
            <div className="mt-4 flex items-center justify-between text-[13px] text-muted">
              <span>Page {page + 1} of {pages}</span>
              <div className="flex gap-2">
                <Button size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDialog open={Boolean(confirm)} onClose={() => setConfirm(null)} onConfirm={doDelete} loading={deleting}
        title={confirm && confirm.length > 1 ? `Delete ${confirm.length} trades?` : "Delete this trade?"}
        description="The trade, its journal notes and screenshots will be permanently deleted. Account balances update immediately." />
    </>
  );
}

function RowMenu({ trade, onDuplicate, onDelete }: { trade: Trade; onDuplicate: (id: string) => void; onDelete: (id: string) => void }) {
  return (
    <Menu trigger={({ toggle, open }) => (
      <IconButton label={`Actions for ${trade.symbol}`} size="sm" onClick={toggle} aria-expanded={open}><MoreHorizontal className="size-4" /></IconButton>
    )}>
      {(close) => (
        <>
          <MenuItem href={`/app/journal/${trade.id}`} onClick={close} icon={<Eye />}>View details</MenuItem>
          <MenuItem href={`/app/journal/${trade.id}/edit`} onClick={close} icon={<Pencil />}>Edit</MenuItem>
          <MenuItem onClick={() => { close(); onDuplicate(trade.id); }} icon={<Copy />}>Duplicate</MenuItem>
          <MenuItem danger onClick={() => { close(); onDelete(trade.id); }} icon={<Trash2 />}>Delete</MenuItem>
        </>
      )}
    </Menu>
  );
}
