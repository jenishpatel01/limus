// Account balances. Each account is computed independently from its own
// trades and cash movements, so balances never leak between accounts.

import type { CashTransaction, Trade, TradingAccount } from "../types";
import { calcTrade, round } from "./pnl";
import { equityCurve, type DrawdownSummary, type EquityPoint } from "./metrics";

export interface AccountSummary {
  account: TradingAccount;
  initialBalance: number;
  deposits: number;
  withdrawals: number;
  /** Sum of net P&L of closed trades. */
  realisedPnl: number;
  /** Mark-to-market P&L of open trades that have a mark price. */
  unrealisedPnl: number;
  openPositions: number;
  /** initial + deposits − withdrawals + realised */
  balance: number;
  /** balance + unrealised */
  equity: number;
  /** realised + unrealised */
  netProfit: number;
  /** netProfit / (initial + deposits) × 100 */
  returnPct: number | null;
  drawdown: DrawdownSummary;
  curve: EquityPoint[];
  openRisk: number;
}

export function unrealisedOf(t: Trade): number | null {
  if (t.status !== "open") return null;
  return calcTrade({
    direction: t.direction, status: "open", entryPrice: t.entry_price, markPrice: t.mark_price,
    quantity: t.quantity, contractSize: t.contract_size, fxRate: t.fx_rate,
    commission: t.commission, fees: t.fees, swap: t.swap, funding: t.funding,
  }).unrealisedPnl;
}

export function summarizeAccount(account: TradingAccount, allTrades: Trade[], allCash: CashTransaction[]): AccountSummary {
  const trades = allTrades.filter((t) => t.account_id === account.id);
  const cash = allCash.filter((c) => c.account_id === account.id);
  let deposits = 0, withdrawals = 0;
  for (const c of cash) {
    if (c.type === "deposit") deposits += c.amount; else withdrawals += c.amount;
  }
  let realised = 0, unrealised = 0, open = 0, openRisk = 0;
  for (const t of trades) {
    if (t.status === "closed" && t.net_pnl !== null) realised += t.net_pnl;
    if (t.status === "open") {
      open++;
      unrealised += unrealisedOf(t) ?? 0;
      openRisk += t.risk_amount ?? 0;
    }
  }
  const balance = account.initial_balance + deposits - withdrawals + realised;
  const capital = account.initial_balance + deposits;
  const { points, dd } = equityCurve(
    account.initial_balance,
    null,
    trades,
    cash.map((c) => ({ at: c.occurred_at, amount: c.type === "deposit" ? c.amount : -c.amount })),
  );
  return {
    account,
    initialBalance: round(account.initial_balance),
    deposits: round(deposits),
    withdrawals: round(withdrawals),
    realisedPnl: round(realised),
    unrealisedPnl: round(unrealised),
    openPositions: open,
    balance: round(balance),
    equity: round(balance + unrealised),
    netProfit: round(realised + unrealised),
    returnPct: capital > 0 ? round(((realised + unrealised) / capital) * 100, 2) : null,
    drawdown: dd,
    curve: points,
    openRisk: round(openRisk),
  };
}

export interface PortfolioSummary {
  currency: string;
  accounts: AccountSummary[];
  /** Accounts left out of totals because their currency differs. */
  excluded: AccountSummary[];
  initialBalance: number;
  deposits: number;
  withdrawals: number;
  realisedPnl: number;
  unrealisedPnl: number;
  balance: number;
  equity: number;
  netProfit: number;
  returnPct: number | null;
  openPositions: number;
  openRisk: number;
}

/**
 * Combined totals across accounts in one currency. Accounts in other
 * currencies are reported separately rather than converted with a guessed rate.
 */
export function combineAccounts(summaries: AccountSummary[], currency: string): PortfolioSummary {
  const included = summaries.filter((s) => s.account.currency === currency);
  const excluded = summaries.filter((s) => s.account.currency !== currency);
  const sum = (f: (s: AccountSummary) => number) => round(included.reduce((a, s) => a + f(s), 0));
  const initial = sum((s) => s.initialBalance);
  const deposits = sum((s) => s.deposits);
  const realised = sum((s) => s.realisedPnl);
  const unrealised = sum((s) => s.unrealisedPnl);
  const capital = initial + deposits;
  return {
    currency,
    accounts: included,
    excluded,
    initialBalance: initial,
    deposits,
    withdrawals: sum((s) => s.withdrawals),
    realisedPnl: realised,
    unrealisedPnl: unrealised,
    balance: sum((s) => s.balance),
    equity: sum((s) => s.equity),
    netProfit: round(realised + unrealised),
    returnPct: capital > 0 ? round(((realised + unrealised) / capital) * 100, 2) : null,
    openPositions: included.reduce((a, s) => a + s.openPositions, 0),
    openRisk: sum((s) => s.openRisk),
  };
}
