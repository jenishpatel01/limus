"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ArrowLeft, Copy, Pencil, Star, Trash2 } from "lucide-react";
import { useData, useLookups } from "@/lib/data/store";
import { ASSET_CLASS_LABEL, SESSION_LABEL, resolveInstrument } from "@/lib/engine/instruments";
import { calcTrade } from "@/lib/engine/pnl";
import { pipValue } from "@/lib/engine/risk";
import { dateTime, duration, money, num, pct, pnlClass, price, rMult } from "@/lib/format";
import { ACCOUNT_TYPE_LABEL } from "@/lib/types";
import { Badge, Button, ButtonLink, Card, CardHeader, ConfirmDialog, EmptyState, cx, toast } from "@/components/ui";
import { AttachmentManager } from "./Screenshots";
import { TradeForm } from "./TradeForm";

function useTrade() {
  const { id } = useParams<{ id: string }>();
  const { trades } = useData();
  return trades.find((t) => t.id === id);
}

export function EditTrade() {
  const trade = useTrade();
  if (!trade) return <NotFound />;
  return (
    <>
      <BackLink href={`/app/journal/${trade.id}`} label="Back to trade" />
      <h1 className="mb-6 text-[26px] font-medium tracking-[-0.04em]">Edit {trade.symbol} trade</h1>
      <TradeForm trade={trade} />
    </>
  );
}

export function NewTrade() {
  return (
    <>
      <BackLink href="/app/journal" label="Journal" />
      <h1 className="mb-1 text-[26px] font-medium tracking-[-0.04em]">New trade</h1>
      <p className="mb-6 text-[14px] text-muted">Prices, size and costs drive the calculations. Journal notes and screenshots are optional.</p>
      <TradeForm />
    </>
  );
}

function BackLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"><ArrowLeft className="size-3.5" />{label}</Link>;
}

function NotFound() {
  return <Card><EmptyState title="Trade not found" description="It may have been deleted, or it belongs to a different account." action={<ButtonLink href="/app/journal">Back to journal</ButtonLink>} /></Card>;
}

export function TradeDetail() {
  const trade = useTrade();
  const router = useRouter();
  const { tz, deleteTrades, duplicateTrade } = useData();
  const lookups = useLookups();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!trade) return <NotFound />;

  const account = lookups.account.get(trade.account_id);
  const cur = account?.currency ?? "USD";
  const strategy = trade.strategy_id ? lookups.strategy.get(trade.strategy_id) : null;
  const journal = lookups.journalByTrade.get(trade.id);
  const shots = lookups.attachmentsByTrade.get(trade.id) ?? [];
  const calc = calcTrade({
    direction: trade.direction, status: trade.status, entryPrice: trade.entry_price, exitPrice: trade.exit_price, stopLoss: trade.stop_loss, takeProfit: trade.take_profit,
    markPrice: trade.mark_price, quantity: trade.quantity, contractSize: trade.contract_size, fxRate: trade.fx_rate, commission: trade.commission, fees: trade.fees,
    swap: trade.swap, funding: trade.funding, pnlSource: trade.pnl_source, reportedGross: trade.gross_pnl, manualRiskAmount: trade.risk_amount,
  });
  const spec = resolveInstrument(trade.symbol, trade.asset_class);
  const pip = spec.pipSize ? pipValue(spec.pipSize, trade.quantity, trade.contract_size, trade.fx_rate) : null;
  const hold = trade.exit_at ? (new Date(trade.exit_at).getTime() - new Date(trade.entry_at).getTime()) / 60000 : null;
  const headline = trade.status === "closed" ? trade.net_pnl : trade.status === "open" ? calc.unrealisedPnl : null;

  async function dup() {
    setBusy(true);
    try { const c = await duplicateTrade(trade!.id); toast("Trade duplicated. Review the copy."); router.push(`/app/journal/${c.id}/edit`); }
    catch (e) { toast(e instanceof Error ? e.message : "Couldn't duplicate", "error"); setBusy(false); }
  }
  async function del() {
    setBusy(true);
    try { await deleteTrades([trade!.id]); toast("Trade deleted"); router.replace("/app/journal"); }
    catch (e) { toast(e instanceof Error ? e.message : "Couldn't delete", "error"); setBusy(false); setConfirm(false); }
  }

  return (
    <>
      <BackLink href="/app/journal" label="Journal" />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[28px] font-medium tracking-[-0.04em]">{trade.symbol}</h1>
            <Badge tone={trade.direction === "long" ? "profit" : "loss"}>{trade.direction === "long" ? "Buy / Long" : "Sell / Short"}</Badge>
            <Badge tone={trade.status === "open" ? "primary" : "neutral"}>{trade.status}</Badge>
            {account?.is_demo && <Badge tone="warn">Demo</Badge>}
            {trade.source === "import" && <Badge>Imported</Badge>}
          </div>
          <p className="mt-1 text-[13.5px] text-muted">{ASSET_CLASS_LABEL[trade.asset_class]} · {account?.name ?? "Unknown account"} · opened {dateTime(trade.entry_at, tz)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={<Copy className="size-4" />} onClick={dup} disabled={busy}>Duplicate</Button>
          <Button icon={<Trash2 className="size-4" />} onClick={() => setConfirm(true)} disabled={busy}>Delete</Button>
          <ButtonLink href={`/app/journal/${trade.id}/edit`} variant="primary" icon={<Pencil className="size-4" />}>Edit</ButtonLink>
        </div>
      </div>

      <div className="stagger mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi label={trade.status === "open" ? "Unrealised P&L" : "Net P&L"} value={money(headline, cur, { sign: true })} className={pnlClass(headline)} />
        <Kpi label="R multiple" value={rMult(trade.r_multiple)} className={pnlClass(trade.r_multiple)} />
        <Kpi label="Risk" value={money(trade.risk_amount, cur)} sub={trade.risk_pct !== null ? `${pct(trade.risk_pct, 2)} of balance` : undefined} />
        <Kpi label="Holding time" value={duration(hold)} sub={trade.session ? SESSION_LABEL[trade.session] : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="stagger min-w-0 space-y-4">
          <Card>
            <CardHeader title="Execution" />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 p-5 text-[13px] sm:grid-cols-3">
              <Item label="Entry price" value={price(trade.entry_price)} />
              <Item label="Exit price" value={price(trade.exit_price)} />
              <Item label={trade.status === "open" ? "Mark price" : "Quantity"} value={trade.status === "open" ? price(trade.mark_price) : `${num(trade.quantity, 6)} ${spec.unit}`} />
              <Item label="Stop loss" value={price(trade.stop_loss)} />
              <Item label="Take profit" value={price(trade.take_profit)} />
              <Item label="Planned R:R" value={calc.plannedRR ? `1 : ${calc.plannedRR.toFixed(2)}` : "—"} />
              <Item label="Entry time" value={dateTime(trade.entry_at, tz)} />
              <Item label="Exit time" value={dateTime(trade.exit_at, tz)} />
              {trade.status === "open" && <Item label="Quantity" value={`${num(trade.quantity, 6)} ${spec.unit}`} />}
              <Item label="Position size" value={money(calc.positionValue, cur)} />
            </dl>
          </Card>

          <Card>
            <CardHeader title="Journal" subtitle={journal ? undefined : "No notes yet."} action={!journal ? <ButtonLink size="sm" href={`/app/journal/${trade.id}/edit`}>Add notes</ButtonLink> : undefined} />
            {journal ? (
              <div className="space-y-5 p-5 text-[14px]">
                <Text label="Pre-trade analysis" value={journal.pre_trade_analysis} />
                <Text label="Post-trade analysis" value={journal.post_trade_analysis} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[12px] text-muted">Emotional state</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">{journal.emotional_state ? <Badge tone="primary">{journal.emotional_state}</Badge> : <span className="text-faint">—</span>}{journal.emotions.filter((e) => e !== journal.emotional_state).map((e) => <Badge key={e}>{e}</Badge>)}</div>
                  </div>
                  <div>
                    <p className="text-[12px] text-muted">Execution rating</p>
                    <div className="mt-1.5 flex gap-0.5" aria-label={journal.rating ? `${journal.rating} of 5` : "Not rated"}>
                      {[1, 2, 3, 4, 5].map((r) => <Star key={r} className={cx("size-4", journal.rating && r <= journal.rating ? "fill-[var(--series-4)] text-[var(--series-4)]" : "text-line-strong")} />)}
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-[12px] text-muted">Execution mistakes</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">{journal.mistakes.length ? journal.mistakes.map((m) => <Badge key={m} tone="loss">{m}</Badge>) : <span className="text-[13px] text-faint">None recorded</span>}</div>
                </div>
                <Text label="Lessons learned" value={journal.lessons} />
                <Text label="Other notes" value={journal.notes} />
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Screenshots" subtitle={`${shots.length} image${shots.length === 1 ? "" : "s"}`} />
            <div className="p-5"><AttachmentManager parent={{ tradeId: trade.id }} items={shots} /></div>
          </Card>
        </div>

        <div className="stagger space-y-4">
          <Card className="p-5">
            <h3 className="text-[15px] font-medium tracking-[-0.02em]">P&amp;L breakdown</h3>
            <dl className="mt-4 space-y-2.5 text-[13px]">
              <Line label={trade.pnl_source === "reported" ? "Gross P&L (broker)" : "Gross P&L"} value={money(trade.status === "open" ? null : trade.gross_pnl, cur, { sign: true })} />
              <Line label="Commission" value={money(-trade.commission, cur)} />
              <Line label="Fees" value={money(-trade.fees, cur)} />
              <Line label="Swap" value={money(trade.swap, cur, { sign: true })} />
              <Line label="Funding" value={money(trade.funding, cur, { sign: true })} />
              <div className="h-px bg-line" />
              <Line label={<span className="font-medium text-ink">{trade.status === "open" ? "Unrealised P&L" : "Net P&L"}</span>} value={<span className={cx("font-medium", pnlClass(headline))}>{money(headline, cur, { sign: true })}</span>} />
            </dl>
          </Card>
          <Card className="p-5">
            <h3 className="text-[15px] font-medium tracking-[-0.02em]">Contract</h3>
            <dl className="mt-4 space-y-2.5 text-[13px]">
              <Line label="Contract size" value={num(trade.contract_size, 4)} />
              <Line label="Quote currency" value={trade.quote_currency ?? "—"} />
              <Line label={`Rate (${cur} per ${trade.quote_currency ?? "unit"})`} value={num(trade.fx_rate, 8)} />
              <Line label="Value per 1.0 move" value={money(calc.pointValue, cur)} />
              {pip !== null && <Line label="Pip value" value={money(pip, cur)} />}
            </dl>
          </Card>
          <Card className="p-5">
            <h3 className="text-[15px] font-medium tracking-[-0.02em]">Context</h3>
            <dl className="mt-4 space-y-2.5 text-[13px]">
              <Line label="Account" value={account ? <Link className="hover:underline" href={`/app/portfolio/${account.id}`}>{account.name}</Link> : "—"} />
              <Line label="Account type" value={account ? ACCOUNT_TYPE_LABEL[account.account_type] : "—"} />
              <Line label="Strategy" value={strategy ? <Link className="hover:underline" href={`/app/strategies/${strategy.id}`}>{strategy.name}</Link> : "—"} />
              <Line label="Setup" value={trade.setup ?? "—"} />
              <Line label="Session" value={trade.session ? SESSION_LABEL[trade.session] : "—"} />
            </dl>
            {trade.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-1">{trade.tags.map((t) => <Link key={t} href={`/app/journal?q=${encodeURIComponent(t)}`}><Badge>#{t}</Badge></Link>)}</div>}
          </Card>
        </div>
      </div>

      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={del} loading={busy} title="Delete this trade?"
        description="The trade, its journal notes and screenshots will be permanently deleted. Account balances update immediately." />
    </>
  );
}

function Kpi({ label, value, sub, className }: { label: string; value: string; sub?: string; className?: string }) {
  return (
    <Card as="div" className="p-4">
      <p className="text-[12.5px] text-muted">{label}</p>
      <p className={cx("tnum mt-1 text-[22px] font-medium tracking-[-0.03em]", className)}>{value}</p>
      {sub && <p className="mt-0.5 text-[12px] text-muted">{sub}</p>}
    </Card>
  );
}

function Item({ label, value }: { label: string; value: ReactNode }) {
  return <div className="min-w-0"><dt className="text-[12px] text-muted">{label}</dt><dd className="tnum mt-0.5 truncate font-medium">{value}</dd></div>;
}

function Line({ label, value }: { label: ReactNode; value: ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><dt className="text-muted">{label}</dt><dd className="tnum truncate text-right text-ink">{value}</dd></div>;
}

function Text({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[12px] text-muted">{label}</p>
      <p className={cx("mt-1 whitespace-pre-wrap leading-relaxed", value ? "text-body" : "text-faint")}>{value || "—"}</p>
    </div>
  );
}
