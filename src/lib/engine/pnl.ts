// Trade-level calculations. Mirrors the `trades_compute` trigger in the
// database so what you see in the form is exactly what gets stored.

export type Direction = "long" | "short";
export type TradeStatus = "open" | "closed" | "cancelled";
export type PnlSource = "calculated" | "reported";

/** Round half away from zero, like Postgres `round(numeric, n)`. */
export function round(value: number, dp = 2): number {
  if (!Number.isFinite(value)) return value;
  const sign = value < 0 ? -1 : 1;
  const shifted = Number(`${Math.abs(value)}e${dp}`);
  return (sign * Number(`${Math.round(shifted)}e-${dp}`)) || 0;
}

export const dirSign = (d: Direction) => (d === "long" ? 1 : -1);

export interface TradeCalcInput {
  direction: Direction;
  status: TradeStatus;
  entryPrice: number;
  exitPrice?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  markPrice?: number | null;
  quantity: number;
  contractSize: number;
  /** Account currency per 1 unit of quote currency. */
  fxRate: number;
  commission?: number;
  fees?: number;
  /** Signed: positive is a credit, negative a charge. */
  swap?: number;
  /** Signed: positive is a credit, negative a charge. */
  funding?: number;
  pnlSource?: PnlSource;
  /** Broker-reported gross P&L (used when pnlSource = 'reported'). */
  reportedGross?: number | null;
  /** Used only when there is no stop loss. */
  manualRiskAmount?: number | null;
}

export interface TradeCalc {
  /** Account-currency value of a 1.0 price move for the whole position. */
  pointValue: number;
  /** Notional position value in account currency at entry. */
  positionValue: number;
  grossPnl: number | null;
  netPnl: number | null;
  costs: number;
  riskAmount: number | null;
  rMultiple: number | null;
  /** Planned reward-to-risk from stop and target. */
  plannedRR: number | null;
  unrealisedPnl: number | null;
  /** Distance to stop / target in price units. */
  stopDistance: number | null;
  targetDistance: number | null;
}

export function calcTrade(t: TradeCalcInput): TradeCalc {
  const pointValue = t.quantity * t.contractSize * t.fxRate;
  const sign = dirSign(t.direction);
  const commission = t.commission ?? 0;
  const fees = t.fees ?? 0;
  const swap = t.swap ?? 0;
  const funding = t.funding ?? 0;
  const costs = round(commission + fees - swap - funding);

  const stopDistance = t.stopLoss ? Math.abs(t.entryPrice - t.stopLoss) : null;
  const targetDistance = t.takeProfit ? Math.abs(t.takeProfit - t.entryPrice) : null;
  const riskAmount = stopDistance !== null
    ? round(stopDistance * pointValue)
    : t.manualRiskAmount != null ? round(t.manualRiskAmount) : null;

  let grossPnl: number | null = null;
  let netPnl: number | null = null;
  let rMultiple: number | null = null;
  if (t.status === "closed") {
    if (t.pnlSource === "reported") grossPnl = t.reportedGross != null ? round(t.reportedGross) : null;
    else if (t.exitPrice) grossPnl = round((t.exitPrice - t.entryPrice) * sign * pointValue);
    if (grossPnl !== null) {
      netPnl = round(grossPnl - commission - fees + swap + funding);
      rMultiple = riskAmount && riskAmount > 0 ? round(netPnl / riskAmount, 4) : null;
    }
  }

  const unrealisedPnl = t.status === "open" && t.markPrice
    ? round((t.markPrice - t.entryPrice) * sign * pointValue - commission - fees + swap + funding)
    : null;

  return {
    pointValue,
    positionValue: round(t.entryPrice * t.quantity * t.contractSize * t.fxRate),
    grossPnl,
    netPnl,
    costs,
    riskAmount,
    rMultiple,
    plannedRR: stopDistance && targetDistance ? round(targetDistance / stopDistance, 2) : null,
    unrealisedPnl,
    stopDistance,
    targetDistance,
  };
}

/** Is the stop on the losing side of entry for this direction? */
export function stopIsValid(direction: Direction, entry: number, stop: number): boolean {
  return direction === "long" ? stop < entry : stop > entry;
}

export function targetIsValid(direction: Direction, entry: number, target: number): boolean {
  return direction === "long" ? target > entry : target < entry;
}
