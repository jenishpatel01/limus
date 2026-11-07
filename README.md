# Limus

Trading journal, portfolio manager and performance analytics for forex, crypto, stocks, indices and commodities.
The visual design follows the purchased **Lumis** Framer template: its Geist type scale, neutral palette, #124EEB accent, pixel-sparkle logo and card system.

## Features

| Area | What it does |
|---|---|
| Dashboard | Portfolio balance, equity, realised and unrealised P&L, return, win rate, profit factor, average R:R, drawdown, open positions, equity curve, daily and monthly P&L, asset allocation, best strategy, period comparison, account summaries. Time filters: 1D, 1W, 1M, 3M, 6M, YTD, All, Custom. |
| Trading journal | Add, edit, duplicate, delete, search, filter, sort, bulk delete and export. Each trade has every required field, plus emotions, mistakes, lessons, a rating and screenshots. Daily and weekly notes. Live calculation panel in the form. |
| Portfolio | Up to 50 accounts per user (personal, funded, prop challenge, crypto, stocks, paper). Deposits and withdrawals, separate balances, combined same-currency totals, drawdown, and profit-target and drawdown rule tracking. |
| Analytics | 12 headline metrics, equity and drawdown curves, long vs short, R distribution, monthly heatmap, and breakdowns by strategy, asset class, session, weekday and symbol. Filters for account, asset class, strategy, direction and date range. |
| Calendar | Daily P&L month grid with trade counts, wins and losses, weekly totals, and a day panel listing that day's trades and notes. |
| Strategies | Playbook entries (entry and exit rules, risk rules, asset classes, sessions, tags, screenshots) with live stats and a comparison table. |
| Risk | Calculators for position size, risk %, risk-to-reward, stop loss and take profit, all contract-aware. Daily loss limit, drawdown, exposure, risk per trade and risk allocation monitors, plus risk preferences. |
| Reports | Daily, weekly, monthly, yearly, account, strategy and custom reports, exported as PDF (vector charts) or CSV. Saved report history. |
| CSV import | Upload, automatic and manual column mapping, preview, per-row validation, duplicate detection (in-file and against existing trades), import history and undo. Broker profiles plug into `PROFILES` in `src/lib/import/csv.ts`; only the generic profile exists today. |
| PWA | Installable (manifest and icons), offline fallback page, mobile tab bar, responsive layouts. |
| Demo | Optional, clearly labelled demo account with about 150 sample trades. Never included in real totals, and removable in Settings. |

## Stack

- **Next.js 16.4** (App Router, Cache Components, `proxy.ts`), **React 19.3**, **TypeScript**, **Tailwind CSS 4**
- **Supabase**: Postgres, Auth (email and password, confirmation, reset), Storage (private `attachments` bucket), Row Level Security
- **Recharts** for charts, **jsPDF** with **jspdf-autotable** for PDF, **PapaParse** for CSV, **lucide-react** for icons
- **Vitest** for unit tests and **Playwright** for end-to-end QA

## Architecture

```
src/app            routes: / (landing), auth pages, /onboarding, /app/* (product), /auth/callback, manifest, offline
src/proxy.ts       refreshes the Supabase session cookie; redirects signed-out users away from /app
src/components     ui (design system), app shell, dashboard, journal, portfolio, analytics, calendar,
                   strategies, risk, reports, import, settings, charts, brand
src/lib/engine     pure calculation engine: instruments, pnl, risk, metrics, accounts (unit-tested)
src/lib/data       Supabase repository (api.ts) + client store (store.tsx)
src/lib/import     CSV parsing, mapping, validation, duplicate detection
src/lib/reports    report builder, PDF and CSV export
supabase/          SQL migration (schema, RLS, triggers, storage policies)
tests/unit         Vitest suites for the engine, import and export safety
docs/              ANALYTICS.md (formulas), DESIGN-SYSTEM.md (tokens and components)
```

Pages are client-rendered after sign-in. The browser talks to Supabase with the **publishable key** only, and Row Level Security limits every row to its owner. Child tables use composite `(id, user_id)` foreign keys, so a trade can never point at another user's account or strategy. The `trades_compute` trigger recomputes gross P&L, net P&L, risk and R on every insert and update, so stored figures always match the inputs. `src/lib/engine/pnl.ts` mirrors it, and the unit tests use the exact cases verified in Postgres.

## Calculation formulas

See [docs/ANALYTICS.md](docs/ANALYTICS.md). In short:

- Gross P&L = (exit − entry) × direction × quantity × contract size × conversion rate
- Net P&L = gross − commission − fees + swap + funding
- Risk = |entry − stop| × quantity × contract size × conversion rate, and R = net P&L ÷ risk
- Win rate = winning trades ÷ closed trades. Profit factor = gross profit ÷ gross loss. Expectancy = net P&L ÷ closed trades
- Drawdown = running peak − balance, where deposits and withdrawals move the peak, so they never count as drawdown

## Local setup

```bash
npm install
cp .env.example .env.local     # fill in your Supabase URL and publishable key
npm run dev                    # http://localhost:3000
```

Database: apply `supabase/migrations/20261107000000_limus_schema.sql` to a new Supabase project (SQL editor or `supabase db push`).

Supabase dashboard, then **Authentication → URL Configuration**:
- Site URL: your deployed URL
- Redirect URLs: `https://<your-domain>/auth/callback` and `http://localhost:3000/auth/callback`

## Scripts

```bash
npm run dev        # development server
npm run build      # production build
npm run start      # serve the production build
npm run lint       # ESLint
npm test           # Vitest unit tests
npm run typecheck  # tsc --noEmit
```

## Deployment (Vercel)

1. `vercel link` (or import the GitHub repository in the Vercel dashboard).
2. Add the environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for Production and Preview.
3. `vercel deploy --prod`.
4. Add the production URL to the Supabase Auth URL configuration (see above).

## Known limitations

- **No live market data.** Unrealised P&L uses the mark price you enter on an open trade. Cross-currency conversion rates are entered per trade unless the trade's own prices can provide them (for example, USDJPY in a USD account).
- **Combined totals only include accounts in your base currency.** Other currencies are listed separately and never converted with a guessed rate.
- **No broker integrations yet.** Import works through generic CSV mapping.
- **Deleting your login needs an admin step.** Settings can delete all trading data, but removing the auth user needs server-side admin rights, which the app doesn't expose.
- **Email delivery** uses Supabase's built-in mailer, which is heavily rate-limited. Configure custom SMTP in Supabase for production volume.
