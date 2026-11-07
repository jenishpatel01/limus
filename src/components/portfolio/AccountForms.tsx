"use client";

import { useState } from "react";
import { useData } from "@/lib/data/store";
import type { AccountStatus, AccountType, CashType, TradingAccount } from "@/lib/types";
import { ACCOUNT_STATUS_LABEL, ACCOUNT_TYPE_LABEL } from "@/lib/types";
import { CURRENCIES } from "@/lib/engine/instruments";
import { utcToWall, wallToUtc } from "@/lib/dates";
import { Button, Field, Input, Modal, Notice, Segmented, Select, Textarea, toast } from "@/components/ui";

const optNum = (s: string) => (s.trim() === "" ? null : Number(s));

export function AccountModal({ open, onClose, account, onSaved }: { open: boolean; onClose: () => void; account?: TradingAccount | null; onSaved?: (a: TradingAccount) => void }) {
  const { saveAccount, trades, profile } = useData();
  const hasTrades = account ? trades.some((t) => t.account_id === account.id) : false;
  const [f, setF] = useState({
    name: account?.name ?? "",
    broker: account?.broker ?? "",
    type: (account?.account_type ?? "personal") as AccountType,
    currency: account?.currency ?? profile?.base_currency ?? "USD",
    balance: account ? String(account.initial_balance) : "",
    status: (account?.status ?? "active") as AccountStatus,
    daily: account?.daily_loss_limit_pct != null ? String(account.daily_loss_limit_pct) : "",
    dd: account?.max_drawdown_pct != null ? String(account.max_drawdown_pct) : "",
    target: account?.profit_target_pct != null ? String(account.profit_target_pct) : "",
    notes: account?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const bal = Number(f.balance);
  const pctOk = (s: string, max = 100) => s.trim() === "" || (Number(s) > 0 && Number(s) <= max);
  const errors = {
    name: !f.name.trim() ? "Enter a name" : null,
    balance: f.balance.trim() === "" || !(bal >= 0) ? "Enter the starting balance (0 or more)" : null,
    daily: pctOk(f.daily) ? null : "Between 0 and 100",
    dd: pctOk(f.dd) ? null : "Between 0 and 100",
    target: pctOk(f.target, 1000) ? null : "Between 0 and 1000",
  };
  const invalid = Object.values(errors).some(Boolean);

  async function save() {
    setTouched(true);
    if (invalid) return;
    setSaving(true);
    try {
      const a = await saveAccount({
        name: f.name.trim(), broker: f.broker.trim() || null, account_type: f.type, currency: f.currency, initial_balance: Math.round(bal * 100) / 100,
        status: f.status, daily_loss_limit_pct: optNum(f.daily), max_drawdown_pct: optNum(f.dd), profit_target_pct: optNum(f.target), notes: f.notes.trim() || null,
      }, account?.id);
      toast(account ? "Account updated" : "Account created");
      onSaved?.(a);
      onClose();
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "error"); } finally { setSaving(false); }
  }

  const e = (k: keyof typeof errors) => (touched ? errors[k] : null);
  return (
    <Modal open={open} onClose={onClose} title={account ? "Edit account" : "New trading account"} description="Balances, trades and cash movements are tracked separately for each account."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={saving} onClick={save}>{account ? "Save changes" : "Create account"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Account name" htmlFor="a-name" error={e("name")} className="sm:col-span-2"><Input id="a-name" maxLength={80} value={f.name} onChange={(ev) => setF({ ...f, name: ev.target.value })} placeholder="e.g. FTMO 100k challenge" /></Field>
        <Field label="Broker / exchange" htmlFor="a-broker" optional><Input id="a-broker" maxLength={80} value={f.broker} onChange={(ev) => setF({ ...f, broker: ev.target.value })} /></Field>
        <Field label="Account type" htmlFor="a-type"><Select id="a-type" value={f.type} onChange={(ev) => setF({ ...f, type: ev.target.value as AccountType })}>{Object.entries(ACCOUNT_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
        <Field label="Currency" htmlFor="a-cur" hint={hasTrades ? "Can't change after trades are recorded." : undefined}>
          <Select id="a-cur" value={f.currency} disabled={hasTrades} onChange={(ev) => setF({ ...f, currency: ev.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select>
        </Field>
        <Field label="Initial balance" htmlFor="a-bal" error={e("balance")}><Input id="a-bal" type="number" inputMode="decimal" min={0} step="0.01" value={f.balance} onChange={(ev) => setF({ ...f, balance: ev.target.value })} suffix={f.currency} /></Field>
        <Field label="Status" htmlFor="a-status"><Select id="a-status" value={f.status} onChange={(ev) => setF({ ...f, status: ev.target.value as AccountStatus })}>{Object.entries(ACCOUNT_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
        <div className="sm:col-span-2"><p className="text-[13px] font-medium text-ink-3">Risk rules</p><p className="text-[12px] text-muted">Optional. Used for alerts and prop-firm progress.</p></div>
        <Field label="Daily loss limit" htmlFor="a-daily" error={e("daily")} optional><Input id="a-daily" type="number" inputMode="decimal" step="0.1" value={f.daily} onChange={(ev) => setF({ ...f, daily: ev.target.value })} suffix="%" /></Field>
        <Field label="Max drawdown" htmlFor="a-dd" error={e("dd")} optional><Input id="a-dd" type="number" inputMode="decimal" step="0.1" value={f.dd} onChange={(ev) => setF({ ...f, dd: ev.target.value })} suffix="%" /></Field>
        <Field label="Profit target" htmlFor="a-target" error={e("target")} optional><Input id="a-target" type="number" inputMode="decimal" step="0.1" value={f.target} onChange={(ev) => setF({ ...f, target: ev.target.value })} suffix="%" /></Field>
        <Field label="Notes" htmlFor="a-notes" optional className="sm:col-span-2"><Textarea id="a-notes" rows={2} maxLength={2000} value={f.notes} onChange={(ev) => setF({ ...f, notes: ev.target.value })} /></Field>
        {account && account.initial_balance !== bal && hasTrades && <Notice tone="warn" className="sm:col-span-2">Changing the initial balance recalculates this account&apos;s balance, returns and drawdown.</Notice>}
      </div>
    </Modal>
  );
}

export function CashModal({ open, onClose, account, defaultType = "deposit" }: { open: boolean; onClose: () => void; account: TradingAccount; defaultType?: CashType }) {
  const { addCash, tz, summaries } = useData();
  const [type, setType] = useState<CashType>(defaultType);
  const [amount, setAmount] = useState("");
  const [when, setWhen] = useState(utcToWall(new Date().toISOString(), tz));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const amt = Number(amount);
  const balance = summaries.get(account.id)?.balance ?? 0;
  const overdraw = type === "withdrawal" && amt > balance;

  async function save() {
    const at = wallToUtc(when, tz);
    if (!(amt > 0) || !at) return;
    setSaving(true);
    try {
      await addCash({ account_id: account.id, type, amount: Math.round(amt * 100) / 100, occurred_at: at, note: note.trim() || null });
      toast(type === "deposit" ? "Deposit recorded" : "Withdrawal recorded");
      onClose();
    } catch (e) { toast(e instanceof Error ? e.message : "Couldn't save", "error"); } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} size="sm" title="Record a cash movement" description={account.name}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={saving} disabled={!(amt > 0) || !when} onClick={save}>Save</Button></>}>
      <div className="grid gap-4">
        <Segmented size="md" value={type} onChange={setType} ariaLabel="Type" className="w-full [&>button]:flex-1" options={[{ value: "deposit", label: "Deposit" }, { value: "withdrawal", label: "Withdrawal" }]} />
        <Field label="Amount" htmlFor="c-amt"><Input id="c-amt" type="number" inputMode="decimal" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} suffix={account.currency} /></Field>
        <Field label="Date & time" htmlFor="c-when"><Input id="c-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
        <Field label="Note" htmlFor="c-note" optional><Input id="c-note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        {overdraw && <Notice tone="warn">This is more than the current balance.</Notice>}
      </div>
    </Modal>
  );
}
