"use client";

import { api } from "@/lib/data/api";
import { dayKey } from "@/lib/dates";
import type { Strategy, TradingAccount } from "@/lib/types";
import { buildDemoPlan, DEMO_ACCOUNT_NAME, DEMO_STRATEGIES, DEMO_TAG } from "./seed";

/** Creates the demo account, its strategies, trades, journal notes and cash movements. */
export async function createDemoData(userId: string, tz: string, existingStrategies: Strategy[]): Promise<TradingAccount> {
  const account = await api.createAccount({
    user_id: userId, name: DEMO_ACCOUNT_NAME, broker: "Sample data", account_type: "paper", currency: "USD",
    initial_balance: 25_000, is_demo: true, daily_loss_limit_pct: 3, max_drawdown_pct: 10,
    notes: "Sample data for exploring Limus. It is never included in your real portfolio totals.",
  });
  try {
    const strategyIds: string[] = [];
    for (const s of DEMO_STRATEGIES) {
      const found = existingStrategies.find((x) => x.name.toLowerCase() === s.name!.toLowerCase());
      strategyIds.push(found ? found.id : (await api.createStrategy({ ...s, user_id: userId })).id);
    }
    const plan = buildDemoPlan(account.id, strategyIds);
    const inserted = await api.insertTrades(plan.trades.map((t) => ({ ...t, user_id: userId })));
    const key = (t: { symbol?: string; entry_at?: string }) => `${t.symbol}|${new Date(t.entry_at!).getTime()}`;
    const byKey = new Map(inserted.map((t) => [key(t), t]));
    await api.insertJournals(plan.journals.flatMap(({ tradeIndex, ...j }) => {
      const trade = byKey.get(key(plan.trades[tradeIndex]));
      return trade ? [{ ...j, user_id: userId, trade_id: trade.id, entry_date: dayKey(trade.entry_at, tz) }] : [];
    }));
    for (const c of plan.cash) await api.createCash({ ...c, user_id: userId, account_id: account.id });
    return account;
  } catch (e) {
    await api.deleteAccount(account.id).catch(() => undefined);
    throw e;
  }
}

/** Removes every demo account and the demo strategies. Real data is untouched. */
export async function removeDemoData(accounts: TradingAccount[], strategies: Strategy[]) {
  for (const a of accounts.filter((x) => x.is_demo)) await api.deleteAccount(a.id);
  for (const s of strategies.filter((x) => x.tags.includes(DEMO_TAG))) await api.deleteStrategy(s.id);
}
