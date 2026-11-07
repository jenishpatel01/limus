-- Limus schema: trading accounts, trades, journal, strategies, attachments,
-- cash movements, imports, reports and notifications.
-- Every table is owned by a user and protected by Row Level Security.
-- Child tables reference their parent with (id, user_id) composite keys,
-- so a row can never point at another user's account, trade or strategy.

-- ───────────────────────── Enums ─────────────────────────
create type public.asset_class as enum ('forex', 'crypto', 'stocks', 'indices', 'commodities');
create type public.trade_direction as enum ('long', 'short');
create type public.trade_status as enum ('open', 'closed', 'cancelled');
create type public.trading_session as enum ('asian', 'london', 'overlap', 'new_york', 'off_hours');
create type public.account_type as enum ('personal', 'funded', 'prop_challenge', 'crypto', 'stocks', 'paper', 'other');
create type public.account_status as enum ('active', 'paused', 'passed', 'breached', 'archived');
create type public.cash_type as enum ('deposit', 'withdrawal');
create type public.journal_kind as enum ('trade', 'daily', 'weekly', 'note');
create type public.report_period as enum ('daily', 'weekly', 'monthly', 'yearly', 'account', 'strategy', 'custom');
create type public.trade_source as enum ('manual', 'import', 'demo');
create type public.pnl_source as enum ('calculated', 'reported');

-- ───────────────────────── Helpers ─────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ───────────────────────── Profiles ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  base_currency text not null default 'USD' check (base_currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  asset_classes public.asset_class[] not null default '{}',
  default_risk_pct numeric(7, 3) not null default 1 check (default_risk_pct > 0 and default_risk_pct <= 100),
  daily_loss_limit_pct numeric(7, 3) check (daily_loss_limit_pct > 0 and daily_loss_limit_pct <= 100),
  max_drawdown_limit_pct numeric(7, 3) check (max_drawdown_limit_pct > 0 and max_drawdown_limit_pct <= 100),
  max_open_risk_pct numeric(7, 3) check (max_open_risk_pct > 0 and max_open_risk_pct <= 100),
  theme text not null default 'light' check (theme in ('light', 'dark', 'system')),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80), ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── Trading accounts ─────────────────────────
create table public.trading_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  broker text check (char_length(broker) <= 80),
  account_type public.account_type not null default 'personal',
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  initial_balance numeric(20, 2) not null check (initial_balance >= 0 and initial_balance < 1e15),
  status public.account_status not null default 'active',
  is_demo boolean not null default false,
  daily_loss_limit_pct numeric(7, 3) check (daily_loss_limit_pct > 0 and daily_loss_limit_pct <= 100),
  max_drawdown_pct numeric(7, 3) check (max_drawdown_pct > 0 and max_drawdown_pct <= 100),
  profit_target_pct numeric(7, 3) check (profit_target_pct > 0 and profit_target_pct <= 1000),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index trading_accounts_user_idx on public.trading_accounts (user_id);
create trigger trading_accounts_updated_at before update on public.trading_accounts
  for each row execute function public.set_updated_at();

create or replace function public.enforce_account_limit()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.trading_accounts where user_id = new.user_id) >= 50 then
    raise exception 'Account limit reached (50 accounts per user)' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger trading_accounts_limit before insert on public.trading_accounts
  for each row execute function public.enforce_account_limit();

-- ───────────────────────── Deposits & withdrawals ─────────────────────────
create table public.cash_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null,
  type public.cash_type not null,
  amount numeric(20, 2) not null check (amount > 0 and amount < 1e15),
  occurred_at timestamptz not null default now(),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  foreign key (account_id, user_id) references public.trading_accounts (id, user_id) on delete cascade
);
create index cash_transactions_account_idx on public.cash_transactions (account_id, occurred_at);
create index cash_transactions_user_idx on public.cash_transactions (user_id);

-- Convenience views (inherit RLS from the base table via security_invoker)
create view public.deposits with (security_invoker = true) as
  select id, user_id, account_id, amount, occurred_at, note, created_at
  from public.cash_transactions where type = 'deposit';
create view public.withdrawals with (security_invoker = true) as
  select id, user_id, account_id, amount, occurred_at, note, created_at
  from public.cash_transactions where type = 'withdrawal';

-- ───────────────────────── Strategies ─────────────────────────
create table public.strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  description text check (char_length(description) <= 4000),
  entry_conditions text check (char_length(entry_conditions) <= 4000),
  exit_conditions text check (char_length(exit_conditions) <= 4000),
  risk_rules text check (char_length(risk_rules) <= 4000),
  asset_classes public.asset_class[] not null default '{}',
  sessions public.trading_session[] not null default '{}',
  tags text[] not null default '{}' check (cardinality(tags) <= 30),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index strategies_user_idx on public.strategies (user_id);
create unique index strategies_user_name_idx on public.strategies (user_id, lower(name));
create trigger strategies_updated_at before update on public.strategies
  for each row execute function public.set_updated_at();

-- ───────────────────────── Imports ─────────────────────────
create table public.imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid,
  file_name text not null check (char_length(file_name) <= 255),
  profile text not null default 'generic' check (char_length(profile) <= 40),
  total_rows integer not null default 0 check (total_rows >= 0),
  imported_rows integer not null default 0 check (imported_rows >= 0),
  duplicate_rows integer not null default 0 check (duplicate_rows >= 0),
  error_rows integer not null default 0 check (error_rows >= 0),
  mapping jsonb not null default '{}',
  status text not null default 'completed' check (status in ('completed', 'partial', 'failed')),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (account_id, user_id) references public.trading_accounts (id, user_id) on delete set null (account_id)
);
create index imports_user_idx on public.imports (user_id, created_at desc);
create index imports_account_idx on public.imports (account_id);

-- ───────────────────────── Trades ─────────────────────────
create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid not null,
  strategy_id uuid,
  import_id uuid,
  symbol text not null check (symbol ~ '^[A-Za-z0-9._/:!#-]{1,24}$'),
  asset_class public.asset_class not null,
  direction public.trade_direction not null,
  status public.trade_status not null default 'closed',
  entry_price numeric(28, 10) not null check (entry_price > 0),
  exit_price numeric(28, 10) check (exit_price > 0),
  stop_loss numeric(28, 10) check (stop_loss > 0),
  take_profit numeric(28, 10) check (take_profit > 0),
  mark_price numeric(28, 10) check (mark_price > 0),
  quantity numeric(28, 8) not null check (quantity > 0),
  -- Account-currency value of a 1.0 price move per 1 unit of quantity is
  -- contract_size * fx_rate. Futures use contract_size = tick_value / tick_size.
  contract_size numeric(28, 8) not null default 1 check (contract_size > 0),
  quote_currency text check (quote_currency ~ '^[A-Z]{3}$'),
  fx_rate numeric(28, 10) not null default 1 check (fx_rate > 0),
  commission numeric(20, 2) not null default 0 check (commission >= 0),
  fees numeric(20, 2) not null default 0 check (fees >= 0),
  swap numeric(20, 2) not null default 0,
  funding numeric(20, 2) not null default 0,
  pnl_source public.pnl_source not null default 'calculated',
  risk_amount numeric(20, 2) check (risk_amount >= 0),
  risk_pct numeric(9, 4) check (risk_pct >= 0 and risk_pct <= 100),
  gross_pnl numeric(20, 2),
  net_pnl numeric(20, 2),
  r_multiple numeric(14, 4),
  entry_at timestamptz not null,
  exit_at timestamptz,
  session public.trading_session,
  setup text check (char_length(setup) <= 120),
  tags text[] not null default '{}' check (cardinality(tags) <= 30),
  source public.trade_source not null default 'manual',
  fingerprint text check (char_length(fingerprint) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (account_id, user_id) references public.trading_accounts (id, user_id) on delete cascade,
  foreign key (strategy_id, user_id) references public.strategies (id, user_id) on delete set null (strategy_id),
  foreign key (import_id, user_id) references public.imports (id, user_id) on delete set null (import_id),
  constraint trades_closed_requires_exit check (status <> 'closed' or (exit_price is not null and exit_at is not null)),
  constraint trades_exit_after_entry check (exit_at is null or exit_at >= entry_at),
  constraint trades_reported_needs_gross check (pnl_source = 'calculated' or gross_pnl is not null)
);
create index trades_user_entry_idx on public.trades (user_id, entry_at desc);
create index trades_account_idx on public.trades (account_id, exit_at);
create index trades_strategy_idx on public.trades (strategy_id);
create index trades_import_idx on public.trades (import_id);
create unique index trades_user_fingerprint_idx on public.trades (user_id, fingerprint) where fingerprint is not null;
create trigger trades_updated_at before update on public.trades
  for each row execute function public.set_updated_at();

-- P&L is computed by the database so stored figures are always consistent.
-- Mirrors src/lib/engine/pnl.ts (covered by unit tests).
create or replace function public.trades_compute()
returns trigger language plpgsql set search_path = '' as $$
declare
  dir integer := case when new.direction = 'long' then 1 else -1 end;
  per_point numeric := new.quantity * new.contract_size * new.fx_rate;
begin
  if new.stop_loss is not null then
    new.risk_amount := round(abs(new.entry_price - new.stop_loss) * per_point, 2);
  end if;

  if new.status = 'closed' then
    if new.pnl_source = 'calculated' then
      new.gross_pnl := round((new.exit_price - new.entry_price) * dir * per_point, 2);
    end if;
    new.net_pnl := new.gross_pnl - new.commission - new.fees + new.swap + new.funding;
    new.r_multiple := case when coalesce(new.risk_amount, 0) > 0
      then round(new.net_pnl / new.risk_amount, 4) else null end;
  else
    if new.pnl_source = 'calculated' then new.gross_pnl := null; end if;
    new.net_pnl := null;
    new.r_multiple := null;
  end if;
  return new;
end $$;
create trigger trades_compute before insert or update on public.trades
  for each row execute function public.trades_compute();

-- ───────────────────────── Journal entries ─────────────────────────
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trade_id uuid,
  kind public.journal_kind not null default 'trade',
  entry_date date not null,
  title text check (char_length(title) <= 160),
  pre_trade_analysis text check (char_length(pre_trade_analysis) <= 10000),
  post_trade_analysis text check (char_length(post_trade_analysis) <= 10000),
  emotional_state text check (char_length(emotional_state) <= 40),
  emotions text[] not null default '{}' check (cardinality(emotions) <= 20),
  mistakes text[] not null default '{}' check (cardinality(mistakes) <= 20),
  lessons text check (char_length(lessons) <= 10000),
  notes text check (char_length(notes) <= 10000),
  rating smallint check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (trade_id, user_id) references public.trades (id, user_id) on delete cascade,
  constraint journal_trade_kind check ((kind = 'trade') = (trade_id is not null))
);
create unique index journal_entries_trade_idx on public.journal_entries (trade_id) where trade_id is not null;
create index journal_entries_user_date_idx on public.journal_entries (user_id, entry_date desc);
create trigger journal_entries_updated_at before update on public.journal_entries
  for each row execute function public.set_updated_at();

-- ───────────────────────── Attachments (screenshots) ─────────────────────────
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trade_id uuid,
  strategy_id uuid,
  storage_path text not null unique check (char_length(storage_path) <= 300),
  file_name text not null check (char_length(file_name) <= 255),
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp', 'image/gif')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  caption text check (char_length(caption) <= 300),
  created_at timestamptz not null default now(),
  foreign key (trade_id, user_id) references public.trades (id, user_id) on delete cascade,
  foreign key (strategy_id, user_id) references public.strategies (id, user_id) on delete cascade,
  constraint attachments_one_parent check (num_nonnulls(trade_id, strategy_id) = 1),
  constraint attachments_path_owner check (split_part(storage_path, '/', 1) = user_id::text)
);
create index attachments_trade_idx on public.attachments (trade_id);
create index attachments_strategy_idx on public.attachments (strategy_id);
create index attachments_user_idx on public.attachments (user_id);

-- ───────────────────────── Reports ─────────────────────────
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  period public.report_period not null,
  range_start date not null,
  range_end date not null,
  filters jsonb not null default '{}',
  summary jsonb not null default '{}',
  created_at timestamptz not null default now(),
  constraint reports_range check (range_end >= range_start)
);
create index reports_user_idx on public.reports (user_id, created_at desc);

-- ───────────────────────── Notifications ─────────────────────────
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('risk', 'import', 'report', 'system')),
  title text not null check (char_length(title) between 1 and 160),
  body text check (char_length(body) <= 1000),
  link text check (link ~ '^/[A-Za-z0-9/_?=&.-]*$'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.profiles enable row level security;
alter table public.trading_accounts enable row level security;
alter table public.cash_transactions enable row level security;
alter table public.strategies enable row level security;
alter table public.imports enable row level security;
alter table public.trades enable row level security;
alter table public.journal_entries enable row level security;
alter table public.attachments enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;

create policy "profiles: read own" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['trading_accounts', 'cash_transactions', 'strategies', 'imports', 'trades',
                           'journal_entries', 'attachments', 'reports', 'notifications'] loop
    execute format('create policy "%1$s: read own" on public.%1$I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s: insert own" on public.%1$I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s: update own" on public.%1$I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s: delete own" on public.%1$I for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.trading_accounts, public.cash_transactions, public.strategies,
  public.imports, public.trades, public.journal_entries, public.attachments, public.reports,
  public.notifications to authenticated;
grant select on public.deposits, public.withdrawals to authenticated;
revoke all on all tables in schema public from anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;


-- ───────────────────────── Storage ─────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy "attachments: read own files" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "attachments: upload own files" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "attachments: update own files" on storage.objects for update to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "attachments: delete own files" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
