import { describe, expect, it } from "vitest";
import { computeStats, dailyPnl, equityCurve, groupBy, monthlyPnl, recoveryFactor, weekdayBreakdown, type StatTrade } from "@/lib/engine/metrics";

let n = 0;
function t(net: number | null, exitAt: string, r: number | null = null, extra: Partial<StatTrade> = {}): StatTrade {
  n++;
  return { id: `t${String(n).padStart(3, "0")}`, net_pnl: net, gross_pnl: net, r_multiple: r, commission: 1, fees: 0.5, entry_at: new Date(new Date(exitAt).getTime() - 3600_000).toISOString(), exit_at: exitAt, status: net === null ? "open" : "closed", ...extra };
}

describe("computeStats", () => {
  const trades = [
    t(100, "2026-01-05T10:00:00Z", 1),
    t(-50, "2026-01-05T12:00:00Z", -0.5),
    t(200, "2026-01-06T10:00:00Z", 2),
    t(0, "2026-01-07T10:00:00Z", 0),
    t(-100, "2026-01-08T10:00:00Z", -1),
    t(-25, "2026-01-08T11:00:00Z", null),
    t(null, "2026-01-09T10:00:00Z"), // open, ignored
  ];
  const s = computeStats(trades);

  it("counts outcomes", () => {
    expect(s.totalTrades).toBe(6);
    expect(s.wins).toBe(2);
    expect(s.losses).toBe(3);
    expect(s.breakeven).toBe(1);
  });
  it("win rate = wins / closed trades", () => expect(s.winRate).toBe(33.33));
  it("net, gross profit and gross loss", () => {
    expect(s.netPnl).toBe(125);
    expect(s.grossProfit).toBe(300);
    expect(s.grossLoss).toBe(175);
  });
  it("profit factor = gross profit / gross loss", () => expect(s.profitFactor).toBe(1.71));
  it("averages and payoff", () => {
    expect(s.avgWin).toBe(150);
    expect(s.avgLoss).toBe(58.33);
    expect(s.payoffRatio).toBe(2.57);
  });
  it("expectancy equals average net P&L per trade", () => {
    expect(s.expectancy).toBe(20.83);
    // winRate·avgWin − lossRate·avgLoss gives the same number
    const alt = (2 / 6) * 150 - (3 / 6) * (175 / 3);
    expect(Math.round(alt * 100) / 100).toBe(20.83);
  });
  it("average R ignores trades without a stop", () => {
    expect(s.avgR).toBe(0.3);
    expect(s.rTrades).toBe(5);
  });
  it("streaks (breakeven resets the streak)", () => {
    expect(s.maxConsecWins).toBe(1);
    expect(s.maxConsecLosses).toBe(2);
    expect(s.currentStreak).toBe(-2);
  });
  it("largest win/loss, costs and hold time", () => {
    expect(s.largestWin).toBe(200);
    expect(s.largestLoss).toBe(-100);
    expect(s.totalCosts).toBe(9);
    expect(s.avgHoldMinutes).toBe(60);
  });

  it("handles empty input and all-winning input", () => {
    const e = computeStats([]);
    expect(e.winRate).toBeNull();
    expect(e.profitFactor).toBeNull();
    expect(e.expectancy).toBeNull();
    const w = computeStats([t(10, "2026-01-01T00:00:00Z"), t(5, "2026-01-02T00:00:00Z")]);
    expect(w.profitFactor).toBe(Infinity);
    expect(w.maxConsecWins).toBe(2);
  });
});

describe("equityCurve & drawdown", () => {
  it("tracks peak-to-trough drawdown", () => {
    const { points, dd } = equityCurve(10_000, "2026-01-01T00:00:00Z", [
      t(1000, "2026-01-02T00:00:00Z"),
      t(-2200, "2026-01-03T00:00:00Z"),
      t(500, "2026-01-04T00:00:00Z"),
      t(2000, "2026-01-05T00:00:00Z"),
      t(-600, "2026-01-06T00:00:00Z"),
    ]);
    expect(points.map((p) => p.balance)).toEqual([10_000, 11_000, 8_800, 9_300, 11_300, 10_700]);
    expect(dd.maxDrawdown).toBe(2200);
    expect(dd.maxDrawdownPct).toBe(20);
    expect(dd.currentDrawdown).toBe(600);
    expect(dd.currentDrawdownPct).toBe(5.31);
  });

  it("withdrawals are not drawdown, deposits are not profit", () => {
    const { points, dd } = equityCurve(10_000, null, [t(500, "2026-01-03T00:00:00Z")], [
      { at: "2026-01-02T00:00:00Z", amount: -4000 },
      { at: "2026-01-04T00:00:00Z", amount: 2000 },
    ]);
    expect(dd.maxDrawdown).toBe(0);
    expect(points.at(-1)!.balance).toBe(8500);
    expect(points.at(-1)!.cumPnl).toBe(500);
  });

  it("recovery factor = net profit / max drawdown", () => {
    expect(recoveryFactor(3000, 1500)).toBe(2);
    expect(recoveryFactor(3000, 0)).toBeNull();
  });
});

describe("timezone conversion", async () => {
  const { wallToUtc, utcToWall, startOfDayInTz } = await import("@/lib/dates");
  it("round-trips wall time in a timezone", () => {
    expect(wallToUtc("2026-03-10T09:30", "Asia/Kolkata")).toBe("2026-03-10T04:00:00.000Z");
    expect(utcToWall("2026-03-10T04:00:00.000Z", "Asia/Kolkata")).toBe("2026-03-10T09:30");
    expect(wallToUtc("2026-07-01T12:00", "America/New_York")).toBe("2026-07-01T16:00:00.000Z");
    expect(wallToUtc("2026-01-15T12:00", "America/New_York")).toBe("2026-01-15T17:00:00.000Z");
    expect(startOfDayInTz("2026-03-03", "Asia/Kolkata").toISOString()).toBe("2026-03-02T18:30:00.000Z");
  });
});

describe("bucketing", () => {
  const trades = [
    t(100, "2026-03-02T23:30:00Z"), // Mon in UTC, Tue 05:00 in Kolkata
    t(-40, "2026-03-03T10:00:00Z"),
    t(60, "2026-04-01T10:00:00Z"),
  ];

  it("buckets daily P&L in the user's timezone", () => {
    const utc = dailyPnl(trades, "UTC");
    expect(utc.get("2026-03-02")?.pnl).toBe(100);
    const ist = dailyPnl(trades, "Asia/Kolkata");
    expect(ist.get("2026-03-02")).toBeUndefined();
    expect(ist.get("2026-03-03")).toMatchObject({ pnl: 60, trades: 2, wins: 1, losses: 1 });
  });

  it("monthly totals", () => {
    const m = monthlyPnl(trades, "UTC");
    expect(m.get("2026-03")?.pnl).toBe(60);
    expect(m.get("2026-04")?.pnl).toBe(60);
  });

  it("weekday breakdown by entry day, Monday first", () => {
    const w = weekdayBreakdown(trades, "UTC");
    expect(w[0].label).toBe("Mon");
    expect(w[0].netPnl).toBe(100);
  });

  it("groupBy computes per-group stats", () => {
    const g = groupBy(trades, (x) => (x.net_pnl! > 0 ? "win" : "loss"));
    expect(g.find((r) => r.key === "win")).toMatchObject({ trades: 2, winRate: 100, netPnl: 160 });
  });
});
