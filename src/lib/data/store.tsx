"use client";

import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { api, loadSnapshot, type Snapshot } from "./api";
import { summarizeAccount, type AccountSummary } from "@/lib/engine/accounts";
import { dailyLossStatus } from "@/lib/engine/risk";
import { browserTimezone, dayKey, startOfDayInTz } from "@/lib/dates";
import { money } from "@/lib/format";
import type {
  AppNotification, Attachment, CashTransaction, ImportRecord, JournalEntry, Profile, SavedReport, Strategy, Trade, TradingAccount,
} from "@/lib/types";

/** Which accounts the app is looking at. Demo data is never mixed with real accounts. */
export type Scope = { kind: "real" } | { kind: "demo" } | { kind: "account"; id: string };

interface DataContext extends Snapshot {
  user: User;
  ready: boolean;
  error: string | null;
  tz: string;
  currency: string;
  scope: Scope;
  setScope: (s: Scope) => void;
  /** Accounts in the current scope. */
  scopedAccounts: TradingAccount[];
  scopedAccountIds: Set<string>;
  /** Trades belonging to scoped accounts. */
  scopedTrades: Trade[];
  summaries: Map<string, AccountSummary>;
  hasDemo: boolean;
  reload: () => Promise<void>;
  // mutations
  updateProfile: (patch: Partial<Profile>) => Promise<Profile>;
  saveAccount: (row: Partial<TradingAccount>, id?: string) => Promise<TradingAccount>;
  deleteAccount: (id: string) => Promise<void>;
  addCash: (row: Partial<CashTransaction>) => Promise<CashTransaction>;
  deleteCash: (id: string) => Promise<void>;
  saveStrategy: (row: Partial<Strategy>, id?: string) => Promise<Strategy>;
  deleteStrategy: (id: string) => Promise<void>;
  saveTrade: (row: Partial<Trade>, journal: Partial<JournalEntry> | null, id?: string) => Promise<Trade>;
  deleteTrades: (ids: string[]) => Promise<void>;
  duplicateTrade: (id: string) => Promise<Trade>;
  saveJournal: (row: Partial<JournalEntry>) => Promise<JournalEntry>;
  deleteJournal: (id: string) => Promise<void>;
  uploadAttachment: (parent: { tradeId?: string; strategyId?: string }, file: File, caption?: string) => Promise<Attachment>;
  deleteAttachment: (a: Attachment) => Promise<void>;
  addImported: (trades: Trade[], journals: JournalEntry[], record: ImportRecord) => void;
  upsertImport: (r: ImportRecord) => void;
  addReport: (r: SavedReport) => void;
  removeReport: (id: string) => Promise<void>;
  markRead: (ids: string[]) => Promise<void>;
  notify: (n: Partial<AppNotification>) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<DataContext | null>(null);

export function useData(): DataContext {
  const v = use(Ctx);
  if (!v) throw new Error("useData must be used inside <DataProvider>");
  return v;
}

const EMPTY: Snapshot = { profile: null, accounts: [], cash: [], strategies: [], trades: [], journal: [], attachments: [], imports: [], reports: [], notifications: [] };
const SCOPE_KEY = "limus-scope";

function readScope(): Scope {
  try {
    const raw = localStorage.getItem(SCOPE_KEY);
    if (raw) return JSON.parse(raw) as Scope;
  } catch { /* ignore */ }
  return { kind: "real" };
}

export function DataProvider({ user, children }: { user: User; children: ReactNode }) {
  const router = useRouter();
  const [snap, setSnap] = useState<Snapshot>(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScopeState] = useState<Scope>(readScope);
  const snapRef = useRef(snap);
  useEffect(() => { snapRef.current = snap; }, [snap]);

  const reload = useCallback(async () => {
    try {
      const s = await loadSnapshot(user.id);
      setError(null);
      setSnap(s);
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your data");
      setReady(true);
    }
  }, [user.id]);

  // Initial load (setState happens in the promise callback, after the fetch).
  useEffect(() => {
    let cancelled = false;
    loadSnapshot(user.id).then(
      (s) => { if (!cancelled) { setSnap(s); setReady(true); } },
      (e) => { if (!cancelled) { setError(e instanceof Error ? e.message : "Couldn't load your data"); setReady(true); } },
    );
    return () => { cancelled = true; };
  }, [user.id]);

  const setScope = useCallback((s: Scope) => {
    setScopeState(s);
    try { localStorage.setItem(SCOPE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
  }, []);

  const tz = snap.profile?.timezone ?? browserTimezone();

  const summaries = useMemo(() => {
    const m = new Map<string, AccountSummary>();
    for (const a of snap.accounts) m.set(a.id, summarizeAccount(a, snap.trades, snap.cash));
    return m;
  }, [snap.accounts, snap.trades, snap.cash]);

  // If the scoped account was deleted, fall back to real accounts.
  const effectiveScope: Scope = useMemo(() => (scope.kind === "account" && !snap.accounts.some((a) => a.id === scope.id) ? { kind: "real" } : scope), [scope, snap.accounts]);

  const scopedAccounts = useMemo(() => snap.accounts.filter((a) =>
    effectiveScope.kind === "account" ? a.id === effectiveScope.id : effectiveScope.kind === "demo" ? a.is_demo : !a.is_demo,
  ), [snap.accounts, effectiveScope]);
  const scopedAccountIds = useMemo(() => new Set(scopedAccounts.map((a) => a.id)), [scopedAccounts]);
  const scopedTrades = useMemo(() => snap.trades.filter((t) => scopedAccountIds.has(t.account_id)), [snap.trades, scopedAccountIds]);

  const currency = effectiveScope.kind === "account"
    ? scopedAccounts[0]?.currency ?? "USD"
    : snap.profile?.base_currency ?? scopedAccounts[0]?.currency ?? "USD";

  const patch = (fn: (s: Snapshot) => Snapshot) => setSnap((s) => fn(s));
  const replace = <T extends { id: string }>(list: T[], item: T) => {
    const i = list.findIndex((x) => x.id === item.id);
    if (i < 0) return [...list, item];
    const next = list.slice(); next[i] = item; return next;
  };

  const checkDailyLoss = useCallback(async (trade: Trade) => {
    if (trade.status !== "closed" || !trade.exit_at || (trade.net_pnl ?? 0) >= 0) return;
    const s = snapRef.current;
    const account = s.accounts.find((a) => a.id === trade.account_id);
    const limitPct = account?.daily_loss_limit_pct ?? s.profile?.daily_loss_limit_pct;
    if (!account || !limitPct || account.is_demo) return;
    const day = dayKey(trade.exit_at, tz);
    const dayStart = startOfDayInTz(day, tz).toISOString();
    const trades = s.trades.filter((t) => t.account_id === account.id && t.status === "closed" && t.exit_at);
    const before = trades.filter((t) => t.exit_at! < dayStart).reduce((a, t) => a + (t.net_pnl ?? 0), 0);
    const cashBefore = s.cash.filter((c) => c.account_id === account.id && c.occurred_at < dayStart).reduce((a, c) => a + (c.type === "deposit" ? c.amount : -c.amount), 0);
    const today = trades.filter((t) => dayKey(t.exit_at!, tz) === day).reduce((a, t) => a + (t.net_pnl ?? 0), 0);
    const status = dailyLossStatus(account.initial_balance + cashBefore + before, limitPct, today);
    if (!status?.breached) return;
    const title = `Daily loss limit reached on ${account.name}`;
    if (s.notifications.some((n) => n.title === title && n.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10))) return;
    const n = await api.createNotification({
      user_id: user.id, kind: "risk", title,
      body: `Realised loss on ${day} is ${money(status.lossToday, account.currency)}, at or above your ${limitPct}% limit (${money(status.limitAmount, account.currency)}).`,
      link: "/app/risk",
    });
    patch((x) => ({ ...x, notifications: [n, ...x.notifications] }));
  }, [tz, user.id]);

  const value: DataContext = {
    ...snap,
    user, ready, error, tz, currency,
    scope: effectiveScope, setScope,
    scopedAccounts, scopedAccountIds, scopedTrades, summaries,
    hasDemo: snap.accounts.some((a) => a.is_demo),
    reload,

    async updateProfile(p) {
      const profile = await api.updateProfile(user.id, p);
      patch((s) => ({ ...s, profile }));
      return profile;
    },
    async saveAccount(row, id) {
      const a = id ? await api.updateAccount(id, row) : await api.createAccount({ ...row, user_id: user.id });
      patch((s) => ({ ...s, accounts: replace(s.accounts, a) }));
      return a;
    },
    async deleteAccount(id) {
      const s = snapRef.current;
      const tradeIds = new Set(s.trades.filter((t) => t.account_id === id).map((t) => t.id));
      const files = s.attachments.filter((a) => a.trade_id && tradeIds.has(a.trade_id));
      if (files.length) await api.deleteAttachments(files);
      await api.deleteAccount(id);
      patch((x) => ({
        ...x,
        accounts: x.accounts.filter((a) => a.id !== id),
        trades: x.trades.filter((t) => t.account_id !== id),
        cash: x.cash.filter((c) => c.account_id !== id),
        journal: x.journal.filter((j) => !j.trade_id || !tradeIds.has(j.trade_id)),
        attachments: x.attachments.filter((a) => !a.trade_id || !tradeIds.has(a.trade_id)),
      }));
    },
    async addCash(row) {
      const c = await api.createCash({ ...row, user_id: user.id });
      patch((s) => ({ ...s, cash: [...s.cash, c] }));
      return c;
    },
    async deleteCash(id) {
      await api.deleteCash(id);
      patch((s) => ({ ...s, cash: s.cash.filter((c) => c.id !== id) }));
    },
    async saveStrategy(row, id) {
      const st = id ? await api.updateStrategy(id, row) : await api.createStrategy({ ...row, user_id: user.id });
      patch((s) => ({ ...s, strategies: replace(s.strategies, st) }));
      return st;
    },
    async deleteStrategy(id) {
      const files = snapRef.current.attachments.filter((a) => a.strategy_id === id);
      if (files.length) await api.deleteAttachments(files);
      await api.deleteStrategy(id);
      patch((s) => ({
        ...s,
        strategies: s.strategies.filter((x) => x.id !== id),
        trades: s.trades.map((t) => (t.strategy_id === id ? { ...t, strategy_id: null } : t)),
        attachments: s.attachments.filter((a) => a.strategy_id !== id),
      }));
    },
    async saveTrade(row, journal, id) {
      const trade = id ? await api.updateTrade(id, row) : await api.createTrade({ ...row, user_id: user.id });
      let entry: JournalEntry | null = null;
      if (journal) {
        const existing = snapRef.current.journal.find((j) => j.trade_id === trade.id);
        entry = await api.upsertJournal({
          ...journal, id: existing?.id, user_id: user.id, trade_id: trade.id, kind: "trade",
          entry_date: dayKey(trade.entry_at, tz),
        });
      }
      patch((s) => ({ ...s, trades: replace(s.trades, trade), journal: entry ? replace(s.journal, entry) : s.journal }));
      void checkDailyLoss(trade).catch(() => undefined);
      return trade;
    },
    async deleteTrades(ids) {
      const set = new Set(ids);
      const files = snapRef.current.attachments.filter((a) => a.trade_id && set.has(a.trade_id));
      if (files.length) await api.deleteAttachments(files);
      await api.deleteTrades(ids);
      patch((s) => ({
        ...s,
        trades: s.trades.filter((t) => !set.has(t.id)),
        journal: s.journal.filter((j) => !j.trade_id || !set.has(j.trade_id)),
        attachments: s.attachments.filter((a) => !a.trade_id || !set.has(a.trade_id)),
      }));
    },
    async duplicateTrade(id) {
      const src = snapRef.current.trades.find((t) => t.id === id);
      if (!src) throw new Error("Trade not found");
      const { id: _id, created_at: _c, updated_at: _u, gross_pnl, net_pnl: _n, r_multiple: _r, fingerprint: _f, import_id: _i, ...rest } = src;
      void _id; void _c; void _u; void _n; void _r; void _f; void _i;
      const copy = await api.createTrade({ ...rest, gross_pnl: src.pnl_source === "reported" ? gross_pnl : null, source: "manual", fingerprint: null, import_id: null });
      patch((s) => ({ ...s, trades: [copy, ...s.trades] }));
      return copy;
    },
    async saveJournal(row) {
      const j = await api.upsertJournal({ ...row, user_id: user.id });
      patch((s) => ({ ...s, journal: replace(s.journal, j) }));
      return j;
    },
    async deleteJournal(id) {
      await api.deleteJournal(id);
      patch((s) => ({ ...s, journal: s.journal.filter((j) => j.id !== id) }));
    },
    async uploadAttachment(parent, file, caption) {
      const a = await api.uploadAttachment(user.id, parent, file, caption);
      patch((s) => ({ ...s, attachments: [...s.attachments, a] }));
      return a;
    },
    async deleteAttachment(a) {
      await api.deleteAttachments([a]);
      patch((s) => ({ ...s, attachments: s.attachments.filter((x) => x.id !== a.id) }));
    },
    addImported(trades, journals, record) {
      patch((s) => ({ ...s, trades: [...trades, ...s.trades], journal: [...journals, ...s.journal], imports: replace(s.imports, record) }));
    },
    upsertImport(r) {
      patch((s) => ({ ...s, imports: replace(s.imports, r) }));
    },
    addReport(r) {
      patch((s) => ({ ...s, reports: [r, ...s.reports] }));
    },
    async removeReport(id) {
      await api.deleteReport(id);
      patch((s) => ({ ...s, reports: s.reports.filter((r) => r.id !== id) }));
    },
    async markRead(ids) {
      await api.markNotificationsRead(ids);
      const now = new Date().toISOString();
      patch((s) => ({ ...s, notifications: s.notifications.map((n) => (ids.includes(n.id) ? { ...n, read_at: now } : n)) }));
    },
    async notify(n) {
      const created = await api.createNotification({ ...n, user_id: user.id });
      patch((s) => ({ ...s, notifications: [created, ...s.notifications] }));
    },
    async signOut() {
      await supabase().auth.signOut();
      try { localStorage.removeItem(SCOPE_KEY); } catch { /* ignore */ }
      router.replace("/login");
      router.refresh();
    },
  };

  return <Ctx value={value}>{children}</Ctx>;
}

/** Quick lookups used across pages. */
export function useLookups() {
  const { accounts, strategies, journal, attachments } = useData();
  return useMemo(() => ({
    account: new Map(accounts.map((a) => [a.id, a])),
    strategy: new Map(strategies.map((s) => [s.id, s])),
    journalByTrade: new Map(journal.filter((j) => j.trade_id).map((j) => [j.trade_id!, j])),
    attachmentsByTrade: attachments.reduce((m, a) => {
      if (a.trade_id) m.set(a.trade_id, [...(m.get(a.trade_id) ?? []), a]);
      return m;
    }, new Map<string, Attachment[]>()),
  }), [accounts, strategies, journal, attachments]);
}
