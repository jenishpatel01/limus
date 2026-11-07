import { describe, expect, it } from "vitest";
import { calcTrade, round, stopIsValid, targetIsValid } from "@/lib/engine/pnl";
import { deriveFxRate, detectSession, guessAssetClass, resolveInstrument } from "@/lib/engine/instruments";

describe("round", () => {
  it("rounds half away from zero like Postgres", () => {
    expect(round(1.005)).toBe(1.01);
    expect(round(-1.005)).toBe(-1.01);
    expect(round(2.675)).toBe(2.68);
    expect(round(0.1 + 0.2)).toBe(0.3);
    expect(round(-0.004)).toBe(0);
    expect(round(1.23456, 4)).toBe(1.2346);
  });
});

describe("calcTrade — matches the database trigger", () => {
  // These four cases were run through public.trades_compute() in Postgres.
  it("forex long EURUSD, quote = account currency", () => {
    const r = calcTrade({ direction: "long", status: "closed", entryPrice: 1.1, exitPrice: 1.105, stopLoss: 1.095, quantity: 1, contractSize: 100_000, fxRate: 1, commission: 7 });
    expect(r).toMatchObject({ grossPnl: 500, netPnl: 493, riskAmount: 500, rMultiple: 0.986 });
  });

  it("forex short USDJPY converts JPY P&L to USD", () => {
    const fx = deriveFxRate({ base: "USD", quote: "JPY" }, "USD", 149.5)!;
    const r = calcTrade({ direction: "short", status: "closed", entryPrice: 150, exitPrice: 149.5, stopLoss: 150.5, quantity: 0.5, contractSize: 100_000, fxRate: fx, swap: -1.2 });
    expect(r).toMatchObject({ grossPnl: 167.22, netPnl: 166.02, riskAmount: 167.22, rMultiple: 0.9928 });
  });

  it("index future ES with tick value (point value 50)", () => {
    const es = resolveInstrument("ES");
    expect(es.contractSize).toBe(50);
    const r = calcTrade({ direction: "long", status: "closed", entryPrice: 5000, exitPrice: 4990.25, stopLoss: 4995, quantity: 2, contractSize: es.contractSize, fxRate: 1, commission: 4.5, fees: 2.5 });
    expect(r).toMatchObject({ grossPnl: -975, netPnl: -982, riskAmount: 500, rMultiple: -1.964 });
  });

  it("open trade has no realised P&L", () => {
    const r = calcTrade({ direction: "long", status: "open", entryPrice: 60000, quantity: 0.1, contractSize: 1, fxRate: 1 });
    expect(r.grossPnl).toBeNull();
    expect(r.netPnl).toBeNull();
    expect(r.rMultiple).toBeNull();
    expect(r.riskAmount).toBeNull();
  });
});

describe("calcTrade — other asset classes", () => {
  it("crypto short with funding costs", () => {
    const r = calcTrade({ direction: "short", status: "closed", entryPrice: 3200, exitPrice: 3100, stopLoss: 3260, quantity: 2, contractSize: 1, fxRate: 1, fees: 3.1, funding: -1.4 });
    expect(r.grossPnl).toBe(200);
    expect(r.netPnl).toBe(195.5);
    expect(r.riskAmount).toBe(120);
    expect(r.rMultiple).toBe(1.6292);
  });

  it("stocks long shares", () => {
    const r = calcTrade({ direction: "long", status: "closed", entryPrice: 182.4, exitPrice: 179.9, stopLoss: 180, takeProfit: 190, quantity: 100, contractSize: 1, fxRate: 1, commission: 1 });
    expect(r.grossPnl).toBe(-250);
    expect(r.netPnl).toBe(-251);
    expect(r.riskAmount).toBe(240);
    expect(r.plannedRR).toBe(3.17);
    expect(r.positionValue).toBe(18240);
  });

  it("gold lot of 100 oz", () => {
    const gold = resolveInstrument("XAUUSD");
    const r = calcTrade({ direction: "long", status: "closed", entryPrice: 2350.5, exitPrice: 2362.1, quantity: 0.2, contractSize: gold.contractSize, fxRate: 1 });
    expect(r.grossPnl).toBe(232);
  });

  it("DAX CFD in a USD account uses a supplied EURUSD rate", () => {
    const r = calcTrade({ direction: "long", status: "closed", entryPrice: 18000, exitPrice: 18100, quantity: 1, contractSize: 1, fxRate: 1.08 });
    expect(r.grossPnl).toBe(108);
  });

  it("broker-reported P&L is kept as gross and costs still apply", () => {
    const r = calcTrade({ direction: "long", status: "closed", entryPrice: 1, exitPrice: 2, quantity: 1, contractSize: 1, fxRate: 1, pnlSource: "reported", reportedGross: 123.45, commission: 3.45 });
    expect(r.grossPnl).toBe(123.45);
    expect(r.netPnl).toBe(120);
  });

  it("uses a manual risk amount only when there is no stop", () => {
    const r = calcTrade({ direction: "long", status: "closed", entryPrice: 100, exitPrice: 110, quantity: 1, contractSize: 1, fxRate: 1, manualRiskAmount: 5 });
    expect(r.riskAmount).toBe(5);
    expect(r.rMultiple).toBe(2);
  });

  it("unrealised P&L of an open position includes recorded costs", () => {
    const r = calcTrade({ direction: "short", status: "open", entryPrice: 1.27, markPrice: 1.265, quantity: 1, contractSize: 100_000, fxRate: 1, commission: 7, swap: -2 });
    expect(r.unrealisedPnl).toBe(491);
  });
});

describe("validation helpers", () => {
  it("checks stop and target sides", () => {
    expect(stopIsValid("long", 100, 99)).toBe(true);
    expect(stopIsValid("long", 100, 101)).toBe(false);
    expect(stopIsValid("short", 100, 101)).toBe(true);
    expect(targetIsValid("short", 100, 90)).toBe(true);
    expect(targetIsValid("long", 100, 90)).toBe(false);
  });
});

describe("instruments", () => {
  it("derives FX conversion rates when possible", () => {
    expect(deriveFxRate({ base: "EUR", quote: "USD" }, "USD", 1.1)).toBe(1);
    expect(deriveFxRate({ base: "USD", quote: "JPY" }, "USD", 150)).toBeCloseTo(1 / 150);
    expect(deriveFxRate({ base: "EUR", quote: "GBP" }, "USD", 0.85)).toBeNull();
  });

  it("guesses asset classes", () => {
    expect(guessAssetClass("eur/usd")).toBe("forex");
    expect(guessAssetClass("BTCUSDT")).toBe("crypto");
    expect(guessAssetClass("XAUUSD")).toBe("commodities");
    expect(guessAssetClass("NAS100")).toBe("indices");
    expect(guessAssetClass("AAPL")).toBe("stocks");
  });

  it("uses JPY pip size and parses unknown pairs", () => {
    expect(resolveInstrument("GBPJPY").pipSize).toBe(0.01);
    const cadchf = resolveInstrument("CADCHF", "forex");
    expect(cadchf).toMatchObject({ base: "CAD", quote: "CHF", contractSize: 100_000, pipSize: 0.0001 });
  });

  it("detects sessions by UTC hour", () => {
    expect(detectSession(new Date("2026-01-05T03:00:00Z"))).toBe("asian");
    expect(detectSession(new Date("2026-01-05T23:30:00Z"))).toBe("asian");
    expect(detectSession(new Date("2026-01-05T08:00:00Z"))).toBe("london");
    expect(detectSession(new Date("2026-01-05T13:00:00Z"))).toBe("overlap");
    expect(detectSession(new Date("2026-01-05T18:00:00Z"))).toBe("new_york");
    expect(detectSession(new Date("2026-01-05T21:30:00Z"))).toBe("off_hours");
  });
});
