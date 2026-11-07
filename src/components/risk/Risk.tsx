"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { useData } from "@/lib/data/store";
import { ASSET_CLASS_LABEL, INSTRUMENTS, deriveFxRate, resolveInstrument, type AssetClass } from "@/lib/engine/instruments";
import { dailyLossStatus, pipValue, positionSize, rewardToRisk, riskPercent, stopFromRisk, targetFromRR } from "@/lib/engine/risk";
import { calcTrade, type Direction } from "@/lib/engine/pnl";
import { dayKey, startOfDayInTz } from "@/lib/dates";
import { fixed, money, num, pct, price } from "@/lib/format";
import { Badge, Button, Card, CardHeader, Field, Input, Notice, PageHeader, Segmented, Select, cx, toast } from "@/components/ui";
import { RingChart } from "@/components/charts";

const n = (s: string) => (s.trim() === "" ? NaN : Number(s));

/** Symbol + contract + conversion inputs shared by calculators. */
function useInstrument(accountCurrency: string) {
  const [symbol, setSymbol] = useState("EURUSD");
  const spec = resolveInstrument(symbol || "X");
  const [contract, setContract] = useState(String(spec.contractSize));
  const [fxManual, setFxManual] = useState("");
  return {
    symbol, spec, contract, fxManual, setContract, setFxManual,
    setSymbol: (s: string) => { setSymbol(s.toUpperCase()); const sp = resolveInstrument(s || "X"); setContract(String(sp.contractSize)); setFxManual(""); },
    fx: (px: number) => (fxManual ? n(fxManual) : deriveFxRate(spec, accountCurrency, px > 0 ? px : null)),
  };
}

function InstrumentFields({ ins, accountCurrency, idp }: { ins: ReturnType<typeof useInstrument>; accountCurrency: string; idp: string }) {
  const derivable = deriveFxRate(ins.spec, accountCurrency, 1) !== null;
  return (
    <>
      <Field label="Symbol" htmlFor={`${idp}-sym`} hint={`${ASSET_CLASS_LABEL[ins.spec.assetClass]} · quote ${ins.spec.quote}`}>
        <Input id={`${idp}-sym`} list="risk-symbols" value={ins.symbol} onChange={(e) => ins.setSymbol(e.target.value)} />
      </Field>
      <Field label="Contract size" htmlFor={`${idp}-cs`} hint={ins.spec.unit === "contracts" ? "Point value (tick value ÷ tick size)" : `Units per 1 ${ins.spec.unit.replace(/s$/, "")}`}>
        <Input id={`${idp}-cs`} type="number" inputMode="decimal" step="any" value={ins.contract} onChange={(e) => ins.setContract(e.target.value)} />
      </Field>
      {(!derivable || ins.fxManual) && (
        <Field label={`${accountCurrency} per 1 ${ins.spec.quote}`} htmlFor={`${idp}-fx`} hint="Conversion rate. Limus doesn't fetch FX rates.">
          <Input id={`${idp}-fx`} type="number" inputMode="decimal" step="any" value={ins.fxManual} onChange={(e) => ins.setFxManual(e.target.value)} placeholder="e.g. 1.08" />
        </Field>
      )}
    </>
  );
}

function Result({ items }: { items: { label: string; value: ReactNode; strong?: boolean }[] }) {
  return (
    <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-subtle p-4 text-[13px] shadow-[0_0_0_1px_var(--line)]">
      {items.map((i) => (
        <div key={i.label} className={i.strong ? "col-span-2" : undefined}>
          <dt className="text-[12px] text-muted">{i.label}</dt>
          <dd className={cx("tnum mt-0.5", i.strong ? "text-[22px] font-medium tracking-[-0.03em]" : "font-medium")}>{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DirectionPicker({ value, onChange }: { value: Direction; onChange: (d: Direction) => void }) {
  return <Segmented size="md" ariaLabel="Direction" value={value} onChange={onChange} className="w-full [&>button]:flex-1" options={[{ value: "long", label: "Buy / Long" }, { value: "short", label: "Sell / Short" }]} />;
}

export function RiskPage() {
  const data = useData();
  const { scopedAccounts, summaries, profile, updateProfile, scopedTrades, tz } = data;
  const [accountId, setAccountId] = useState(scopedAccounts[0]?.id ?? "");
  const account = scopedAccounts.find((a) => a.id === accountId) ?? scopedAccounts[0];
  const cur = account?.currency ?? profile?.base_currency ?? "USD";
  const balanceDefault = account ? summaries.get(account.id)?.balance ?? account.initial_balance : 10000;

  return (
    <>
      <PageHeader title="Risk Management" icon={<ShieldCheck />} description="Size positions correctly and keep an eye on your limits." />
      <datalist id="risk-symbols">{INSTRUMENTS.map((i) => <option key={i.symbol} value={i.symbol}>{i.name}</option>)}</datalist>

      {scopedAccounts.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2 text-[13px] text-muted">
          Calculate for
          <Select aria-label="Account for calculators" value={account?.id ?? ""} onChange={(e) => setAccountId(e.target.value)} className="w-auto min-w-56">
            {scopedAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} · {money(summaries.get(a.id)?.balance, a.currency)}</option>)}
          </Select>
        </div>
      )}

      <div className="mb-8 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <PositionSizeCalc key={`ps-${account?.id}`} currency={cur} balance={balanceDefault} defaultRisk={profile?.default_risk_pct ?? 1} />
        <RiskPercentCalc key={`rp-${account?.id}`} currency={cur} balance={balanceDefault} />
        <RewardRiskCalc />
        <StopLossCalc key={`sl-${account?.id}`} currency={cur} balance={balanceDefault} defaultRisk={profile?.default_risk_pct ?? 1} />
        <TakeProfitCalc />
      </div>

      <h2 className="mb-3 text-[17px] font-medium tracking-[-0.03em]">Account risk monitor</h2>
      <RiskMonitor />

      {profile && <RiskSettings key={profile.updated_at} profile={profile} onSave={async (p) => { await updateProfile(p); toast("Risk preferences saved"); }} />}
      <p className="mt-6 text-[12px] text-faint">Today is {dayKey(new Date(), tz)} in {tz}. {scopedTrades.filter((t) => t.status === "open").length} open position(s) in view.</p>
    </>
  );
}

function PositionSizeCalc({ currency, balance, defaultRisk }: { currency: string; balance: number; defaultRisk: number }) {
  const ins = useInstrument(currency);
  const [bal, setBal] = useState(String(Math.round(balance * 100) / 100));
  const [risk, setRisk] = useState(String(defaultRisk));
  const [dir, setDir] = useState<Direction>("long");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const fx = ins.fx(n(entry));
  const res = fx ? positionSize({ balance: n(bal), riskPct: n(risk), entry: n(entry), stop: n(stop), contractSize: n(ins.contract), fxRate: fx, qtyStep: ins.spec.qtyStep }) : null;
  const wrongSide = n(entry) > 0 && n(stop) > 0 && (dir === "long" ? n(stop) >= n(entry) : n(stop) <= n(entry));
  return (
    <Card className="p-5">
      <h3 className="text-[15px] font-medium tracking-[-0.02em]">Position size</h3>
      <p className="mt-0.5 text-[12.5px] text-muted">How big to trade so a stop-out costs exactly your risk.</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label="Account balance" htmlFor="ps-bal" className="col-span-2"><Input id="ps-bal" type="number" inputMode="decimal" value={bal} onChange={(e) => setBal(e.target.value)} suffix={currency} /></Field>
        <Field label="Risk per trade" htmlFor="ps-risk"><Input id="ps-risk" type="number" inputMode="decimal" step="0.05" value={risk} onChange={(e) => setRisk(e.target.value)} suffix="%" /></Field>
        <InstrumentFields ins={ins} accountCurrency={currency} idp="ps" />
        <div className="col-span-2"><DirectionPicker value={dir} onChange={setDir} /></div>
        <Field label="Entry price" htmlFor="ps-entry"><Input id="ps-entry" type="number" inputMode="decimal" step="any" value={entry} onChange={(e) => setEntry(e.target.value)} /></Field>
        <Field label="Stop loss" htmlFor="ps-stop" error={wrongSide ? `Stop should be ${dir === "long" ? "below" : "above"} entry` : null}><Input id="ps-stop" type="number" inputMode="decimal" step="any" value={stop} onChange={(e) => setStop(e.target.value)} /></Field>
      </div>
      {res && !wrongSide ? (
        <Result items={[
          { label: `Position size (${ins.spec.unit})`, value: num(res.quantity, 6), strong: true },
          { label: "Risk budget", value: money(res.riskAmount, currency) },
          { label: "Actual risk (rounded)", value: `${money(res.actualRisk, currency)} · ${pct(res.actualRiskPct, 2)}` },
          { label: "Stop distance", value: price(res.stopDistance) + (ins.spec.pipSize ? ` (${fixed(res.stopDistance / ins.spec.pipSize, 1)} pips)` : "") },
          { label: "Position value", value: money(res.positionValue, currency) },
          ...(ins.spec.pipSize && fx ? [{ label: "Pip value", value: money(pipValue(ins.spec.pipSize, res.quantity, n(ins.contract), fx), currency) }] : []),
        ]} />
      ) : <p className="mt-4 rounded-lg bg-subtle p-4 text-[13px] text-muted">{!fx ? `Enter the ${ins.spec.quote}→${currency} rate to calculate.` : "Enter balance, risk, entry and stop."}</p>}
    </Card>
  );
}

function RiskPercentCalc({ currency, balance }: { currency: string; balance: number }) {
  const ins = useInstrument(currency);
  const [bal, setBal] = useState(String(Math.round(balance * 100) / 100));
  const [qty, setQty] = useState("");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const fx = ins.fx(n(entry));
  const res = fx && n(qty) > 0 && n(entry) > 0 && n(stop) > 0 ? riskPercent(n(bal), n(qty), n(entry), n(stop), n(ins.contract), fx) : null;
  return (
    <Card className="p-5">
      <h3 className="text-[15px] font-medium tracking-[-0.02em]">Risk percentage</h3>
      <p className="mt-0.5 text-[12.5px] text-muted">How much of your account a position puts at risk.</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label="Account balance" htmlFor="rp-bal" className="col-span-2"><Input id="rp-bal" type="number" inputMode="decimal" value={bal} onChange={(e) => setBal(e.target.value)} suffix={currency} /></Field>
        <InstrumentFields ins={ins} accountCurrency={currency} idp="rp" />
        <Field label={`Quantity (${ins.spec.unit})`} htmlFor="rp-qty"><Input id="rp-qty" type="number" inputMode="decimal" step="any" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
        <Field label="Entry price" htmlFor="rp-entry"><Input id="rp-entry" type="number" inputMode="decimal" step="any" value={entry} onChange={(e) => setEntry(e.target.value)} /></Field>
        <Field label="Stop loss" htmlFor="rp-stop"><Input id="rp-stop" type="number" inputMode="decimal" step="any" value={stop} onChange={(e) => setStop(e.target.value)} /></Field>
      </div>
      {res ? <Result items={[{ label: "Risk of account", value: pct(res.pct, 2), strong: true }, { label: "Money at risk", value: money(res.amount, currency) }]} />
        : <p className="mt-4 rounded-lg bg-subtle p-4 text-[13px] text-muted">Enter the position to see its risk.</p>}
    </Card>
  );
}

function RewardRiskCalc() {
  const [dir, setDir] = useState<Direction>("long");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const res = n(entry) > 0 && n(stop) > 0 && n(target) > 0 ? rewardToRisk(dir, n(entry), n(stop), n(target)) : null;
  const filled = n(entry) > 0 && n(stop) > 0 && n(target) > 0;
  return (
    <Card className="p-5">
      <h3 className="text-[15px] font-medium tracking-[-0.02em]">Risk-to-reward</h3>
      <p className="mt-0.5 text-[12.5px] text-muted">Reward versus risk, and the win rate needed to break even.</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="col-span-2"><DirectionPicker value={dir} onChange={setDir} /></div>
        <Field label="Entry" htmlFor="rr-entry" className="col-span-2"><Input id="rr-entry" type="number" inputMode="decimal" step="any" value={entry} onChange={(e) => setEntry(e.target.value)} /></Field>
        <Field label="Stop loss" htmlFor="rr-stop"><Input id="rr-stop" type="number" inputMode="decimal" step="any" value={stop} onChange={(e) => setStop(e.target.value)} /></Field>
        <Field label="Take profit" htmlFor="rr-target"><Input id="rr-target" type="number" inputMode="decimal" step="any" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
      </div>
      {res ? <Result items={[{ label: "Reward : risk", value: `1 : ${res.ratio.toFixed(2)}`, strong: true }, { label: "Risk per unit", value: price(res.risk) }, { label: "Reward per unit", value: price(res.reward) }, { label: "Break-even win rate", value: pct(res.breakevenWinRate, 1) }]} />
        : <p className="mt-4 rounded-lg bg-subtle p-4 text-[13px] text-muted">{filled ? `For a ${dir === "long" ? "buy" : "sell"}, the stop must be ${dir === "long" ? "below" : "above"} entry and the target ${dir === "long" ? "above" : "below"} it.` : "Enter entry, stop and target."}</p>}
    </Card>
  );
}

function StopLossCalc({ currency, balance, defaultRisk }: { currency: string; balance: number; defaultRisk: number }) {
  const ins = useInstrument(currency);
  const [dir, setDir] = useState<Direction>("long");
  const [entry, setEntry] = useState("");
  const [qty, setQty] = useState("");
  const [mode, setMode] = useState<"pct" | "amount">("pct");
  const [risk, setRisk] = useState(String(defaultRisk));
  const fx = ins.fx(n(entry));
  const amount = mode === "pct" ? (balance * n(risk)) / 100 : n(risk);
  const res = fx && n(entry) > 0 && n(qty) > 0 && amount > 0 ? stopFromRisk(dir, n(entry), amount, n(qty), n(ins.contract), fx) : null;
  return (
    <Card className="p-5">
      <h3 className="text-[15px] font-medium tracking-[-0.02em]">Stop-loss price</h3>
      <p className="mt-0.5 text-[12.5px] text-muted">Where to place the stop for a fixed size and risk.</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <InstrumentFields ins={ins} accountCurrency={currency} idp="sl" />
        <div className="col-span-2"><DirectionPicker value={dir} onChange={setDir} /></div>
        <Field label="Entry price" htmlFor="sl-entry"><Input id="sl-entry" type="number" inputMode="decimal" step="any" value={entry} onChange={(e) => setEntry(e.target.value)} /></Field>
        <Field label={`Quantity (${ins.spec.unit})`} htmlFor="sl-qty"><Input id="sl-qty" type="number" inputMode="decimal" step="any" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
        <Field label="Risk" htmlFor="sl-risk" className="col-span-2" hint={mode === "pct" ? `Of ${money(balance, currency)}` : undefined}>
          <div className="flex gap-2"><Input id="sl-risk" type="number" inputMode="decimal" step="any" value={risk} onChange={(e) => setRisk(e.target.value)} /><Segmented size="md" ariaLabel="Risk unit" value={mode} onChange={setMode} options={[{ value: "pct", label: "%" }, { value: "amount", label: currency }]} /></div>
        </Field>
      </div>
      {res ? <Result items={[{ label: "Stop-loss price", value: price(Number(res.stop.toPrecision(10))), strong: true }, { label: "Distance", value: price(Number(res.distance.toPrecision(8))) + (ins.spec.pipSize ? ` (${fixed(res.distance / ins.spec.pipSize, 1)} pips)` : "") }, { label: "Risk", value: money(amount, currency) }]} />
        : <p className="mt-4 rounded-lg bg-subtle p-4 text-[13px] text-muted">Enter entry, size and risk.</p>}
    </Card>
  );
}

function TakeProfitCalc() {
  const [dir, setDir] = useState<Direction>("long");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [rr, setRr] = useState("2");
  const valid = n(entry) > 0 && n(stop) > 0 && (dir === "long" ? n(stop) < n(entry) : n(stop) > n(entry));
  const res = valid && n(rr) > 0 ? targetFromRR(dir, n(entry), n(stop), n(rr)) : null;
  return (
    <Card className="p-5">
      <h3 className="text-[15px] font-medium tracking-[-0.02em]">Take-profit price</h3>
      <p className="mt-0.5 text-[12.5px] text-muted">Target for a chosen reward multiple of your stop.</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="col-span-2"><DirectionPicker value={dir} onChange={setDir} /></div>
        <Field label="Entry" htmlFor="tp-entry"><Input id="tp-entry" type="number" inputMode="decimal" step="any" value={entry} onChange={(e) => setEntry(e.target.value)} /></Field>
        <Field label="Stop loss" htmlFor="tp-stop"><Input id="tp-stop" type="number" inputMode="decimal" step="any" value={stop} onChange={(e) => setStop(e.target.value)} /></Field>
        <Field label="Reward multiple (R)" htmlFor="tp-rr" className="col-span-2"><Input id="tp-rr" type="number" inputMode="decimal" step="0.25" value={rr} onChange={(e) => setRr(e.target.value)} suffix="R" /></Field>
      </div>
      {res ? <Result items={[{ label: "Take-profit price", value: price(Number(res.target.toPrecision(10))), strong: true }, ...[1, 2, 3].map((k) => ({ label: `${k}R target`, value: price(Number(targetFromRR(dir, n(entry), n(stop), k)!.target.toPrecision(10))) }))]} />
        : <p className="mt-4 rounded-lg bg-subtle p-4 text-[13px] text-muted">{n(entry) > 0 && n(stop) > 0 ? `For a ${dir === "long" ? "buy" : "sell"}, the stop must be ${dir === "long" ? "below" : "above"} entry.` : "Enter entry and stop."}</p>}
    </Card>
  );
}

function Meter({ label, used, text, warnAt = 70 }: { label: string; used: number | null; text: ReactNode; warnAt?: number }) {
  const v = used === null ? 0 : Math.max(0, Math.min(100, used));
  return (
    <div>
      <div className="flex justify-between text-[13px]"><span className="text-ink-3">{label}</span><span className="tnum text-muted">{used === null ? "No limit set" : `${v.toFixed(0)}% used`}</span></div>
      <div className="mt-2 h-2 rounded-full bg-muted-bg" role="progressbar" aria-label={label} aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
        {used !== null && <div className={cx("h-full rounded-full transition-all", v >= 100 ? "bg-loss" : v >= warnAt ? "bg-warn" : "bg-profit")} style={{ width: `${Math.max(v, 1.5)}%` }} />}
      </div>
      <p className="tnum mt-1.5 text-[12px] text-muted">{text}</p>
    </div>
  );
}

function RiskMonitor() {
  const { scopedAccounts, summaries, trades, cash, tz, profile } = useData();
  const today = dayKey(new Date(), tz);
  const dayStart = startOfDayInTz(today, tz).toISOString();

  if (!scopedAccounts.length) return <Card className="p-5 text-[13px] text-muted">No accounts in view.</Card>;
  return (
    <div className="space-y-4">
      {scopedAccounts.map((a) => {
        const s = summaries.get(a.id)!;
        const mine = trades.filter((t) => t.account_id === a.id);
        const closed = mine.filter((t) => t.status === "closed" && t.exit_at);
        const startBal = a.initial_balance + closed.filter((t) => t.exit_at! < dayStart).reduce((x, t) => x + (t.net_pnl ?? 0), 0)
          + cash.filter((c) => c.account_id === a.id && c.occurred_at < dayStart).reduce((x, c) => x + (c.type === "deposit" ? c.amount : -c.amount), 0);
        const todayPnl = closed.filter((t) => dayKey(t.exit_at!, tz) === today).reduce((x, t) => x + (t.net_pnl ?? 0), 0);
        const dlPct = a.daily_loss_limit_pct ?? profile?.daily_loss_limit_pct ?? null;
        const dl = dlPct ? dailyLossStatus(startBal, dlPct, todayPnl) : null;
        const ddLimit = a.max_drawdown_pct ?? profile?.max_drawdown_limit_pct ?? null;
        const open = mine.filter((t) => t.status === "open");
        const exposure = open.reduce((x, t) => x + calcTrade({ direction: t.direction, status: "open", entryPrice: t.mark_price ?? t.entry_price, quantity: t.quantity, contractSize: t.contract_size, fxRate: t.fx_rate }).positionValue, 0);
        const openRiskPct = s.balance > 0 ? (s.openRisk / s.balance) * 100 : null;
        const maxOpen = profile?.max_open_risk_pct ?? null;
        const recentRisk = closed.filter((t) => t.risk_pct !== null).sort((x, y) => y.exit_at!.localeCompare(x.exit_at!)).slice(0, 20);
        const avgRisk = recentRisk.length ? recentRisk.reduce((x, t) => x + (t.risk_pct ?? 0), 0) / recentRisk.length : null;
        const overRisk = recentRisk.filter((t) => profile && (t.risk_pct ?? 0) > profile.default_risk_pct * 1.5).length;
        const alloc = new Map<AssetClass, number>();
        for (const t of open) alloc.set(t.asset_class, (alloc.get(t.asset_class) ?? 0) + (t.risk_amount ?? 0));

        return (
          <Card key={a.id}>
            <CardHeader title={<span className="flex items-center gap-2">{a.name}{a.is_demo && <Badge tone="warn">Demo</Badge>}</span>} subtitle={`Balance ${money(s.balance, a.currency)} · equity ${money(s.equity, a.currency)}`}
              action={dl?.breached ? <Badge tone="loss">Daily limit reached</Badge> : undefined} />
            <div className="grid gap-6 p-5 md:grid-cols-2 xl:grid-cols-4">
              <Meter label={`Daily loss limit${dlPct ? ` (${dlPct}%)` : ""}`} used={dl ? dl.usedPct : null}
                text={dl ? <>Today {money(todayPnl, a.currency, { sign: true })} · {money(dl.remaining, a.currency)} left of {money(dl.limitAmount, a.currency)}</> : <>Today {money(todayPnl, a.currency, { sign: true })}. Set a limit below or on the account.</>} />
              <Meter label={`Max drawdown${ddLimit ? ` (${ddLimit}%)` : ""}`} used={ddLimit ? (s.drawdown.currentDrawdownPct / ddLimit) * 100 : null}
                text={<>Current {pct(s.drawdown.currentDrawdownPct, 2)} · worst {pct(s.drawdown.maxDrawdownPct, 2)} ({money(s.drawdown.maxDrawdown, a.currency)})</>} />
              <Meter label={`Open risk${maxOpen ? ` (max ${maxOpen}%)` : ""}`} used={maxOpen && openRiskPct !== null ? (openRiskPct / maxOpen) * 100 : null}
                text={<>{open.length} open · {money(s.openRisk, a.currency)} at risk ({pct(openRiskPct, 2)}) · exposure {money(exposure, a.currency, { compact: true })}{s.equity > 0 ? ` (${(exposure / s.equity).toFixed(2)}× equity)` : ""}</>} />
              <div>
                <p className="text-[13px] text-ink-3">Risk per trade (last {recentRisk.length})</p>
                <p className="tnum mt-1 text-[22px] font-medium tracking-[-0.03em]">{pct(avgRisk, 2)}</p>
                <p className="text-[12px] text-muted">{profile ? `Target ${profile.default_risk_pct}%` : ""}{overRisk ? <span className="text-warn"> · {overRisk} trade{overRisk === 1 ? "" : "s"} above 1.5× target</span> : ""}</p>
              </div>
            </div>
            {open.length > 0 && (
              <div className="border-t border-line p-5">
                <p className="mb-3 text-[13px] font-medium text-ink-3">Risk allocation of open positions</p>
                {[...alloc.values()].some((v) => v > 0) ? (
                  <RingChart items={[...alloc.entries()].map(([k, v]) => ({ label: ASSET_CLASS_LABEL[k], value: v, display: money(v, a.currency, { compact: true }) }))} centerValue={money(s.openRisk, a.currency, { compact: true })} centerLabel="At risk" size={140} />
                ) : <p className="text-[12.5px] text-muted">Open positions have no stop loss, so their risk can&apos;t be measured.</p>}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function RiskSettings({ profile, onSave }: { profile: NonNullable<ReturnType<typeof useData>["profile"]>; onSave: (p: { default_risk_pct: number; daily_loss_limit_pct: number | null; max_drawdown_limit_pct: number | null; max_open_risk_pct: number | null }) => Promise<void> }) {
  const [risk, setRisk] = useState(String(profile.default_risk_pct));
  const [daily, setDaily] = useState(profile.daily_loss_limit_pct?.toString() ?? "");
  const [dd, setDd] = useState(profile.max_drawdown_limit_pct?.toString() ?? "");
  const [open, setOpen] = useState(profile.max_open_risk_pct?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const opt = (s: string) => (s.trim() ? Number(s) : null);
  const ok = (s: string, req = false) => (s.trim() === "" ? !req : Number(s) > 0 && Number(s) <= 100);
  const valid = ok(risk, true) && ok(daily) && ok(dd) && ok(open);
  const changed = useMemo(() => risk !== String(profile.default_risk_pct) || daily !== (profile.daily_loss_limit_pct?.toString() ?? "") || dd !== (profile.max_drawdown_limit_pct?.toString() ?? "") || open !== (profile.max_open_risk_pct?.toString() ?? ""), [risk, daily, dd, open, profile]);
  return (
    <Card className="mt-6">
      <CardHeader title="Risk preferences" subtitle="Defaults for every account. Account-level limits override them." />
      <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Default risk per trade" htmlFor="rs-risk" error={ok(risk, true) ? null : "0–100%"}><Input id="rs-risk" type="number" step="0.05" value={risk} onChange={(e) => setRisk(e.target.value)} suffix="%" /></Field>
        <Field label="Daily loss limit" htmlFor="rs-daily" optional error={ok(daily) ? null : "0–100%"}><Input id="rs-daily" type="number" step="0.1" value={daily} onChange={(e) => setDaily(e.target.value)} suffix="%" /></Field>
        <Field label="Max drawdown" htmlFor="rs-dd" optional error={ok(dd) ? null : "0–100%"}><Input id="rs-dd" type="number" step="0.5" value={dd} onChange={(e) => setDd(e.target.value)} suffix="%" /></Field>
        <Field label="Max open risk" htmlFor="rs-open" optional error={ok(open) ? null : "0–100%"}><Input id="rs-open" type="number" step="0.5" value={open} onChange={(e) => setOpen(e.target.value)} suffix="%" /></Field>
      </div>
      <div className="flex justify-end border-t border-line px-5 py-3">
        <Button variant="primary" disabled={!valid || !changed} loading={saving} onClick={async () => { setSaving(true); try { await onSave({ default_risk_pct: Number(risk), daily_loss_limit_pct: opt(daily), max_drawdown_limit_pct: opt(dd), max_open_risk_pct: opt(open) }); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "error"); } finally { setSaving(false); } }}>Save preferences</Button>
      </div>
      <Notice className="mx-5 mb-5">Daily P&amp;L uses closed trades in your timezone. Limus has no live prices, so open-position exposure uses the mark price you enter on each trade.</Notice>
    </Card>
  );
}
