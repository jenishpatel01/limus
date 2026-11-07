"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, FlaskConical, Gauge } from "lucide-react";
import { useData } from "@/lib/data/store";
import { Logo } from "@/components/brand/Logo";
import { Button, ChipGroup, Field, Input, Notice, Select, Skeleton, cx, toast } from "@/components/ui";
import { ASSET_CLASSES, ASSET_CLASS_LABEL, CURRENCIES, type AssetClass } from "@/lib/engine/instruments";
import { ACCOUNT_TYPE_LABEL, type AccountType } from "@/lib/types";
import { browserTimezone } from "@/lib/dates";
import { createDemoData } from "@/lib/demo/actions";

const STEPS = ["Profile", "First account", "Markets & risk", "Get started"] as const;

function timezones(): string[] {
  try {
    const list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone");
    if (list?.length) return list;
  } catch { /* ignore */ }
  return ["UTC", "Europe/London", "America/New_York", "Asia/Kolkata", "Asia/Singapore", "Australia/Sydney"];
}

export function Onboarding() {
  const { ready } = useData();
  if (!ready) return <div className="flex min-h-dvh items-center justify-center"><Skeleton className="h-80 w-full max-w-lg" /></div>;
  return <OnboardingFlow />;
}

function OnboardingFlow() {
  const router = useRouter();
  const { user, profile, accounts, strategies, updateProfile, saveAccount, reload, setScope, tz } = useData();
  const [alreadyDone] = useState(() => Boolean(profile?.onboarded_at));
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(profile?.display_name ?? "");
  const [timezone, setTimezone] = useState(profile?.timezone && profile.timezone !== "UTC" ? profile.timezone : browserTimezone());
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [acc, setAcc] = useState({ name: "Main account", broker: "", type: "personal" as AccountType, currency: "USD", balance: "10000" });
  const [classes, setClasses] = useState<AssetClass[]>(["forex"]);
  const [risk, setRisk] = useState("1");
  const [dailyLimit, setDailyLimit] = useState("3");

  useEffect(() => {
    if (alreadyDone) router.replace("/app");
  }, [alreadyDone, router]);

  const realAccount = accounts.find((a) => !a.is_demo);
  const balanceNum = Number(acc.balance);
  const riskNum = Number(risk);
  const limitNum = Number(dailyLimit);

  const stepValid = [
    true,
    Boolean(realAccount) || (acc.name.trim().length > 0 && Number.isFinite(balanceNum) && balanceNum >= 0),
    classes.length > 0 && riskNum > 0 && riskNum <= 100 && (!dailyLimit || (limitNum > 0 && limitNum <= 100)),
    true,
  ][step];

  async function next() {
    setError(null);
    try {
      if (step === 0) {
        setBusy("next");
        await updateProfile({ display_name: name.trim() || null, timezone, base_currency: baseCurrency });
        setAcc((a) => ({ ...a, currency: baseCurrency }));
      }
      if (step === 1 && !realAccount) {
        setBusy("next");
        await saveAccount({ name: acc.name.trim(), broker: acc.broker.trim() || null, account_type: acc.type, currency: acc.currency, initial_balance: Math.round(balanceNum * 100) / 100 });
      }
      if (step === 2) {
        setBusy("next");
        await updateProfile({ asset_classes: classes, default_risk_pct: riskNum, daily_loss_limit_pct: dailyLimit ? limitNum : null });
      }
      setStep((s) => s + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function finish(dest: "trade" | "demo" | "dashboard") {
    setError(null);
    setBusy(dest);
    try {
      if (dest === "demo") {
        await createDemoData(user.id, tz, strategies);
      }
      await updateProfile({ onboarded_at: new Date().toISOString() });
      if (dest === "demo") {
        await reload();
        setScope({ kind: "demo" });
        toast("Demo account created with sample trades");
      } else {
        setScope({ kind: "real" });
      }
      router.replace(dest === "trade" ? "/app/journal/new" : "/app");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(null);
    }
  }


  return (
    <div className="min-h-dvh bg-subtle">
      <header className="flex items-center justify-between px-5 py-5 sm:px-10"><Logo href={null} /><span className="text-[13px] text-muted">Step {step + 1} of {STEPS.length}</span></header>
      <main className="mx-auto max-w-xl px-5 pb-16">
        <ol className="mb-8 flex gap-2" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1">
              <div className={cx("h-1 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-line-strong")} />
              <p className={cx("mt-2 hidden text-[12px] sm:block", i === step ? "text-ink" : "text-muted")}>{s}</p>
            </li>
          ))}
        </ol>

        <div className="rounded-xl bg-surface p-6 shadow-[0_0_0_1px_var(--line),var(--shadow-card)] sm:p-8 animate-rise" key={step}>
          {error && <Notice tone="loss" className="mb-5">{error}</Notice>}

          {step === 0 && (
            <>
              <h1 className="text-[26px] font-medium tracking-[-0.04em]">Welcome to Limus</h1>
              <p className="mt-2 text-[14px] text-muted">A few details so dates and totals show up the way you expect.</p>
              <div className="mt-7 grid gap-4">
                <Field label="Your name" htmlFor="ob-name" optional><Input id="ob-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Alex Morgan" /></Field>
                <Field label="Timezone" htmlFor="ob-tz" hint="Daily P&L and the calendar use this timezone.">
                  <Select id="ob-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)}>{timezones().map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}</Select>
                </Field>
                <Field label="Base currency" htmlFor="ob-cur" hint="Combined portfolio totals are shown in this currency.">
                  <Select id="ob-cur" value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select>
                </Field>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="text-[26px] font-medium tracking-[-0.04em]">Create your first trading account</h1>
              <p className="mt-2 text-[14px] text-muted">Each account keeps its own balance, trades, deposits and withdrawals. You can add more later.</p>
              {realAccount ? (
                <Notice className="mt-6">You already created <strong className="font-medium text-ink">{realAccount.name}</strong>. Continue to the next step.</Notice>
              ) : (
                <div className="mt-7 grid gap-4 sm:grid-cols-2">
                  <Field label="Account name" htmlFor="ob-an" className="sm:col-span-2"><Input id="ob-an" value={acc.name} maxLength={80} onChange={(e) => setAcc({ ...acc, name: e.target.value })} /></Field>
                  <Field label="Broker / exchange" htmlFor="ob-br" optional><Input id="ob-br" value={acc.broker} maxLength={80} onChange={(e) => setAcc({ ...acc, broker: e.target.value })} placeholder="e.g. IC Markets" /></Field>
                  <Field label="Account type" htmlFor="ob-at">
                    <Select id="ob-at" value={acc.type} onChange={(e) => setAcc({ ...acc, type: e.target.value as AccountType })}>{Object.entries(ACCOUNT_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
                  </Field>
                  <Field label="Currency" htmlFor="ob-ac"><Select id="ob-ac" value={acc.currency} onChange={(e) => setAcc({ ...acc, currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
                  <Field label="Initial capital" htmlFor="ob-ib" error={!(balanceNum >= 0) ? "Enter a valid amount" : null}>
                    <Input id="ob-ib" type="number" inputMode="decimal" min={0} step="0.01" value={acc.balance} onChange={(e) => setAcc({ ...acc, balance: e.target.value })} suffix={acc.currency} />
                  </Field>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-[26px] font-medium tracking-[-0.04em]">Markets &amp; risk preferences</h1>
              <p className="mt-2 text-[14px] text-muted">These become defaults in the trade form and risk calculators.</p>
              <div className="mt-7 grid gap-5">
                <Field label="What do you trade?">
                  <ChipGroup options={ASSET_CLASSES.map((c) => ({ value: c, label: ASSET_CLASS_LABEL[c] }))} value={classes} onChange={setClasses} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Default risk per trade" htmlFor="ob-risk" error={!(riskNum > 0 && riskNum <= 100) ? "Between 0 and 100%" : null}>
                    <Input id="ob-risk" type="number" inputMode="decimal" step="0.05" min={0.01} max={100} value={risk} onChange={(e) => setRisk(e.target.value)} suffix="%" />
                  </Field>
                  <Field label="Daily loss limit" htmlFor="ob-dll" optional hint="You'll get an alert when it's reached.">
                    <Input id="ob-dll" type="number" inputMode="decimal" step="0.5" min={0.1} max={100} value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} suffix="%" />
                  </Field>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="text-[26px] font-medium tracking-[-0.04em]">You&apos;re all set</h1>
              <p className="mt-2 text-[14px] text-muted">How would you like to start?</p>
              <div className="mt-6 grid gap-3">
                <Choice icon={<BookOpen />} title="Add your first trade" text="Log a trade with prices, risk and journal notes." onClick={() => finish("trade")} loading={busy === "trade"} disabled={!!busy} primary />
                <Choice icon={<FlaskConical />} title="Explore the demo account" text="Load a separate, clearly labelled account with ~150 sample trades. Remove it any time in Settings." onClick={() => finish("demo")} loading={busy === "demo"} disabled={!!busy} />
                <Choice icon={<Gauge />} title="Go to the dashboard" text="Start from an empty dashboard. You can import a CSV later." onClick={() => finish("dashboard")} loading={busy === "dashboard"} disabled={!!busy} />
              </div>
            </>
          )}

          {step < 3 && (
            <div className="mt-8 flex items-center justify-between">
              <Button variant="ghost" icon={<ArrowLeft className="size-4" />} disabled={step === 0 || !!busy} onClick={() => setStep((s) => s - 1)}>Back</Button>
              <Button variant="primary" onClick={next} loading={busy === "next"} disabled={!stepValid}>Continue<ArrowRight className="size-4" /></Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Choice({ icon, title, text, onClick, loading, disabled, primary }: { icon: React.ReactNode; title: string; text: string; onClick: () => void; loading?: boolean; disabled?: boolean; primary?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={cx("group flex items-start gap-4 rounded-lg p-4 text-left transition-all disabled:opacity-60",
        primary ? "bg-primary-soft/50 shadow-[0_0_0_1px_var(--primary)]" : "shadow-[0_0_0_1px_var(--line-strong)] hover:bg-subtle")}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface text-ink-3 shadow-[0_0_0_1px_var(--line)] [&_svg]:size-4">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-medium text-ink">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-relaxed text-muted">{text}</span>
      </span>
      {loading ? <span className="mt-2 size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <Check className="mt-2 size-4 text-transparent group-hover:text-muted" />}
    </button>
  );
}
