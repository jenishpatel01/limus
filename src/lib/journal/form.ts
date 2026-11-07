// Trade form model: string-based form state ↔ database row, with validation.

import type { Trade, JournalEntry, TradingAccount } from "@/lib/types";
import type { AssetClass, TradingSession } from "@/lib/engine/instruments";
import { deriveFxRate, detectSession, guessAssetClass, normalizeSymbol, resolveInstrument } from "@/lib/engine/instruments";
import { calcTrade, stopIsValid, targetIsValid, type Direction, type PnlSource, type TradeStatus } from "@/lib/engine/pnl";
import { utcToWall, wallToUtc } from "@/lib/dates";

export interface TradeFormState {
  account_id: string;
  symbol: string;
  asset_class: AssetClass;
  direction: Direction;
  status: TradeStatus;
  entry_at: string; // wall time "YYYY-MM-DDTHH:mm" in user tz
  exit_at: string;
  entry_price: string;
  exit_price: string;
  stop_loss: string;
  take_profit: string;
  mark_price: string;
  quantity: string;
  contract_size: string;
  quote_currency: string;
  fx_rate: string;
  fx_auto: boolean;
  commission: string;
  fees: string;
  swap: string;
  funding: string;
  pnl_source: PnlSource;
  reported_gross: string;
  manual_risk: string;
  strategy_id: string;
  setup: string;
  session: TradingSession | "";
  session_auto: boolean;
  tags: string[];
  // journal
  pre_trade_analysis: string;
  post_trade_analysis: string;
  emotional_state: string;
  emotions: string[];
  mistakes: string[];
  lessons: string;
  notes: string;
  rating: number | null;
}

const n = (s: string): number | null => {
  if (s === null || s === undefined || String(s).trim() === "") return null;
  const v = Number(String(s).replace(/,/g, "").trim());
  return Number.isFinite(v) ? v : NaN;
};
const s = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

export function emptyForm(account: TradingAccount | undefined, nowWall: string): TradeFormState {
  return {
    account_id: account?.id ?? "", symbol: "", asset_class: "forex", direction: "long", status: "closed",
    entry_at: nowWall, exit_at: nowWall, entry_price: "", exit_price: "", stop_loss: "", take_profit: "", mark_price: "",
    quantity: "", contract_size: "100000", quote_currency: "USD", fx_rate: "1", fx_auto: true,
    commission: "", fees: "", swap: "", funding: "", pnl_source: "calculated", reported_gross: "", manual_risk: "",
    strategy_id: "", setup: "", session: "", session_auto: true, tags: [],
    pre_trade_analysis: "", post_trade_analysis: "", emotional_state: "", emotions: [], mistakes: [], lessons: "", notes: "", rating: null,
  };
}

export function formFromTrade(t: Trade, j: JournalEntry | undefined, tz: string): TradeFormState {
  return {
    account_id: t.account_id, symbol: t.symbol, asset_class: t.asset_class, direction: t.direction, status: t.status,
    entry_at: utcToWall(t.entry_at, tz), exit_at: utcToWall(t.exit_at, tz),
    entry_price: s(t.entry_price), exit_price: s(t.exit_price), stop_loss: s(t.stop_loss), take_profit: s(t.take_profit), mark_price: s(t.mark_price),
    quantity: s(t.quantity), contract_size: s(t.contract_size), quote_currency: t.quote_currency ?? "", fx_rate: s(t.fx_rate), fx_auto: false,
    commission: t.commission ? s(t.commission) : "", fees: t.fees ? s(t.fees) : "", swap: t.swap ? s(t.swap) : "", funding: t.funding ? s(t.funding) : "",
    pnl_source: t.pnl_source, reported_gross: t.pnl_source === "reported" ? s(t.gross_pnl) : "", manual_risk: !t.stop_loss && t.risk_amount ? s(t.risk_amount) : "",
    strategy_id: t.strategy_id ?? "", setup: t.setup ?? "", session: t.session ?? "", session_auto: false, tags: t.tags ?? [],
    pre_trade_analysis: j?.pre_trade_analysis ?? "", post_trade_analysis: j?.post_trade_analysis ?? "", emotional_state: j?.emotional_state ?? "",
    emotions: j?.emotions ?? [], mistakes: j?.mistakes ?? [], lessons: j?.lessons ?? "", notes: j?.notes ?? "", rating: j?.rating ?? null,
  };
}

/** Applies instrument defaults when the symbol or asset class changes. */
export function applyInstrument(f: TradeFormState, symbol: string, accountCurrency: string, assetClass?: AssetClass): TradeFormState {
  const sym = normalizeSymbol(symbol);
  if (!sym) return { ...f, symbol };
  const cls = assetClass ?? guessAssetClass(sym);
  const spec = resolveInstrument(sym, cls);
  return { ...f, symbol: symbol.toUpperCase(), asset_class: cls, contract_size: String(spec.contractSize), quote_currency: spec.quote, ...fxPatch({ ...f, quote_currency: spec.quote }, sym, cls, accountCurrency) };
}

/** Recomputes the FX rate when it can be derived from the trade itself. */
export function fxPatch(f: TradeFormState, symbol: string, cls: AssetClass, accountCurrency: string): Partial<TradeFormState> {
  if (!f.fx_auto) return {};
  const spec = resolveInstrument(symbol, cls);
  const px = n(f.exit_price) || n(f.mark_price) || n(f.entry_price);
  const rate = deriveFxRate({ quote: f.quote_currency || spec.quote, base: spec.base }, accountCurrency, px || null);
  return rate === null ? {} : { fx_rate: String(Number(rate.toPrecision(10))) };
}

export function fxDerivable(f: TradeFormState, accountCurrency: string): boolean {
  const spec = resolveInstrument(f.symbol || "X", f.asset_class);
  return deriveFxRate({ quote: f.quote_currency || spec.quote, base: spec.base }, accountCurrency, 1) !== null;
}

export interface FormIssues { errors: Partial<Record<keyof TradeFormState, string>>; warnings: string[] }

export function validate(f: TradeFormState, tz: string): FormIssues {
  const errors: FormIssues["errors"] = {};
  const warnings: string[] = [];
  const entry = n(f.entry_price), exit = n(f.exit_price), stop = n(f.stop_loss), target = n(f.take_profit), qty = n(f.quantity);
  const cs = n(f.contract_size), fx = n(f.fx_rate), mark = n(f.mark_price);
  if (!f.account_id) errors.account_id = "Choose an account";
  if (!/^[A-Za-z0-9._/:!#-]{1,24}$/.test(normalizeSymbol(f.symbol))) errors.symbol = "Enter a symbol (letters, numbers, . / - only)";
  if (!(entry! > 0)) errors.entry_price = "Entry price must be greater than 0";
  if (!(qty! > 0)) errors.quantity = "Quantity must be greater than 0";
  if (!(cs! > 0)) errors.contract_size = "Contract size must be greater than 0";
  if (!(fx! > 0)) errors.fx_rate = "Conversion rate must be greater than 0";
  if (f.quote_currency && !/^[A-Z]{3}$/.test(f.quote_currency)) errors.quote_currency = "Use a 3-letter currency code";
  if (!f.entry_at || !wallToUtc(f.entry_at, tz)) errors.entry_at = "Enter the entry date and time";
  if (stop !== null && !(stop > 0)) errors.stop_loss = "Stop loss must be greater than 0";
  if (target !== null && !(target > 0)) errors.take_profit = "Take profit must be greater than 0";
  if (mark !== null && !(mark > 0)) errors.mark_price = "Mark price must be greater than 0";
  for (const k of ["commission", "fees"] as const) {
    const v = n(f[k]);
    if (v !== null && !(v >= 0)) errors[k] = "Must be 0 or more";
  }
  for (const k of ["swap", "funding"] as const) if (Number.isNaN(n(f[k]))) errors[k] = "Enter a number";
  if (f.status === "closed") {
    if (!(exit! > 0)) errors.exit_price = "Exit price is required for a closed trade";
    if (f.pnl_source === "reported" && (n(f.reported_gross) === null || Number.isNaN(n(f.reported_gross)))) errors.reported_gross = "Enter the broker-reported gross P&L";
    if (!f.exit_at) errors.exit_at = "Enter the exit date and time";
    else {
      const a = wallToUtc(f.entry_at, tz), b = wallToUtc(f.exit_at, tz);
      if (a && b && b < a) errors.exit_at = "Exit can't be before entry";
    }
  }
  if (entry! > 0 && stop! > 0 && !stopIsValid(f.direction, entry!, stop!)) warnings.push(`Stop loss is on the ${f.direction === "long" ? "upper" : "lower"} side of entry. For a ${f.direction === "long" ? "buy" : "sell"} it's usually ${f.direction === "long" ? "below" : "above"}.`);
  if (entry! > 0 && target! > 0 && !targetIsValid(f.direction, entry!, target!)) warnings.push(`Take profit is on the losing side of entry for a ${f.direction === "long" ? "buy" : "sell"}.`);
  if (!stop && !n(f.manual_risk)) warnings.push("Without a stop loss or risk amount, R multiple can't be calculated.");
  return { errors, warnings };
}

export function preview(f: TradeFormState) {
  const num = (v: string) => { const x = n(v); return x === null || Number.isNaN(x) ? null : x; };
  const entry = num(f.entry_price), qty = num(f.quantity), cs = num(f.contract_size), fx = num(f.fx_rate);
  if (!(entry! > 0 && qty! > 0 && cs! > 0 && fx! > 0)) return null;
  return calcTrade({
    direction: f.direction, status: f.status, entryPrice: entry!, exitPrice: num(f.exit_price), stopLoss: num(f.stop_loss), takeProfit: num(f.take_profit), markPrice: num(f.mark_price),
    quantity: qty!, contractSize: cs!, fxRate: fx!, commission: num(f.commission) ?? 0, fees: num(f.fees) ?? 0, swap: num(f.swap) ?? 0, funding: num(f.funding) ?? 0,
    pnlSource: f.pnl_source, reportedGross: num(f.reported_gross), manualRiskAmount: num(f.manual_risk),
  });
}

/** Builds the row to insert/update. `balanceAtEntry` is used for risk %. */
export function toRow(f: TradeFormState, tz: string, balanceAtEntry: number | null): Partial<Trade> {
  const num = (v: string) => { const x = n(v); return x === null || Number.isNaN(x) ? null : x; };
  const entryAt = wallToUtc(f.entry_at, tz)!;
  const closed = f.status === "closed";
  const p = preview(f);
  const riskAmount = p?.riskAmount ?? null;
  const session = f.session || detectSession(new Date(entryAt));
  return {
    account_id: f.account_id,
    strategy_id: f.strategy_id || null,
    symbol: normalizeSymbol(f.symbol),
    asset_class: f.asset_class,
    direction: f.direction,
    status: f.status,
    entry_price: num(f.entry_price)!,
    exit_price: closed || f.status === "cancelled" ? num(f.exit_price) : null,
    stop_loss: num(f.stop_loss),
    take_profit: num(f.take_profit),
    mark_price: f.status === "open" ? num(f.mark_price) : null,
    quantity: num(f.quantity)!,
    contract_size: num(f.contract_size)!,
    quote_currency: f.quote_currency || null,
    fx_rate: num(f.fx_rate)!,
    commission: num(f.commission) ?? 0,
    fees: num(f.fees) ?? 0,
    swap: num(f.swap) ?? 0,
    funding: num(f.funding) ?? 0,
    pnl_source: f.pnl_source,
    gross_pnl: f.pnl_source === "reported" ? num(f.reported_gross) : null,
    risk_amount: num(f.stop_loss) ? null : num(f.manual_risk),
    risk_pct: riskAmount && balanceAtEntry && balanceAtEntry > 0 ? Math.round((riskAmount / balanceAtEntry) * 100 * 10000) / 10000 : null,
    entry_at: entryAt,
    exit_at: closed ? wallToUtc(f.exit_at, tz) : f.status === "cancelled" && f.exit_at ? wallToUtc(f.exit_at, tz) : null,
    session,
    setup: f.setup.trim() || null,
    tags: f.tags,
  };
}

export function journalFromForm(f: TradeFormState): Partial<JournalEntry> | null {
  const has = f.pre_trade_analysis || f.post_trade_analysis || f.emotional_state || f.emotions.length || f.mistakes.length || f.lessons || f.notes || f.rating;
  if (!has) return null;
  return {
    pre_trade_analysis: f.pre_trade_analysis.trim() || null,
    post_trade_analysis: f.post_trade_analysis.trim() || null,
    emotional_state: f.emotional_state || null,
    emotions: f.emotions,
    mistakes: f.mistakes,
    lessons: f.lessons.trim() || null,
    notes: f.notes.trim() || null,
    rating: f.rating,
  };
}

/** Balance of an account just before a moment (for risk % at entry). */
export function balanceAt(account: TradingAccount, trades: Trade[], cash: { account_id: string; type: string; amount: number; occurred_at: string }[], atIso: string, excludeTradeId?: string): number {
  let b = account.initial_balance;
  for (const t of trades) if (t.account_id === account.id && t.id !== excludeTradeId && t.status === "closed" && t.exit_at && t.exit_at <= atIso && t.net_pnl !== null) b += t.net_pnl;
  for (const c of cash) if (c.account_id === account.id && c.occurred_at <= atIso) b += c.type === "deposit" ? c.amount : -c.amount;
  return Math.round(b * 100) / 100;
}
