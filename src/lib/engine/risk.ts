// Risk calculators. All inputs use the same contract model as trades:
// value of a 1.0 price move per 1 quantity = contractSize * fxRate (account currency).

import { round, type Direction } from "./pnl";

export interface SizingInput {
  balance: number;
  riskPct: number;
  entry: number;
  stop: number;
  contractSize: number;
  fxRate: number;
  /** Quantity increment (0.01 lots, 1 share, 1 contract…). Size is rounded down to it. */
  qtyStep: number;
}

export interface SizingResult {
  riskAmount: number;
  stopDistance: number;
  /** Exact size before rounding to the step. */
  rawQuantity: number;
  quantity: number;
  /** Money actually at risk after rounding down. */
  actualRisk: number;
  actualRiskPct: number;
  positionValue: number;
}

/** Floor to a step without floating-point drift (e.g. 0.29 / 0.01). */
export function floorToStep(value: number, step: number): number {
  if (step <= 0) return value;
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 2);
  const n = Math.floor(round(value / step, 8));
  return round(n * step, decimals);
}

export function positionSize(i: SizingInput): SizingResult | null {
  const stopDistance = Math.abs(i.entry - i.stop);
  if (!(i.balance > 0) || !(i.riskPct > 0) || !(stopDistance > 0) || !(i.contractSize > 0) || !(i.fxRate > 0)) return null;
  const riskAmount = round(i.balance * (i.riskPct / 100));
  const lossPerUnit = stopDistance * i.contractSize * i.fxRate;
  const rawQuantity = riskAmount / lossPerUnit;
  const quantity = floorToStep(rawQuantity, i.qtyStep);
  const actualRisk = round(quantity * lossPerUnit);
  return {
    riskAmount,
    stopDistance,
    rawQuantity,
    quantity,
    actualRisk,
    actualRiskPct: round((actualRisk / i.balance) * 100, 3),
    positionValue: round(quantity * i.contractSize * i.entry * i.fxRate),
  };
}

/** Risk % of an existing position. */
export function riskPercent(balance: number, quantity: number, entry: number, stop: number, contractSize: number, fxRate: number) {
  if (!(balance > 0)) return null;
  const amount = round(Math.abs(entry - stop) * quantity * contractSize * fxRate);
  return { amount, pct: round((amount / balance) * 100, 3) };
}

export function rewardToRisk(direction: Direction, entry: number, stop: number, target: number) {
  const risk = direction === "long" ? entry - stop : stop - entry;
  const reward = direction === "long" ? target - entry : entry - target;
  if (!(risk > 0) || !(reward > 0)) return null;
  const ratio = reward / risk;
  return {
    risk,
    reward,
    ratio: round(ratio, 2),
    /** Win rate needed to break even at this ratio, ignoring costs. */
    breakevenWinRate: round((1 / (1 + ratio)) * 100, 2),
  };
}

/** Stop price that risks exactly `riskAmount` with the given size. */
export function stopFromRisk(direction: Direction, entry: number, riskAmount: number, quantity: number, contractSize: number, fxRate: number) {
  const perPoint = quantity * contractSize * fxRate;
  if (!(perPoint > 0) || !(riskAmount > 0)) return null;
  const distance = riskAmount / perPoint;
  const stop = direction === "long" ? entry - distance : entry + distance;
  return stop > 0 ? { stop, distance } : null;
}

/** Target price for a reward multiple of the stop distance. */
export function targetFromRR(direction: Direction, entry: number, stop: number, rr: number) {
  const distance = Math.abs(entry - stop) * rr;
  if (!(distance > 0)) return null;
  const target = direction === "long" ? entry + distance : entry - distance;
  return target > 0 ? { target, distance } : null;
}

export function pipValue(pipSize: number, quantity: number, contractSize: number, fxRate: number) {
  return round(pipSize * quantity * contractSize * fxRate, 4);
}

export interface DailyLossStatus {
  limitAmount: number;
  lossToday: number;
  remaining: number;
  usedPct: number;
  breached: boolean;
}

/** Daily loss limit as % of the balance at the start of the day. */
export function dailyLossStatus(startOfDayBalance: number, limitPct: number, realisedToday: number): DailyLossStatus | null {
  if (!(startOfDayBalance > 0) || !(limitPct > 0)) return null;
  const limitAmount = round(startOfDayBalance * (limitPct / 100));
  const lossToday = realisedToday < 0 ? round(-realisedToday) : 0;
  return {
    limitAmount,
    lossToday,
    remaining: round(Math.max(0, limitAmount - lossToday)),
    usedPct: round(Math.min(100, (lossToday / limitAmount) * 100), 1),
    breached: lossToday >= limitAmount,
  };
}
