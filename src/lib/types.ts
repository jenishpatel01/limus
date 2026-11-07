// Row types matching the Postgres schema (supabase/migrations).
import type { AssetClass, TradingSession } from "./engine/instruments";
import type { Direction, PnlSource, TradeStatus } from "./engine/pnl";

export type { AssetClass, TradingSession, Direction, PnlSource, TradeStatus };

export type AccountType = "personal" | "funded" | "prop_challenge" | "crypto" | "stocks" | "paper" | "other";
export type AccountStatus = "active" | "paused" | "passed" | "breached" | "archived";
export type CashType = "deposit" | "withdrawal";
export type JournalKind = "trade" | "daily" | "weekly" | "note";
export type ReportPeriod = "daily" | "weekly" | "monthly" | "yearly" | "account" | "strategy" | "custom";
export type TradeSource = "manual" | "import" | "demo";

export interface Profile {
  id: string;
  display_name: string | null;
  base_currency: string;
  timezone: string;
  asset_classes: AssetClass[];
  default_risk_pct: number;
  daily_loss_limit_pct: number | null;
  max_drawdown_limit_pct: number | null;
  max_open_risk_pct: number | null;
  theme: "light" | "dark" | "system";
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TradingAccount {
  id: string;
  user_id: string;
  name: string;
  broker: string | null;
  account_type: AccountType;
  currency: string;
  initial_balance: number;
  status: AccountStatus;
  is_demo: boolean;
  daily_loss_limit_pct: number | null;
  max_drawdown_pct: number | null;
  profit_target_pct: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CashTransaction {
  id: string;
  user_id: string;
  account_id: string;
  type: CashType;
  amount: number;
  occurred_at: string;
  note: string | null;
  created_at: string;
}

export interface Strategy {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  entry_conditions: string | null;
  exit_conditions: string | null;
  risk_rules: string | null;
  asset_classes: AssetClass[];
  sessions: TradingSession[];
  tags: string[];
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Trade {
  id: string;
  user_id: string;
  account_id: string;
  strategy_id: string | null;
  import_id: string | null;
  symbol: string;
  asset_class: AssetClass;
  direction: Direction;
  status: TradeStatus;
  entry_price: number;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  mark_price: number | null;
  quantity: number;
  contract_size: number;
  quote_currency: string | null;
  fx_rate: number;
  commission: number;
  fees: number;
  swap: number;
  funding: number;
  pnl_source: PnlSource;
  risk_amount: number | null;
  risk_pct: number | null;
  gross_pnl: number | null;
  net_pnl: number | null;
  r_multiple: number | null;
  entry_at: string;
  exit_at: string | null;
  session: TradingSession | null;
  setup: string | null;
  tags: string[];
  source: TradeSource;
  fingerprint: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  trade_id: string | null;
  kind: JournalKind;
  entry_date: string;
  title: string | null;
  pre_trade_analysis: string | null;
  post_trade_analysis: string | null;
  emotional_state: string | null;
  emotions: string[];
  mistakes: string[];
  lessons: string | null;
  notes: string | null;
  rating: number | null;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: string;
  user_id: string;
  trade_id: string | null;
  strategy_id: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  caption: string | null;
  created_at: string;
}

export interface ImportRecord {
  id: string;
  user_id: string;
  account_id: string | null;
  file_name: string;
  profile: string;
  total_rows: number;
  imported_rows: number;
  duplicate_rows: number;
  error_rows: number;
  mapping: Record<string, string>;
  status: "completed" | "partial" | "failed";
  created_at: string;
}

export interface SavedReport {
  id: string;
  user_id: string;
  title: string;
  period: ReportPeriod;
  range_start: string;
  range_end: string;
  filters: Record<string, unknown>;
  summary: Record<string, unknown>;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  kind: "risk" | "import" | "report" | "system";
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  personal: "Personal",
  funded: "Funded account",
  prop_challenge: "Prop firm challenge",
  crypto: "Crypto portfolio",
  stocks: "Stock portfolio",
  paper: "Paper trading",
  other: "Other",
};

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  active: "Active",
  paused: "Paused",
  passed: "Passed",
  breached: "Breached",
  archived: "Archived",
};

export const EMOTIONS = ["Calm", "Focused", "Confident", "Patient", "Anxious", "Fearful", "Greedy", "Frustrated", "Impatient", "Overconfident", "Bored", "Revengeful"] as const;
export const MISTAKES = ["Moved stop loss", "Entered too early", "Entered too late", "Chased price", "Oversized position", "No stop loss", "Ignored plan", "Exited too early", "Held loser too long", "Revenge trade", "Overtrading", "Traded during news"] as const;
