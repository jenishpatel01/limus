"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronDown, Star } from "lucide-react";
import { useData, useLookups } from "@/lib/data/store";
import type { Trade } from "@/lib/types";
import { EMOTIONS, MISTAKES } from "@/lib/types";
import { ASSET_CLASSES, ASSET_CLASS_LABEL, INSTRUMENTS, SESSIONS, SESSION_LABEL, detectSession, resolveInstrument, type AssetClass, type TradingSession } from "@/lib/engine/instruments";
import { pipValue } from "@/lib/engine/risk";
import {
  applyInstrument, balanceAt, emptyForm, formFromTrade, fxDerivable, fxPatch, journalFromForm, preview, toRow, validate, type TradeFormState,
} from "@/lib/journal/form";
import { utcToWall, wallToUtc } from "@/lib/dates";
import { money, num, pct, pnlClass, rMult } from "@/lib/format";
import { Badge, Button, Card, ChipGroup, Field, Input, Notice, Segmented, Select, TagInput, Textarea, cx, toast } from "@/components/ui";
import { AttachmentManager, PendingFiles } from "./Screenshots";
import { isDemoStrategy } from "@/lib/demo/seed";

export function TradeForm({ trade }: { trade?: Trade }) {
  const router = useRouter();
  const data = useData();
  const { accounts, scopedAccounts, strategies, trades, cash, tz, profile, saveTrade, uploadAttachment, scope } = data;
  const lookups = useLookups();
  const editable = accounts.filter((a) => a.status !== "archived" || a.id === trade?.account_id);
  const defaultAccount = scope.kind === "account" ? scopedAccounts[0] : scope.kind === "demo" ? accounts.find((a) => a.is_demo) : editable.find((a) => !a.is_demo) ?? editable[0];

  const [f, setF] = useState<TradeFormState>(() => trade ? formFromTrade(trade, lookups.journalByTrade.get(trade.id), tz) : emptyForm(defaultAccount, utcToWall(new Date().toISOString(), tz)));
  const [files, setFiles] = useState<File[]>([]);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCosts, setShowCosts] = useState(Boolean(trade && (trade.commission || trade.fees || trade.swap || trade.funding || trade.pnl_source === "reported" || trade.fx_rate !== 1)));
  const [error, setError] = useState<string | null>(null);

  const account = accounts.find((a) => a.id === f.account_id);
  const accCur = account?.currency ?? "USD";
  const issues = useMemo(() => validate(f, tz), [f, tz]);
  const calc = useMemo(() => preview(f), [f]);
  const spec = resolveInstrument(f.symbol || "X", f.asset_class);
  const entryIso = wallToUtc(f.entry_at, tz);
  const balance = account && entryIso ? balanceAt(account, trades, cash, entryIso, trade?.id) : null;
  const riskPct = calc?.riskAmount && balance ? (calc.riskAmount / balance) * 100 : null;
  const canDeriveFx = fxDerivable(f, accCur);
  const visibleStrategies = strategies.filter((s) => !s.is_archived && (account?.is_demo || !isDemoStrategy(s) || s.id === f.strategy_id));

  const set = <K extends keyof TradeFormState>(k: K, v: TradeFormState[K]) => setF((p) => {
    let next = { ...p, [k]: v };
    if (k === "entry_at" && p.session_auto && typeof v === "string") {
      const iso = wallToUtc(v, tz);
      if (iso) next.session = detectSession(new Date(iso));
    }
    if (k === "exit_price" || k === "entry_price" || k === "mark_price" || k === "quote_currency") next = { ...next, ...fxPatch(next, next.symbol, next.asset_class, accCur) };
    return next;
  });
  const err = (k: keyof TradeFormState) => (touched ? issues.errors[k] : undefined);

  const pip = spec.pipSize && calc ? pipValue(spec.pipSize, Number(f.quantity), Number(f.contract_size), Number(f.fx_rate)) : null;
  const sessionNow = f.session || (entryIso ? detectSession(new Date(entryIso)) : "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (Object.keys(issues.errors).length) {
      setError("Please fix the highlighted fields.");
      document.querySelector("[aria-invalid=true]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSaving(true);
    try {
      const saved = await saveTrade(toRow(f, tz, balance), journalFromForm(f), trade?.id);
      let failed = 0;
      for (const file of files) {
        try { await uploadAttachment({ tradeId: saved.id }, file); } catch { failed++; }
      }
      toast(trade ? "Trade updated" : "Trade saved");
      if (failed) toast(`${failed} screenshot${failed > 1 ? "s" : ""} couldn't be uploaded`, "error");
      router.push(`/app/journal/${saved.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the trade");
      setSaving(false);
    }
  }

  if (!editable.length) {
    return <Notice tone="warn">Create a trading account before adding trades.</Notice>;
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="stagger min-w-0 space-y-5">
        {error && <Notice tone="loss">{error}</Notice>}

        <Section title="Instrument" subtitle="What you traded and in which account.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Account" htmlFor="tf-account" error={err("account_id")}>
              <Select id="tf-account" value={f.account_id} aria-invalid={Boolean(err("account_id"))} onChange={(e) => {
                const a = accounts.find((x) => x.id === e.target.value);
                setF((p) => ({ ...p, account_id: e.target.value, ...(a ? fxPatch({ ...p, fx_auto: true }, p.symbol, p.asset_class, a.currency) : {}), fx_auto: true }));
              }}>
                <option value="">Choose…</option>
                {editable.map((a) => <option key={a.id} value={a.id}>{a.name}{a.is_demo ? " (demo)" : ""} · {a.currency}</option>)}
              </Select>
            </Field>
            <Field label="Symbol" htmlFor="tf-symbol" error={err("symbol")} hint={f.symbol && spec.name !== spec.symbol ? spec.name : "e.g. EURUSD, BTCUSD, AAPL, NAS100, XAUUSD"}>
              <Input id="tf-symbol" list="tf-symbols" autoComplete="off" value={f.symbol} aria-invalid={Boolean(err("symbol"))} placeholder="EURUSD"
                onChange={(e) => setF((p) => applyInstrument({ ...p, fx_auto: true }, e.target.value, accCur))} />
              <datalist id="tf-symbols">{INSTRUMENTS.map((i) => <option key={i.symbol} value={i.symbol}>{i.name}</option>)}</datalist>
            </Field>
            <Field label="Asset class" htmlFor="tf-class">
              <Select id="tf-class" value={f.asset_class} onChange={(e) => setF((p) => applyInstrument({ ...p, fx_auto: true }, p.symbol || "X", accCur, e.target.value as AssetClass))}>
                {ASSET_CLASSES.map((c) => <option key={c} value={c}>{ASSET_CLASS_LABEL[c]}</option>)}
              </Select>
            </Field>
            <Field label="Direction">
              <Segmented size="md" ariaLabel="Direction" value={f.direction} onChange={(v) => set("direction", v)} className="w-full [&>button]:flex-1"
                options={[{ value: "long", label: "Buy / Long" }, { value: "short", label: "Sell / Short" }]} />
            </Field>
            <Field label="Status" className="sm:col-span-2">
              <Segmented size="md" ariaLabel="Status" value={f.status} onChange={(v) => set("status", v)}
                options={[{ value: "closed", label: "Closed" }, { value: "open", label: "Open" }, { value: "cancelled", label: "Cancelled" }]} />
            </Field>
          </div>
        </Section>

        <Section title="Execution" subtitle={`Prices in ${f.quote_currency || spec.quote}. Times in ${tz.replace(/_/g, " ")}.`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Entry date & time" htmlFor="tf-entry-at" error={err("entry_at")}>
              <Input id="tf-entry-at" type="datetime-local" value={f.entry_at} aria-invalid={Boolean(err("entry_at"))} onChange={(e) => set("entry_at", e.target.value)} />
            </Field>
            <Field label="Entry price" htmlFor="tf-entry" error={err("entry_price")}>
              <Input id="tf-entry" type="number" inputMode="decimal" step="any" min={0} value={f.entry_price} aria-invalid={Boolean(err("entry_price"))} onChange={(e) => set("entry_price", e.target.value)} />
            </Field>
            <Field label={`Quantity (${spec.unit})`} htmlFor="tf-qty" error={err("quantity")} hint={spec.unit === "lots" ? `1 lot = ${num(Number(f.contract_size) || spec.contractSize)} units` : undefined}>
              <Input id="tf-qty" type="number" inputMode="decimal" step="any" min={0} value={f.quantity} aria-invalid={Boolean(err("quantity"))} onChange={(e) => set("quantity", e.target.value)} />
            </Field>
            <div className="hidden sm:block" />
            <Field label="Stop loss" htmlFor="tf-sl" optional error={err("stop_loss")}>
              <Input id="tf-sl" type="number" inputMode="decimal" step="any" min={0} value={f.stop_loss} aria-invalid={Boolean(err("stop_loss"))} onChange={(e) => set("stop_loss", e.target.value)} />
            </Field>
            <Field label="Take profit" htmlFor="tf-tp" optional error={err("take_profit")}>
              <Input id="tf-tp" type="number" inputMode="decimal" step="any" min={0} value={f.take_profit} aria-invalid={Boolean(err("take_profit"))} onChange={(e) => set("take_profit", e.target.value)} />
            </Field>
            {f.status !== "open" && (
              <>
                <Field label="Exit date & time" htmlFor="tf-exit-at" error={err("exit_at")} optional={f.status === "cancelled"}>
                  <Input id="tf-exit-at" type="datetime-local" value={f.exit_at} aria-invalid={Boolean(err("exit_at"))} onChange={(e) => set("exit_at", e.target.value)} />
                </Field>
                <Field label="Exit price" htmlFor="tf-exit" error={err("exit_price")} optional={f.status === "cancelled"}>
                  <Input id="tf-exit" type="number" inputMode="decimal" step="any" min={0} value={f.exit_price} aria-invalid={Boolean(err("exit_price"))} onChange={(e) => set("exit_price", e.target.value)} />
                </Field>
              </>
            )}
            {f.status === "open" && (
              <Field label="Current price (mark)" htmlFor="tf-mark" optional error={err("mark_price")} hint="Used for unrealised P&L. Limus has no live prices, so update it yourself.">
                <Input id="tf-mark" type="number" inputMode="decimal" step="any" min={0} value={f.mark_price} onChange={(e) => set("mark_price", e.target.value)} />
              </Field>
            )}
            {!f.stop_loss && (
              <Field label="Risk amount (no stop)" htmlFor="tf-risk" optional hint={`In ${accCur}. Used for R multiple when there's no stop loss.`}>
                <Input id="tf-risk" type="number" inputMode="decimal" step="any" min={0} value={f.manual_risk} onChange={(e) => set("manual_risk", e.target.value)} />
              </Field>
            )}
          </div>
        </Section>

        <Card>
          <button type="button" onClick={() => setShowCosts((s) => !s)} aria-expanded={showCosts} className="flex w-full items-center justify-between px-5 py-4 text-left">
            <div>
              <h3 className="text-[15px] font-medium tracking-[-0.02em]">Contract, currency &amp; costs</h3>
              <p className="mt-0.5 text-[13px] text-muted">Contract size {num(Number(f.contract_size))}, rate {f.fx_rate} {accCur}/{f.quote_currency || spec.quote}{f.commission || f.fees ? ", costs added" : ""}</p>
            </div>
            <ChevronDown className={cx("size-4 text-muted transition-transform", showCosts && "rotate-180")} />
          </button>
          {showCosts && (
            <div className="grid gap-4 border-t border-line px-5 py-5 sm:grid-cols-2">
              <Field label="Contract size" htmlFor="tf-cs" error={err("contract_size")} hint="Units per 1.0 quantity. Futures: tick value ÷ tick size (ES = 50).">
                <Input id="tf-cs" type="number" inputMode="decimal" step="any" min={0} value={f.contract_size} onChange={(e) => set("contract_size", e.target.value)} />
              </Field>
              <Field label="Quote currency" htmlFor="tf-qc" error={err("quote_currency")}>
                <Input id="tf-qc" maxLength={3} value={f.quote_currency} onChange={(e) => set("quote_currency", e.target.value.toUpperCase())} />
              </Field>
              <Field label={`Conversion rate (${accCur} per 1 ${f.quote_currency || spec.quote})`} htmlFor="tf-fx" error={err("fx_rate")} className="sm:col-span-2"
                hint={canDeriveFx ? "Calculated from the trade's own prices." : `Enter the ${f.quote_currency || spec.quote}→${accCur} rate at exit. Limus doesn't fetch FX rates.`}>
                <div className="flex gap-2">
                  <Input id="tf-fx" type="number" inputMode="decimal" step="any" min={0} value={f.fx_rate} onChange={(e) => setF((p) => ({ ...p, fx_rate: e.target.value, fx_auto: false }))} />
                  {canDeriveFx && !f.fx_auto && <Button size="md" onClick={() => setF((p) => ({ ...p, fx_auto: true, ...fxPatch({ ...p, fx_auto: true }, p.symbol, p.asset_class, accCur) }))}>Auto</Button>}
                </div>
              </Field>
              <Field label={`Commission (${accCur})`} htmlFor="tf-comm" error={err("commission")} optional>
                <Input id="tf-comm" type="number" inputMode="decimal" step="any" min={0} value={f.commission} onChange={(e) => set("commission", e.target.value)} />
              </Field>
              <Field label={`Other fees (${accCur})`} htmlFor="tf-fees" error={err("fees")} optional>
                <Input id="tf-fees" type="number" inputMode="decimal" step="any" min={0} value={f.fees} onChange={(e) => set("fees", e.target.value)} />
              </Field>
              <Field label={`Swap (${accCur})`} htmlFor="tf-swap" error={err("swap")} optional hint="Negative for a charge, positive for a credit.">
                <Input id="tf-swap" type="number" inputMode="decimal" step="any" value={f.swap} onChange={(e) => set("swap", e.target.value)} />
              </Field>
              <Field label={`Funding (${accCur})`} htmlFor="tf-fund" error={err("funding")} optional hint="Crypto perpetual funding. Negative = paid.">
                <Input id="tf-fund" type="number" inputMode="decimal" step="any" value={f.funding} onChange={(e) => set("funding", e.target.value)} />
              </Field>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-[13.5px] text-ink-3">
                  <input type="checkbox" checked={f.pnl_source === "reported"} onChange={(e) => set("pnl_source", e.target.checked ? "reported" : "calculated")} className="size-4 accent-[var(--primary)]" />
                  Use the gross P&amp;L reported by my broker instead of calculating it
                </label>
                {f.pnl_source === "reported" && (
                  <Field label={`Broker-reported gross P&L (${accCur})`} htmlFor="tf-rep" error={err("reported_gross")} className="mt-3 max-w-xs">
                    <Input id="tf-rep" type="number" inputMode="decimal" step="any" value={f.reported_gross} onChange={(e) => set("reported_gross", e.target.value)} />
                  </Field>
                )}
              </div>
            </div>
          )}
        </Card>

        <Section title="Strategy & context">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Strategy" htmlFor="tf-strat" optional>
              <Select id="tf-strat" value={f.strategy_id} onChange={(e) => set("strategy_id", e.target.value)}>
                <option value="">No strategy</option>
                {visibleStrategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Setup" htmlFor="tf-setup" optional>
              <Input id="tf-setup" maxLength={120} value={f.setup} onChange={(e) => set("setup", e.target.value)} placeholder="e.g. Range break, pullback to 20 EMA" />
            </Field>
            <Field label="Trading session" htmlFor="tf-session" hint={f.session_auto ? "Detected from entry time (UTC hours)." : undefined}>
              <Select id="tf-session" value={sessionNow} onChange={(e) => setF((p) => ({ ...p, session: e.target.value as TradingSession, session_auto: false }))}>
                {SESSIONS.map((s) => <option key={s} value={s}>{SESSION_LABEL[s]}</option>)}
              </Select>
            </Field>
            <Field label="Tags" optional>
              <TagInput value={f.tags} onChange={(v) => set("tags", v)} suggestions={[...new Set(trades.flatMap((t) => t.tags))].slice(0, 50)} />
            </Field>
          </div>
        </Section>

        <Section title="Journal" subtitle="Your reasoning, emotions and what you learned.">
          <div className="grid gap-4">
            <Field label="Pre-trade analysis" htmlFor="tf-pre" optional>
              <Textarea id="tf-pre" maxLength={10000} value={f.pre_trade_analysis} onChange={(e) => set("pre_trade_analysis", e.target.value)} placeholder="Why this trade? Market context, levels, confluence, plan…" />
            </Field>
            <Field label="Post-trade analysis" htmlFor="tf-post" optional>
              <Textarea id="tf-post" maxLength={10000} value={f.post_trade_analysis} onChange={(e) => set("post_trade_analysis", e.target.value)} placeholder="How did it play out? Did you follow the plan?" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Emotional state" htmlFor="tf-emo" optional>
                <Select id="tf-emo" value={f.emotional_state} onChange={(e) => set("emotional_state", e.target.value)}>
                  <option value="">Not recorded</option>
                  {EMOTIONS.map((x) => <option key={x}>{x}</option>)}
                </Select>
              </Field>
              <Field label="Execution rating">
                <div className="flex h-9 items-center gap-1" role="radiogroup" aria-label="Execution rating">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button key={r} type="button" role="radio" aria-checked={f.rating === r} aria-label={`${r} of 5`} onClick={() => set("rating", f.rating === r ? null : r)} className="rounded p-0.5">
                      <Star className={cx("size-5", f.rating && r <= f.rating ? "fill-[var(--series-4)] text-[var(--series-4)]" : "text-line-strong")} />
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <Field label="Emotions during the trade" optional>
              <ChipGroup options={EMOTIONS.map((e) => ({ value: e, label: e }))} value={f.emotions} onChange={(v) => set("emotions", v)} />
            </Field>
            <Field label="Execution mistakes" optional>
              <ChipGroup options={[...new Set([...MISTAKES, ...f.mistakes])].map((m) => ({ value: m, label: m }))} value={f.mistakes} onChange={(v) => set("mistakes", v)} />
              <TagInput value={f.mistakes.filter((m) => !(MISTAKES as readonly string[]).includes(m))} onChange={(custom) => set("mistakes", [...f.mistakes.filter((m) => (MISTAKES as readonly string[]).includes(m)), ...custom])} placeholder="Add your own mistake…" max={20} />
            </Field>
            <Field label="Lessons learned" htmlFor="tf-lessons" optional>
              <Textarea id="tf-lessons" rows={3} maxLength={10000} value={f.lessons} onChange={(e) => set("lessons", e.target.value)} />
            </Field>
            <Field label="Other notes" htmlFor="tf-notes" optional>
              <Textarea id="tf-notes" rows={3} maxLength={10000} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </div>
        </Section>

        <Section title="Screenshots" subtitle="Charts before and after the trade. Stored privately in your account.">
          {trade ? <AttachmentManager parent={{ tradeId: trade.id }} items={lookups.attachmentsByTrade.get(trade.id) ?? []} /> : <PendingFiles files={files} onChange={setFiles} />}
        </Section>
      </div>

      {/* Live calculation panel */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <Card className="p-5">
          <h3 className="text-[15px] font-medium tracking-[-0.02em]">Trade calculation</h3>
          <p className="mt-0.5 text-[12px] text-muted">Updates as you type. Values are in {accCur}.</p>
          <dl className="mt-4 space-y-2.5 text-[13px]">
            <Row label="Gross P&L" value={f.status === "closed" ? <span className={pnlClass(calc?.grossPnl)}>{money(calc?.grossPnl, accCur, { sign: true })}</span> : "—"} />
            <Row label="Costs" value={calc ? money(-calc.costs, accCur) : "—"} />
            <Row label={<span className="font-medium text-ink">Net P&L</span>} value={f.status === "closed" ? <span className={cx("text-[15px] font-medium", pnlClass(calc?.netPnl))}>{money(calc?.netPnl, accCur, { sign: true })}</span> : "—"} />
            {f.status === "open" && <Row label="Unrealised P&L" value={<span className={pnlClass(calc?.unrealisedPnl)}>{money(calc?.unrealisedPnl, accCur, { sign: true })}</span>} />}
            <div className="my-3 h-px bg-line" />
            <Row label="R multiple" value={rMult(calc?.rMultiple)} />
            <Row label="Risk amount" value={money(calc?.riskAmount, accCur)} />
            <Row label="Risk % of balance" value={riskPct !== null ? pct(riskPct, 2) : "—"} hint={balance !== null ? `Balance at entry ${money(balance, accCur)}` : undefined} />
            <Row label="Planned R:R" value={calc?.plannedRR ? `1 : ${calc.plannedRR.toFixed(2)}` : "—"} />
            <div className="my-3 h-px bg-line" />
            <Row label="Position size" value={money(calc?.positionValue, accCur)} hint="Notional value at entry" />
            <Row label="Value per 1.0 move" value={money(calc?.pointValue, accCur)} />
            {pip !== null && <Row label="Pip value" value={money(pip, accCur)} />}
          </dl>
          {profile && riskPct !== null && riskPct > profile.default_risk_pct * 1.5 && (
            <Badge tone="warn" className="mt-4 h-auto py-1 whitespace-normal">Risk is above your {profile.default_risk_pct}% default</Badge>
          )}
          {touched && issues.warnings.length > 0 && (
            <ul className="mt-4 space-y-2">
              {issues.warnings.map((w) => <li key={w} className="flex gap-2 text-[12px] leading-snug text-warn"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{w}</li>)}
            </ul>
          )}
          <div className="mt-5 flex flex-col gap-2">
            <Button type="submit" variant="primary" size="lg" loading={saving}>{trade ? "Save changes" : "Save trade"}</Button>
            <Button size="lg" onClick={() => router.back()} disabled={saving}>Cancel</Button>
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-faint">The database recalculates P&amp;L from these inputs when you save.</p>
        </Card>
      </div>
    </form>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card className="px-5 py-5">
      <h3 className="text-[15px] font-medium tracking-[-0.02em]">{title}</h3>
      {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function Row({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-3" title={hint}>
      <dt className="text-muted">{label}</dt>
      <dd className="tnum text-right text-ink">{value}{hint && <span className="block text-[11px] text-faint">{hint}</span>}</dd>
    </div>
  );
}
