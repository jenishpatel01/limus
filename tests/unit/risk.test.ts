import { describe, expect, it } from "vitest";
import { dailyLossStatus, floorToStep, pipValue, positionSize, rewardToRisk, riskPercent, stopFromRisk, targetFromRR } from "@/lib/engine/risk";
import { summarizeAccount, combineAccounts } from "@/lib/engine/accounts";
import type { CashTransaction, Trade, TradingAccount } from "@/lib/types";

describe("position size", () => {
  it("forex: 1% of 10k with a 25 pip stop on EURUSD = 0.4 lots", () => {
    const r = positionSize({ balance: 10_000, riskPct: 1, entry: 1.1, stop: 1.0975, contractSize: 100_000, fxRate: 1, qtyStep: 0.01 })!;
    expect(r.riskAmount).toBe(100);
    expect(r.quantity).toBe(0.4);
    expect(r.actualRisk).toBe(100);
  });

  it("rounds down to the step so risk never exceeds the budget", () => {
    const r = positionSize({ balance: 10_000, riskPct: 1, entry: 1.1, stop: 1.0967, contractSize: 100_000, fxRate: 1, qtyStep: 0.01 })!;
    expect(r.rawQuantity).toBeCloseTo(0.30303, 4);
    expect(r.quantity).toBe(0.3);
    expect(r.actualRisk).toBeLessThanOrEqual(r.riskAmount);
  });

  it("stocks: whole shares", () => {
    const r = positionSize({ balance: 25_000, riskPct: 0.5, entry: 182.4, stop: 179.9, contractSize: 1, fxRate: 1, qtyStep: 1 })!;
    expect(r.quantity).toBe(50);
    expect(r.actualRisk).toBe(125);
    expect(r.positionValue).toBe(9120);
  });

  it("futures: ES at $50/point", () => {
    const r = positionSize({ balance: 50_000, riskPct: 1, entry: 5000, stop: 4990, contractSize: 50, fxRate: 1, qtyStep: 1 })!;
    expect(r.quantity).toBe(1);
  });

  it("rejects invalid input", () => {
    expect(positionSize({ balance: 0, riskPct: 1, entry: 1, stop: 0.9, contractSize: 1, fxRate: 1, qtyStep: 1 })).toBeNull();
    expect(positionSize({ balance: 1000, riskPct: 1, entry: 1, stop: 1, contractSize: 1, fxRate: 1, qtyStep: 1 })).toBeNull();
  });

  it("floorToStep avoids float drift", () => {
    expect(floorToStep(0.29999999999, 0.01)).toBe(0.3);
    expect(floorToStep(0.299, 0.01)).toBe(0.29);
    expect(floorToStep(7.9, 1)).toBe(7);
  });
});

describe("other calculators", () => {
  it("risk percent of a position", () => {
    expect(riskPercent(10_000, 0.5, 1.1, 1.095, 100_000, 1)).toEqual({ amount: 250, pct: 2.5 });
  });
  it("reward to risk and breakeven win rate", () => {
    expect(rewardToRisk("long", 100, 95, 115)).toEqual({ risk: 5, reward: 15, ratio: 3, breakevenWinRate: 25 });
    expect(rewardToRisk("short", 100, 95, 90)).toBeNull();
  });
  it("stop from risk amount", () => {
    const s = stopFromRisk("short", 1.1, 100, 1, 100_000, 1)!;
    expect(s.stop).toBeCloseTo(1.101, 10);
  });
  it("target from R multiple", () => {
    expect(targetFromRR("long", 100, 98, 2.5)!.target).toBe(105);
    expect(targetFromRR("short", 100, 102, 2)!.target).toBe(96);
  });
  it("pip value", () => {
    expect(pipValue(0.0001, 1, 100_000, 1)).toBe(10);
    expect(pipValue(0.01, 1, 100_000, 1 / 150)).toBe(6.6667);
  });
  it("daily loss limit", () => {
    expect(dailyLossStatus(10_000, 2, -150)).toEqual({ limitAmount: 200, lossToday: 150, remaining: 50, usedPct: 75, breached: false });
    expect(dailyLossStatus(10_000, 2, -250)!.breached).toBe(true);
    expect(dailyLossStatus(10_000, 2, 300)!.lossToday).toBe(0);
  });
});

describe("account summaries", () => {
  const acc = (id: string, currency = "USD", initial = 10_000): TradingAccount => ({
    id, user_id: "u", name: id, broker: null, account_type: "personal", currency, initial_balance: initial, status: "active", is_demo: false,
    daily_loss_limit_pct: null, max_drawdown_pct: null, profit_target_pct: null, notes: null, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  });
  const trade = (id: string, account_id: string, status: "open" | "closed", net: number | null, extra: Partial<Trade> = {}): Trade => ({
    id, user_id: "u", account_id, strategy_id: null, import_id: null, symbol: "EURUSD", asset_class: "forex", direction: "long", status,
    entry_price: 1.1, exit_price: status === "closed" ? 1.11 : null, stop_loss: null, take_profit: null, mark_price: null, quantity: 1, contract_size: 100_000,
    quote_currency: "USD", fx_rate: 1, commission: 0, fees: 0, swap: 0, funding: 0, pnl_source: "calculated", risk_amount: null, risk_pct: null,
    gross_pnl: net, net_pnl: net, r_multiple: null, entry_at: "2026-01-02T00:00:00Z", exit_at: status === "closed" ? "2026-01-02T05:00:00Z" : null,
    session: null, setup: null, tags: [], source: "manual", fingerprint: null, created_at: "", updated_at: "", ...extra,
  });
  const cash = (account_id: string, type: "deposit" | "withdrawal", amount: number): CashTransaction => ({
    id: `${account_id}-${type}-${amount}`, user_id: "u", account_id, type, amount, occurred_at: "2026-01-03T00:00:00Z", note: null, created_at: "",
  });

  const trades = [
    trade("a1", "A", "closed", 1000),
    trade("a2", "A", "closed", -250),
    trade("a3", "A", "open", null, { mark_price: 1.105, risk_amount: 80 }),
    trade("b1", "B", "closed", 400),
  ];
  const flows = [cash("A", "deposit", 5000), cash("A", "withdrawal", 1000)];

  it("keeps each account's balance separate", () => {
    const a = summarizeAccount(acc("A"), trades, flows);
    expect(a.realisedPnl).toBe(750);
    expect(a.unrealisedPnl).toBe(500);
    expect(a.balance).toBe(10_000 + 5000 - 1000 + 750);
    expect(a.equity).toBe(a.balance + 500);
    expect(a.netProfit).toBe(1250);
    expect(a.returnPct).toBe(8.33);
    expect(a.openPositions).toBe(1);
    expect(a.openRisk).toBe(80);
    const b = summarizeAccount(acc("B"), trades, flows);
    expect(b.balance).toBe(10_400);
  });

  it("combines only same-currency accounts", () => {
    const sums = [summarizeAccount(acc("A"), trades, flows), summarizeAccount(acc("B"), trades, flows), summarizeAccount(acc("C", "EUR"), trades, flows)];
    const p = combineAccounts(sums, "USD");
    expect(p.accounts).toHaveLength(2);
    expect(p.excluded.map((s) => s.account.id)).toEqual(["C"]);
    expect(p.balance).toBe(14_750 + 10_400);
    expect(p.realisedPnl).toBe(1150);
  });
});
