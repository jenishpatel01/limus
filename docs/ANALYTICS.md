# Limus analytics: formulas as implemented

All money values are in the account's currency and rounded half away from zero to 2 decimals (like Postgres `round`).
Source: `src/lib/engine/*.ts` and the `trades_compute` trigger in `supabase/migrations`.

## Trade level (`pnl.ts`, DB trigger)

| Quantity | Formula |
|---|---|
| Direction | long = +1, short = −1 |
| Point value | quantity × contract size × conversion rate |
| Gross P&L | (exit − entry) × direction × point value. When the source is "reported", the broker's gross P&L is used instead. |
| Net P&L | gross − commission − fees + swap + funding (swap and funding are signed: + credit, − charge) |
| Risk amount | \|entry − stop\| × point value. With no stop, a manually entered risk amount is used. |
| R multiple | net P&L ÷ risk amount (undefined when there is no risk amount) |
| Planned R:R | \|target − entry\| ÷ \|entry − stop\| |
| Position size | entry × quantity × contract size × conversion rate (notional at entry) |
| Unrealised P&L | (mark − entry) × direction × point value − commission − fees + swap + funding (open trades only) |
| Risk % | risk amount ÷ account balance at entry time × 100 |

**Contract size** means units per 1.0 quantity: 100,000 for a forex lot, 100 for a gold lot, 1 for shares or coins. For futures it is the **point value** (tick value ÷ tick size, e.g. ES = 12.50 ÷ 0.25 = 50).
**Conversion rate** means account currency per 1 unit of quote currency. It is 1 when quote = account currency, and 1 ÷ price when base = account currency (e.g. USDJPY in a USD account). Otherwise it is entered by the user.

## Aggregates (`metrics.ts`), over closed trades with a net P&L

| Metric | Formula |
|---|---|
| Win rate | winning trades (net > 0) ÷ closed trades × 100 (breakeven trades count in the denominator) |
| Gross profit / gross loss | Σ net of winners / Σ \|net\| of losers |
| Profit factor | gross profit ÷ gross loss (∞ when there are no losses) |
| Average win / average loss | gross profit ÷ wins / gross loss ÷ losses |
| Payoff ratio | average win ÷ average loss |
| Expectancy | net P&L ÷ closed trades (= win rate × average win − loss rate × average loss) |
| Average R | mean R multiple of trades that have one |
| Streaks | longest run of consecutive wins / losses ordered by exit time (a breakeven trade resets the run) |
| Recovery factor | net profit ÷ max drawdown |

## Balance, equity, drawdown (`accounts.ts`, `metrics.ts`)

| Quantity | Formula |
|---|---|
| Balance | initial balance + deposits − withdrawals + realised (closed) net P&L |
| Equity | balance + unrealised P&L |
| Net profit | realised + unrealised |
| Return % | net profit ÷ (initial balance + deposits) × 100 |
| Equity curve | balance after each closed trade and cash movement, ordered by time |
| Drawdown | peak − balance, where the running peak is moved by deposits and withdrawals so cash flows are never counted as drawdown. Drawdown % = drawdown ÷ peak × 100 |
| Daily loss limit | limit % × balance at the start of the day (user timezone). Breached when that day's realised loss ≥ limit |

Days, weeks and months are bucketed in the user's timezone. Daily P&L uses the trade's **close** day; weekday and session breakdowns use the **entry** time.

Sessions (UTC hour of entry): Asian 22:00–07:00, London 07:00–12:00, London/NY overlap 12:00–16:00, New York 16:00–21:00, off hours 21:00–22:00.
