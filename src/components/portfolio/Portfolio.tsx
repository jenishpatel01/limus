"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowDownToLine, ArrowLeft, ArrowUpFromLine, MoreHorizontal, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { useData } from "@/lib/data/store";
import { combineAccounts, type AccountSummary } from "@/lib/engine/accounts";
import { computeStats } from "@/lib/engine/metrics";
import { curveToChart } from "@/lib/analytics";
import { dateTime, money, pct, pnlClass, pnlTone, price, ratio, rMult } from "@/lib/format";
import { ACCOUNT_TYPE_LABEL, type TradingAccount } from "@/lib/types";
import {
  Badge, Button, ButtonLink, Card, CardHeader, ConfirmDialog, EmptyState, IconButton, Menu, MenuItem, PageHeader, StatCard, cx, toast,
} from "@/components/ui";
import { DrawdownChart, EquityChart } from "@/components/charts";
import { AccountModal, CashModal } from "./AccountForms";

function statusTone(a: TradingAccount) {
  if (a.is_demo) return "warn" as const;
  return a.status === "active" ? ("profit" as const) : a.status === "breached" ? ("loss" as const) : a.status === "passed" ? ("primary" as const) : ("neutral" as const);
}

export function PortfolioPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { accounts, summaries, profile, setScope } = useData();
  const [modal, setModal] = useState<TradingAccount | "new" | null>(() => (params.get("new") === "1" ? "new" : null));
  const newParam = params.get("new");
  const [lastNew, setLastNew] = useState(newParam);
  if (lastNew !== newParam) { setLastNew(newParam); if (newParam === "1") setModal("new"); }
  const [cash, setCash] = useState<{ account: TradingAccount; type: "deposit" | "withdrawal" } | null>(null);
  const [del, setDel] = useState<TradingAccount | null>(null);

  const base = profile?.base_currency ?? "USD";
  const real = accounts.filter((a) => !a.is_demo);
  const demo = accounts.filter((a) => a.is_demo);
  const realSummaries = real.map((a) => summaries.get(a.id)!);
  const combined = combineAccounts(realSummaries, base);
  const otherCurrencies = [...new Set(combined.excluded.map((s) => s.account.currency))];

  return (
    <>
      <PageHeader title="Portfolio" icon={<Wallet />} description="Your trading accounts, kept separate, with combined totals."
        actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setModal("new")}>New account</Button>} />

      {real.length > 0 && (
        <>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-[15px] font-medium tracking-[-0.02em]">Combined portfolio <span className="font-normal text-muted">· {combined.accounts.length} account{combined.accounts.length === 1 ? "" : "s"} in {base}</span></h2>
          </div>
          <div className="mb-3 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Balance" value={money(combined.balance, base)} sub={`Equity ${money(combined.equity, base, { compact: true })}`} />
            <StatCard label="Net profit" value={money(combined.netProfit, base, { sign: true })} tone={pnlTone(combined.netProfit)} sub={pct(combined.returnPct, 2, true)} />
            <StatCard label="Realised / unrealised" value={money(combined.realisedPnl, base, { sign: true })} tone={pnlTone(combined.realisedPnl)} sub={<span className={pnlClass(combined.unrealisedPnl)}>{money(combined.unrealisedPnl, base, { sign: true, compact: true })}</span>} />
            <StatCard label="Deposits / withdrawals" value={money(combined.deposits, base)} sub={`−${money(combined.withdrawals, base, { compact: true })}`} />
          </div>
          {otherCurrencies.length > 0 && <p className="mb-6 text-[12.5px] text-muted">Accounts in {otherCurrencies.join(", ")} aren&apos;t converted into {base} (Limus doesn&apos;t fetch FX rates). They&apos;re listed below with their own totals.</p>}
        </>
      )}

      <div className="mt-6">
        {real.length === 0 ? (
          <Card><EmptyState icon={<Wallet />} title="No trading accounts yet" description="Create an account for each broker, prop challenge or portfolio you trade." action={<Button variant="primary" onClick={() => setModal("new")}>Create account</Button>} /></Card>
        ) : (
          <AccountTable rows={realSummaries} onEdit={setModal} onCash={(account, type) => setCash({ account, type })} onDelete={setDel}
            onOpen={(a) => router.push(`/app/portfolio/${a.id}`)} onJournal={(a) => { setScope({ kind: "account", id: a.id }); router.push("/app/journal"); }} />
        )}
      </div>

      {demo.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-1 text-[15px] font-medium tracking-[-0.02em]">Demo account</h2>
          <p className="mb-3 text-[13px] text-muted">Sample data. Never included in the combined totals above. Remove it from Settings.</p>
          <AccountTable rows={demo.map((a) => summaries.get(a.id)!)} onEdit={setModal} onCash={(account, type) => setCash({ account, type })} onDelete={setDel}
            onOpen={(a) => router.push(`/app/portfolio/${a.id}`)} onJournal={() => { setScope({ kind: "demo" }); router.push("/app/journal"); }} />
        </div>
      )}

      {modal && <AccountModal open onClose={() => { setModal(null); if (params.get("new")) router.replace("/app/portfolio"); }} account={modal === "new" ? null : modal} />}
      {cash && <CashModal open onClose={() => setCash(null)} account={cash.account} defaultType={cash.type} />}
      <DeleteAccount account={del} onClose={() => setDel(null)} />
    </>
  );
}

function DeleteAccount({ account, onClose, after }: { account: TradingAccount | null; onClose: () => void; after?: () => void }) {
  const { deleteAccount, trades } = useData();
  const [busy, setBusy] = useState(false);
  const count = account ? trades.filter((t) => t.account_id === account.id).length : 0;
  return (
    <ConfirmDialog open={Boolean(account)} onClose={onClose} loading={busy} title={`Delete ${account?.name ?? "account"}?`}
      description={<>This permanently deletes the account, its <strong className="text-ink">{count} trade{count === 1 ? "" : "s"}</strong>, their journal notes and screenshots, and all deposits and withdrawals. Consider setting the status to Archived instead.</>}
      onConfirm={async () => {
        if (!account) return;
        setBusy(true);
        try { await deleteAccount(account.id); toast("Account deleted"); onClose(); after?.(); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't delete", "error"); } finally { setBusy(false); }
      }} />
  );
}

function AccountTable({ rows, onEdit, onCash, onDelete, onOpen, onJournal }: {
  rows: AccountSummary[]; onEdit: (a: TradingAccount) => void; onCash: (a: TradingAccount, t: "deposit" | "withdrawal") => void;
  onDelete: (a: TradingAccount) => void; onOpen: (a: TradingAccount) => void; onJournal: (a: TradingAccount) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-[13px]">
          <thead>
            <tr className="border-b border-line bg-subtle text-left text-[12px] text-muted">
              <th className="px-5 py-2.5 font-medium">Account</th>
              <th className="px-3 py-2.5 font-medium">Type</th>
              <th className="px-3 py-2.5 text-right font-medium">Initial</th>
              <th className="px-3 py-2.5 text-right font-medium">Deposits / withdrawals</th>
              <th className="px-3 py-2.5 text-right font-medium">Balance</th>
              <th className="px-3 py-2.5 text-right font-medium">Net profit</th>
              <th className="px-3 py-2.5 text-right font-medium">Return</th>
              <th className="px-3 py-2.5 text-right font-medium">Max DD</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const a = s.account;
              return (
                <tr key={a.id} className="border-b border-line last:border-0 hover:bg-subtle">
                  <td className="px-5 py-3">
                    <Link href={`/app/portfolio/${a.id}`} className="font-medium text-ink hover:underline">{a.name}</Link>
                    <p className="text-[12px] text-muted">{a.broker || "No broker"} · {a.currency}</p>
                  </td>
                  <td className="px-3 py-3 text-muted">{ACCOUNT_TYPE_LABEL[a.account_type]}</td>
                  <td className="tnum px-3 py-3 text-right">{money(s.initialBalance, a.currency)}</td>
                  <td className="tnum px-3 py-3 text-right text-muted">+{money(s.deposits, a.currency, { compact: true })} / −{money(s.withdrawals, a.currency, { compact: true })}</td>
                  <td className="tnum px-3 py-3 text-right font-medium">{money(s.balance, a.currency)}{s.unrealisedPnl !== 0 && <span className="block text-[11.5px] font-normal text-muted">Equity {money(s.equity, a.currency)}</span>}</td>
                  <td className={cx("tnum px-3 py-3 text-right font-medium", pnlClass(s.netProfit))}>{money(s.netProfit, a.currency, { sign: true })}</td>
                  <td className={cx("tnum px-3 py-3 text-right", pnlClass(s.returnPct))}>{pct(s.returnPct, 2, true)}</td>
                  <td className="tnum px-3 py-3 text-right text-muted">{pct(s.drawdown.maxDrawdownPct, 2)}</td>
                  <td className="px-3 py-3"><Badge tone={statusTone(a)}>{a.is_demo ? "Demo" : a.status}</Badge></td>
                  <td className="pr-3 text-right">
                    <Menu trigger={({ toggle, open }) => <IconButton label={`Actions for ${a.name}`} size="sm" onClick={toggle} aria-expanded={open}><MoreHorizontal className="size-4" /></IconButton>}>
                      {(close) => (
                        <>
                          <MenuItem onClick={() => { close(); onOpen(a); }}>View details</MenuItem>
                          <MenuItem onClick={() => { close(); onJournal(a); }}>Open in journal</MenuItem>
                          <MenuItem icon={<ArrowDownToLine />} onClick={() => { close(); onCash(a, "deposit"); }}>Add deposit</MenuItem>
                          <MenuItem icon={<ArrowUpFromLine />} onClick={() => { close(); onCash(a, "withdrawal"); }}>Add withdrawal</MenuItem>
                          <MenuItem icon={<Pencil />} onClick={() => { close(); onEdit(a); }}>Edit</MenuItem>
                          <MenuItem danger icon={<Trash2 />} onClick={() => { close(); onDelete(a); }}>Delete</MenuItem>
                        </>
                      )}
                    </Menu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { accounts, summaries, trades, cash, tz, deleteCash, setScope } = useData();
  const account = accounts.find((a) => a.id === id);
  const [edit, setEdit] = useState(false);
  const [cashModal, setCashModal] = useState<"deposit" | "withdrawal" | null>(null);
  const [del, setDel] = useState(false);
  const mine = useMemo(() => trades.filter((t) => t.account_id === id), [trades, id]);
  const stats = useMemo(() => computeStats(mine), [mine]);

  if (!account) return <Card><EmptyState title="Account not found" action={<ButtonLink href="/app/portfolio">Back to portfolio</ButtonLink>} /></Card>;
  const s = summaries.get(account.id)!;
  const cur = account.currency;
  const flows = cash.filter((c) => c.account_id === account.id).sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const open = mine.filter((t) => t.status === "open");
  const recent = mine.filter((t) => t.status === "closed").sort((a, b) => b.exit_at!.localeCompare(a.exit_at!)).slice(0, 8);
  const capital = s.initialBalance + s.deposits;
  const targetProgress = account.profit_target_pct ? (s.realisedPnl / (capital * account.profit_target_pct / 100)) * 100 : null;
  const ddUsed = account.max_drawdown_pct ? (s.drawdown.currentDrawdownPct / account.max_drawdown_pct) * 100 : null;

  return (
    <>
      <Link href="/app/portfolio" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"><ArrowLeft className="size-3.5" />Portfolio</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><h1 className="text-[26px] font-medium tracking-[-0.04em]">{account.name}</h1><Badge tone={statusTone(account)}>{account.is_demo ? "Demo" : account.status}</Badge></div>
          <p className="mt-1 text-[13.5px] text-muted">{ACCOUNT_TYPE_LABEL[account.account_type]} · {account.broker || "No broker"} · {cur}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={<ArrowDownToLine className="size-4" />} onClick={() => setCashModal("deposit")}>Deposit</Button>
          <Button icon={<ArrowUpFromLine className="size-4" />} onClick={() => setCashModal("withdrawal")}>Withdraw</Button>
          <Button icon={<Pencil className="size-4" />} onClick={() => setEdit(true)}>Edit</Button>
          <IconButton label="Delete account" onClick={() => setDel(true)}><Trash2 className="size-4" /></IconButton>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Current balance" value={money(s.balance, cur)} sub={`Initial ${money(s.initialBalance, cur, { compact: true })}`} />
        <StatCard label="Equity" value={money(s.equity, cur)} sub={<span className={pnlClass(s.unrealisedPnl)}>{money(s.unrealisedPnl, cur, { sign: true, compact: true })} open</span>} />
        <StatCard label="Net profit" value={money(s.netProfit, cur, { sign: true })} tone={pnlTone(s.netProfit)} sub={pct(s.returnPct, 2, true)} />
        <StatCard label="Max drawdown" value={pct(s.drawdown.maxDrawdownPct, 2)} tone={s.drawdown.maxDrawdown > 0 ? "loss" : null} sub={money(-s.drawdown.maxDrawdown, cur, { compact: true })} />
        <StatCard label="Realised P&L" value={money(s.realisedPnl, cur, { sign: true })} tone={pnlTone(s.realisedPnl)} />
        <StatCard label="Win rate" value={pct(stats.winRate)} sub={`${stats.totalTrades} trades`} />
        <StatCard label="Profit factor" value={ratio(stats.profitFactor)} sub={`Avg ${rMult(stats.avgR)}`} />
        <StatCard label="Open positions" value={s.openPositions} sub={s.openRisk ? `${money(s.openRisk, cur, { compact: true })} at risk` : undefined} />
      </div>

      {(account.profit_target_pct || account.max_drawdown_pct || account.daily_loss_limit_pct) && (
        <Card className="mb-6 p-5">
          <h3 className="text-[15px] font-medium tracking-[-0.02em]">Account rules</h3>
          <div className="mt-4 grid gap-5 md:grid-cols-3">
            {account.profit_target_pct && <Progress label={`Profit target ${account.profit_target_pct}%`} value={targetProgress ?? 0} text={`${money(s.realisedPnl, cur)} of ${money(capital * account.profit_target_pct / 100, cur)}`} tone="profit" />}
            {account.max_drawdown_pct && <Progress label={`Max drawdown ${account.max_drawdown_pct}%`} value={ddUsed ?? 0} text={`Current ${pct(s.drawdown.currentDrawdownPct, 2)} · worst ${pct(s.drawdown.maxDrawdownPct, 2)}`} tone="loss" />}
            {account.daily_loss_limit_pct && <div><p className="text-[13px] text-ink-3">Daily loss limit {account.daily_loss_limit_pct}%</p><p className="mt-2 text-[12.5px] text-muted">Tracked on the <Link href="/app/risk" className="text-primary-text hover:underline">Risk page</Link>. You&apos;ll get an alert when a day&apos;s realised loss reaches it.</p></div>}
          </div>
        </Card>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card><CardHeader title="Equity curve" subtitle="All time, after each trade and cash movement" /><div className="p-4 pt-3"><EquityChart data={curveToChart(s.curve, tz)} currency={cur} baseline={s.initialBalance} /></div></Card>
        <Card><CardHeader title="Drawdown" subtitle="% below the running peak" /><div className="p-4 pt-3"><DrawdownChart data={curveToChart(s.curve, tz, "drawdownPct")} height={260} /></div></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Deposits & withdrawals" action={<Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => setCashModal("deposit")}>Add</Button>} />
          <ul className="px-5 pb-4 pt-2">
            {flows.length === 0 ? <li className="py-4 text-[13px] text-muted">No cash movements recorded.</li> : flows.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 border-b border-line py-2.5 text-[13px] last:border-0">
                <div className="min-w-0"><p className="font-medium capitalize">{c.type}</p><p className="truncate text-[12px] text-muted">{dateTime(c.occurred_at, tz)}{c.note ? ` · ${c.note}` : ""}</p></div>
                <div className="flex items-center gap-2">
                  <span className={cx("tnum font-medium", c.type === "deposit" ? "text-profit" : "text-ink")}>{c.type === "deposit" ? "+" : "−"}{money(c.amount, cur)}</span>
                  <IconButton label="Delete cash movement" size="sm" onClick={async () => { try { await deleteCash(c.id); toast("Removed"); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't delete", "error"); } }}><Trash2 className="size-3.5" /></IconButton>
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Positions & recent trades" action={<Button size="sm" onClick={() => { setScope(account.is_demo ? { kind: "demo" } : { kind: "account", id: account.id }); router.push("/app/journal"); }}>Open journal</Button>} />
          <ul className="px-5 pb-4 pt-2">
            {[...open, ...recent].length === 0 ? <li className="py-4 text-[13px] text-muted">No trades in this account yet.</li> : [...open, ...recent].map((t) => (
              <li key={t.id} className="border-b border-line last:border-0">
                <Link href={`/app/journal/${t.id}`} className="flex items-center justify-between gap-3 py-2.5 text-[13px] hover:opacity-80">
                  <div><span className="font-medium">{t.symbol}</span> <Badge tone={t.direction === "long" ? "profit" : "loss"}>{t.direction === "long" ? "Buy" : "Sell"}</Badge>{t.status === "open" && <Badge className="ml-1" tone="primary">open</Badge>}<p className="text-[12px] text-muted">{dateTime(t.exit_at ?? t.entry_at, tz)} · @ {price(t.entry_price)}</p></div>
                  <span className={cx("tnum font-medium", pnlClass(t.net_pnl))}>{t.status === "closed" ? money(t.net_pnl, cur, { sign: true }) : "Open"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {edit && <AccountModal open onClose={() => setEdit(false)} account={account} />}
      {cashModal && <CashModal open onClose={() => setCashModal(null)} account={account} defaultType={cashModal} />}
      <DeleteAccount account={del ? account : null} onClose={() => setDel(false)} after={() => router.replace("/app/portfolio")} />
    </>
  );
}

function Progress({ label, value, text, tone }: { label: string; value: number; text: ReactNode; tone: "profit" | "loss" }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex justify-between text-[13px]"><span className="text-ink-3">{label}</span><span className="tnum text-muted">{v.toFixed(0)}%</span></div>
      <div className="mt-2 h-2 rounded-full bg-muted-bg" role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={cx("h-full rounded-full", tone === "profit" ? "bg-profit" : v > 80 ? "bg-loss" : "bg-warn")} style={{ width: `${v}%` }} />
      </div>
      <p className="tnum mt-1.5 text-[12px] text-muted">{text}</p>
    </div>
  );
}
