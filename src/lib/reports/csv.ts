import Papa from "papaparse";
import type { JournalEntry, Strategy, Trade, TradingAccount } from "@/lib/types";
import { utcToWall } from "@/lib/dates";

/** Neutralise spreadsheet formula injection (=, +, -, @ at the start of text cells). */
export function safeCell(v: unknown): string | number {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? v : "";
  const s = String(v);
  return /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  return Papa.unparse(rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, safeCell(v)]))));
}

export function tradesToRows(trades: Trade[], accounts: Map<string, TradingAccount>, strategies: Map<string, Strategy>, journal: Map<string, JournalEntry>, tz: string) {
  return trades.map((t) => {
    const j = journal.get(t.id);
    const a = accounts.get(t.account_id);
    return {
      id: t.id,
      account: a?.name ?? "",
      account_currency: a?.currency ?? "",
      symbol: t.symbol,
      asset_class: t.asset_class,
      direction: t.direction === "long" ? "buy" : "sell",
      status: t.status,
      entry_time: utcToWall(t.entry_at, tz).replace("T", " "),
      exit_time: utcToWall(t.exit_at, tz).replace("T", " "),
      entry_price: t.entry_price,
      exit_price: t.exit_price,
      stop_loss: t.stop_loss,
      take_profit: t.take_profit,
      quantity: t.quantity,
      contract_size: t.contract_size,
      quote_currency: t.quote_currency,
      fx_rate: t.fx_rate,
      commission: t.commission,
      fees: t.fees,
      swap: t.swap,
      funding: t.funding,
      gross_pnl: t.gross_pnl,
      net_pnl: t.net_pnl,
      risk_amount: t.risk_amount,
      risk_pct: t.risk_pct,
      r_multiple: t.r_multiple,
      session: t.session,
      strategy: t.strategy_id ? strategies.get(t.strategy_id)?.name ?? "" : "",
      setup: t.setup,
      tags: t.tags.join("; "),
      emotional_state: j?.emotional_state ?? "",
      mistakes: j?.mistakes.join("; ") ?? "",
      lessons: j?.lessons ?? "",
      timezone: tz,
    };
  });
}

export function download(filename: string, content: string | Blob, type = "text/csv;charset=utf-8") {
  const blob = typeof content === "string" ? new Blob(["﻿" + content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
