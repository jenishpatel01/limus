"use client";

// Thin repository over Supabase. Every query runs as the signed-in user,
// and Row Level Security limits it to that user's rows.

import { supabase } from "@/lib/supabase/client";
import type {
  AppNotification, Attachment, CashTransaction, ImportRecord, JournalEntry, Profile, SavedReport, Strategy, Trade, TradingAccount,
} from "@/lib/types";

export class ApiError extends Error {}

function friendly(e: { message?: string; code?: string; details?: string } | null, fallback: string): ApiError {
  const msg = e?.message ?? fallback;
  if (e?.code === "23505") {
    if (msg.includes("strategies_user_name")) return new ApiError("You already have a strategy with that name.");
    if (msg.includes("fingerprint")) return new ApiError("This trade has already been imported.");
    return new ApiError("That record already exists.");
  }
  if (e?.code === "23514") {
    if (msg.includes("Account limit")) return new ApiError("You've reached the limit of 50 accounts.");
    return new ApiError("Some values are out of range. Please check the form.");
  }
  if (e?.code === "23503") return new ApiError("A linked record no longer exists. Refresh and try again.");
  if (e?.code === "42501" || /row-level security/i.test(msg)) return new ApiError("You don't have permission to do that.");
  if (/Failed to fetch|NetworkError/i.test(msg)) return new ApiError("Network error. Check your connection and try again.");
  return new ApiError(msg);
}

type Table = "trading_accounts" | "cash_transactions" | "strategies" | "trades" | "journal_entries" | "attachments" | "imports" | "reports" | "notifications";

async function fetchAll<T>(table: Table, orderBy: string, ascending = true): Promise<T[]> {
  const page = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase().from(table).select("*").order(orderBy, { ascending }).order("id").range(from, from + page - 1);
    if (error) throw friendly(error, `Couldn't load ${table}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < page) break;
  }
  return out;
}

export interface Snapshot {
  profile: Profile | null;
  accounts: TradingAccount[];
  cash: CashTransaction[];
  strategies: Strategy[];
  trades: Trade[];
  journal: JournalEntry[];
  attachments: Attachment[];
  imports: ImportRecord[];
  reports: SavedReport[];
  notifications: AppNotification[];
}

export async function loadSnapshot(userId: string): Promise<Snapshot> {
  const [profileRes, accounts, cash, strategies, trades, journal, attachments, imports, reports, notifications] = await Promise.all([
    supabase().from("profiles").select("*").eq("id", userId).maybeSingle(),
    fetchAll<TradingAccount>("trading_accounts", "created_at"),
    fetchAll<CashTransaction>("cash_transactions", "occurred_at"),
    fetchAll<Strategy>("strategies", "created_at"),
    fetchAll<Trade>("trades", "entry_at", false),
    fetchAll<JournalEntry>("journal_entries", "entry_date", false),
    fetchAll<Attachment>("attachments", "created_at"),
    fetchAll<ImportRecord>("imports", "created_at", false),
    fetchAll<SavedReport>("reports", "created_at", false),
    supabase().from("notifications").select("*").order("created_at", { ascending: false }).limit(50).then((r) => {
      if (r.error) throw friendly(r.error, "Couldn't load notifications");
      return (r.data ?? []) as AppNotification[];
    }),
  ]);
  if (profileRes.error) throw friendly(profileRes.error, "Couldn't load your profile");
  return { profile: profileRes.data as Profile | null, accounts, cash, strategies, trades, journal, attachments, imports, reports, notifications };
}

async function insertOne<T>(table: Table, row: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().from(table).insert(row).select("*").single();
  if (error) throw friendly(error, "Couldn't save");
  return data as T;
}

async function updateOne<T>(table: Table, id: string, patch: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().from(table).update(patch).eq("id", id).select("*").single();
  if (error) throw friendly(error, "Couldn't save");
  return data as T;
}

async function deleteWhere(table: Table, column: string, values: string[]) {
  if (!values.length) return;
  for (let i = 0; i < values.length; i += 200) {
    const { error } = await supabase().from(table).delete().in(column, values.slice(i, i + 200));
    if (error) throw friendly(error, "Couldn't delete");
  }
}

export const api = {
  async updateProfile(id: string, patch: Partial<Profile>) {
    const { data, error } = await supabase().from("profiles").update(patch).eq("id", id).select("*").single();
    if (error) throw friendly(error, "Couldn't save your profile");
    return data as Profile;
  },

  createAccount: (row: Partial<TradingAccount>) => insertOne<TradingAccount>("trading_accounts", row),
  updateAccount: (id: string, patch: Partial<TradingAccount>) => updateOne<TradingAccount>("trading_accounts", id, patch),
  deleteAccount: (id: string) => deleteWhere("trading_accounts", "id", [id]),

  createCash: (row: Partial<CashTransaction>) => insertOne<CashTransaction>("cash_transactions", row),
  deleteCash: (id: string) => deleteWhere("cash_transactions", "id", [id]),

  createStrategy: (row: Partial<Strategy>) => insertOne<Strategy>("strategies", row),
  updateStrategy: (id: string, patch: Partial<Strategy>) => updateOne<Strategy>("strategies", id, patch),
  deleteStrategy: (id: string) => deleteWhere("strategies", "id", [id]),

  createTrade: (row: Partial<Trade>) => insertOne<Trade>("trades", row),
  updateTrade: (id: string, patch: Partial<Trade>) => updateOne<Trade>("trades", id, patch),
  deleteTrades: (ids: string[]) => deleteWhere("trades", "id", ids),
  async insertTrades(rows: Partial<Trade>[]): Promise<Trade[]> {
    const out: Trade[] = [];
    for (let i = 0; i < rows.length; i += 250) {
      const { data, error } = await supabase().from("trades").insert(rows.slice(i, i + 250)).select("*");
      if (error) throw friendly(error, "Couldn't import trades");
      out.push(...((data ?? []) as Trade[]));
    }
    return out;
  },

  async upsertJournal(row: Partial<JournalEntry>): Promise<JournalEntry> {
    if (row.id) return updateOne<JournalEntry>("journal_entries", row.id, row);
    return insertOne<JournalEntry>("journal_entries", row);
  },
  async insertJournals(rows: Partial<JournalEntry>[]): Promise<JournalEntry[]> {
    if (!rows.length) return [];
    const { data, error } = await supabase().from("journal_entries").insert(rows).select("*");
    if (error) throw friendly(error, "Couldn't save journal entries");
    return (data ?? []) as JournalEntry[];
  },
  deleteJournal: (id: string) => deleteWhere("journal_entries", "id", [id]),

  async uploadAttachment(userId: string, parent: { tradeId?: string; strategyId?: string }, file: File, caption?: string): Promise<Attachment> {
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) throw new ApiError("Only PNG, JPEG, WebP or GIF images can be uploaded.");
    if (file.size > 5 * 1024 * 1024) throw new ApiError("Images must be 5 MB or smaller.");
    const ext = file.type.split("/")[1].replace("jpeg", "jpg");
    const folder = parent.tradeId ? `trades/${parent.tradeId}` : `strategies/${parent.strategyId}`;
    const path = `${userId}/${folder}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase().storage.from("attachments").upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) throw new ApiError(up.error.message || "Upload failed");
    try {
      return await insertOne<Attachment>("attachments", {
        user_id: userId, trade_id: parent.tradeId ?? null, strategy_id: parent.strategyId ?? null,
        storage_path: path, file_name: file.name.slice(0, 255), mime_type: file.type, size_bytes: file.size, caption: caption?.slice(0, 300) || null,
      });
    } catch (e) {
      await supabase().storage.from("attachments").remove([path]);
      throw e;
    }
  },
  async deleteAttachments(items: Attachment[]) {
    if (!items.length) return;
    const { error } = await supabase().storage.from("attachments").remove(items.map((a) => a.storage_path));
    if (error) throw new ApiError(error.message);
    await deleteWhere("attachments", "id", items.map((a) => a.id));
  },
  async signedUrls(paths: string[]): Promise<Record<string, string>> {
    if (!paths.length) return {};
    const { data, error } = await supabase().storage.from("attachments").createSignedUrls(paths, 60 * 60);
    if (error) throw new ApiError(error.message);
    const out: Record<string, string> = {};
    for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
    return out;
  },

  createImport: (row: Partial<ImportRecord>) => insertOne<ImportRecord>("imports", row),
  updateImport: (id: string, patch: Partial<ImportRecord>) => updateOne<ImportRecord>("imports", id, patch),

  createReport: (row: Partial<SavedReport>) => insertOne<SavedReport>("reports", row),
  deleteReport: (id: string) => deleteWhere("reports", "id", [id]),

  createNotification: (row: Partial<AppNotification>) => insertOne<AppNotification>("notifications", row),
  async markNotificationsRead(ids: string[]) {
    if (!ids.length) return;
    const { error } = await supabase().from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    if (error) throw friendly(error, "Couldn't update notifications");
  },
  async deleteAllData(userId: string, attachments: Attachment[]) {
    if (attachments.length) {
      const paths = attachments.map((a) => a.storage_path);
      for (let i = 0; i < paths.length; i += 100) await supabase().storage.from("attachments").remove(paths.slice(i, i + 100));
    }
    for (const t of ["reports", "notifications", "imports", "trading_accounts", "strategies", "journal_entries"] as Table[]) {
      const { error } = await supabase().from(t).delete().eq("user_id", userId);
      if (error) throw friendly(error, "Couldn't delete data");
    }
  },
};
