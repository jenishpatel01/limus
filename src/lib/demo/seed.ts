// Deterministic sample data for the clearly-labelled demo account.
// Prices are illustrative, not historical quotes. P&L is computed by the
// database from these prices exactly like a real trade.

import { resolveInstrument, detectSession, type AssetClass } from "@/lib/engine/instruments";
import { positionSize } from "@/lib/engine/risk";
import type { Direction } from "@/lib/engine/pnl";
import type { JournalEntry, Strategy, Trade } from "@/lib/types";
import { EMOTIONS, MISTAKES } from "@/lib/types";

export const DEMO_TAG = "demo";
export const DEMO_ACCOUNT_NAME = "Demo · Multi-asset";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEMO_STRATEGIES: Partial<Strategy>[] = [
  {
    name: "London Breakout (Demo)",
    description: "Trade the break of the Asian range in the first two hours of London.",
    entry_conditions: "Asian range under 40 pips. Enter on a 15m close outside the range, with the higher-timeframe trend.",
    exit_conditions: "Target 2R, or close at 12:00 UTC. Move stop to breakeven at +1R.",
    risk_rules: "0.75% risk per trade. Maximum two attempts per day.",
    asset_classes: ["forex", "commodities"], sessions: ["london"], tags: ["breakout", DEMO_TAG],
  },
  {
    name: "Trend Pullback (Demo)",
    description: "Buy pullbacks to the 20 EMA in a clean higher-timeframe trend.",
    entry_conditions: "Daily trend aligned. Price pulls back to the 20 EMA on the 1h and prints a rejection candle.",
    exit_conditions: "Partial at 1.5R, trail the rest under swing lows.",
    risk_rules: "1% risk per trade. No entries 30 minutes before high-impact news.",
    asset_classes: ["indices", "stocks", "crypto"], sessions: ["overlap", "new_york"], tags: ["trend", DEMO_TAG],
  },
  {
    name: "Range Fade (Demo)",
    description: "Fade the extremes of a well-defined intraday range.",
    entry_conditions: "Three touches on each side of the range. Enter at the edge on a failed breakout.",
    exit_conditions: "Target the opposite side of the range, stop beyond the failed high or low.",
    risk_rules: "0.5% risk per trade. Skip trending days.",
    asset_classes: ["forex", "crypto"], sessions: ["asian", "new_york"], tags: ["mean reversion", DEMO_TAG],
  },
];

const UNIVERSE: { symbol: string; price: number; stopPct: number; cls: AssetClass; strategy: number }[] = [
  { symbol: "EURUSD", price: 1.0842, stopPct: 0.0022, cls: "forex", strategy: 0 },
  { symbol: "GBPUSD", price: 1.2715, stopPct: 0.0025, cls: "forex", strategy: 0 },
  { symbol: "USDJPY", price: 151.2, stopPct: 0.0024, cls: "forex", strategy: 2 },
  { symbol: "XAUUSD", price: 2362.4, stopPct: 0.0045, cls: "commodities", strategy: 0 },
  { symbol: "BTCUSD", price: 63250, stopPct: 0.018, cls: "crypto", strategy: 1 },
  { symbol: "ETHUSD", price: 3120, stopPct: 0.022, cls: "crypto", strategy: 2 },
  { symbol: "NAS100", price: 18420, stopPct: 0.0045, cls: "indices", strategy: 1 },
  { symbol: "US30", price: 39150, stopPct: 0.004, cls: "indices", strategy: 1 },
  { symbol: "NVDA", price: 121.4, stopPct: 0.017, cls: "stocks", strategy: 1 },
  { symbol: "AAPL", price: 191.2, stopPct: 0.011, cls: "stocks", strategy: 1 },
];

const SETUPS = ["Range break", "EMA pullback", "Failed breakout", "Liquidity sweep", "Higher low", "Trendline retest"];
const LESSONS = [
  "Waiting for the candle close kept me out of a fake breakout.",
  "Moving the stop early turned a valid idea into a loss. Trust the plan.",
  "Best trades came after a clear plan written before the session.",
  "Size felt too big, so I managed it emotionally. Keep risk at plan.",
  "Taking partials at 1.5R smoothed the equity curve.",
  "Skip trades during the first five minutes after news.",
];

export interface DemoPlan {
  trades: Partial<Trade>[];
  journals: (Partial<JournalEntry> & { tradeIndex: number })[];
  cash: { type: "deposit" | "withdrawal"; amount: number; occurred_at: string; note: string }[];
}

/** Builds ~150 trades over the last six months, ending now. */
export function buildDemoPlan(accountId: string, strategyIds: string[], now = new Date(), balance = 25_000): DemoPlan {
  const r = rng(20261107);
  const trades: Partial<Trade>[] = [];
  const journals: DemoPlan["journals"] = [];
  const start = new Date(now.getTime() - 182 * 86400_000);
  let t = new Date(start);
  let i = 0;
  let running = balance;

  while (t.getTime() < now.getTime() - 86400_000 && i < 160) {
    t = new Date(t.getTime() + (0.35 + r() * 1.6) * 86400_000);
    const dow = t.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    const u = UNIVERSE[Math.floor(r() * UNIVERSE.length)];
    const spec = resolveInstrument(u.symbol);
    const hours = u.cls === "stocks" ? 14 + Math.floor(r() * 5) : u.cls === "indices" ? 13 + Math.floor(r() * 6) : 7 + Math.floor(r() * 11);
    const entryAt = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), hours, Math.floor(r() * 60)));
    if (entryAt.getTime() > now.getTime() - 2 * 3600_000) break;

    const drift = 1 + (r() - 0.5) * 0.12;
    const entry = Number((u.price * drift).toPrecision(6));
    const direction: Direction = r() < 0.55 ? "long" : "short";
    const sign = direction === "long" ? 1 : -1;
    const stopDist = entry * u.stopPct * (0.7 + r() * 0.6);
    const stop = Number((entry - sign * stopDist).toPrecision(6));
    const target = Number((entry + sign * stopDist * (1.5 + r() * 1.5)).toPrecision(6));

    // Outcome in R: ~47% winners averaging ~1.9R, losers ~-0.95R, a few scratches.
    const roll = r();
    const outcomeR = roll < 0.44 ? 0.5 + r() * 2.1 : roll < 0.93 ? -(0.7 + r() * 0.4) : (r() - 0.5) * 0.1;
    const exit = Number((entry + sign * stopDist * outcomeR).toPrecision(6));
    const fx = spec.quote === "USD" ? 1 : spec.base === "USD" ? 1 / exit : 1;
    const riskPct = [0.5, 0.75, 1][Math.floor(r() * 3)];
    const size = positionSize({ balance: running, riskPct, entry, stop, contractSize: spec.contractSize, fxRate: spec.base === "USD" && spec.quote !== "USD" ? 1 / entry : 1, qtyStep: spec.qtyStep });
    if (!size || size.quantity <= 0) continue;
    const qty = size.quantity;
    const holdMin = u.cls === "stocks" || u.cls === "indices" ? 15 + r() * 300 : 30 + r() * 2200;
    const exitAt = new Date(Math.min(entryAt.getTime() + holdMin * 60_000, now.getTime() - 3600_000));
    const notional = qty * spec.contractSize * entry * fx;
    const commission = u.cls === "forex" || u.cls === "commodities" ? Math.round(qty * 7 * 100) / 100 : u.cls === "stocks" ? 1 : 0;
    const fees = u.cls === "crypto" ? Math.round(notional * 0.0005 * 2 * 100) / 100 : 0;
    const swap = holdMin > 1440 && u.cls !== "crypto" ? -Math.round(qty * 3.2 * 100) / 100 : 0;
    const funding = holdMin > 480 && u.cls === "crypto" ? -Math.round(notional * 0.0001 * 100) / 100 : 0;

    trades.push({
      account_id: accountId,
      strategy_id: strategyIds[u.strategy] ?? null,
      symbol: u.symbol,
      asset_class: u.cls,
      direction,
      status: "closed",
      entry_price: entry,
      exit_price: exit,
      stop_loss: stop,
      take_profit: target,
      quantity: qty,
      contract_size: spec.contractSize,
      quote_currency: spec.quote,
      fx_rate: Number(fx.toPrecision(10)),
      commission, fees, swap, funding,
      risk_pct: size.actualRiskPct,
      entry_at: entryAt.toISOString(),
      exit_at: exitAt.toISOString(),
      session: detectSession(entryAt),
      setup: SETUPS[Math.floor(r() * SETUPS.length)],
      tags: r() < 0.3 ? ["A+ setup"] : r() < 0.2 ? ["news"] : [],
      source: "demo",
    });
    running += size.actualRisk * outcomeR;

    if (r() < 0.45) {
      const won = outcomeR > 0.05;
      const pick = <T,>(arr: readonly T[], n: number) => [...arr].sort(() => r() - 0.5).slice(0, n);
      journals.push({
        tradeIndex: trades.length - 1,
        kind: "trade",
        pre_trade_analysis: `${u.symbol} ${direction === "long" ? "holding above" : "rejecting"} a key level on the 1h. Planned ${riskPct}% risk with a ${(Math.abs(target - entry) / stopDist).toFixed(1)}R target.`,
        post_trade_analysis: won ? "Followed the plan. Entry was clean and I let the trade work." : "Setup was valid but timing was early. Price swept the stop before moving.",
        emotional_state: won ? pick(["Calm", "Focused", "Confident"], 1)[0] : pick(["Anxious", "Impatient", "Frustrated"], 1)[0],
        emotions: pick(EMOTIONS, won ? 1 : 2) as string[],
        mistakes: won ? [] : pick(MISTAKES, 1 + Math.floor(r() * 2)) as string[],
        lessons: LESSONS[Math.floor(r() * LESSONS.length)],
        rating: won ? 4 + Math.round(r()) : 2 + Math.round(r()),
      });
    }
    i++;
  }

  // One open position with a mark price for unrealised P&L.
  const openEntry = 1.0861;
  trades.push({
    account_id: accountId, strategy_id: strategyIds[0] ?? null, symbol: "EURUSD", asset_class: "forex", direction: "long", status: "open",
    entry_price: openEntry, stop_loss: 1.0832, take_profit: 1.0919, mark_price: 1.0874, quantity: 0.8, contract_size: 100_000, quote_currency: "USD", fx_rate: 1,
    commission: 5.6, fees: 0, swap: 0, funding: 0, risk_pct: Math.round((232 / running) * 100 * 1000) / 1000, entry_at: new Date(now.getTime() - 3 * 3600_000).toISOString(),
    session: detectSession(new Date(now.getTime() - 3 * 3600_000)), setup: "Range break", tags: [], source: "demo",
  });

  const cash: DemoPlan["cash"] = [
    { type: "deposit", amount: 5000, occurred_at: new Date(start.getTime() + 60 * 86400_000).toISOString(), note: "Top-up (demo)" },
    { type: "withdrawal", amount: 1500, occurred_at: new Date(start.getTime() + 140 * 86400_000).toISOString(), note: "Profit withdrawal (demo)" },
  ];
  return { trades, journals, cash };
}

export function isDemoStrategy(s: Pick<Strategy, "tags">) {
  return s.tags.includes(DEMO_TAG);
}
