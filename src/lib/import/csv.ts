// CSV trade import: parse → map columns → validate → detect duplicates.
// Only a generic profile ships today; broker-specific profiles plug into PROFILES.

import Papa from "papaparse";
import type { Trade } from "@/lib/types";
import { ASSET_CLASSES, deriveFxRate, detectSession, guessAssetClass, normalizeSymbol, resolveInstrument, type AssetClass } from "@/lib/engine/instruments";
import { wallToUtc } from "@/lib/dates";

export type FieldKey =
  | "symbol" | "direction" | "entry_time" | "exit_time" | "entry_price" | "exit_price" | "quantity" | "stop_loss" | "take_profit"
  | "commission" | "fees" | "swap" | "profit" | "asset_class" | "contract_size" | "fx_rate" | "external_id" | "setup" | "tags" | "notes";

export interface FieldDef { key: FieldKey; label: string; required?: boolean; synonyms: string[]; hint?: string }

export const FIELDS: FieldDef[] = [
  { key: "symbol", label: "Symbol", required: true, synonyms: ["symbol", "instrument", "ticker", "market", "pair", "asset", "item", "contract"] },
  { key: "direction", label: "Direction (buy/sell)", required: true, synonyms: ["direction", "side", "type", "action", "buy/sell", "position", "long/short", "trade type"] },
  { key: "entry_time", label: "Entry time", required: true, synonyms: ["entry time", "open time", "opened", "open date", "entry date", "time open", "date opened", "open", "entry_time", "date", "time"] },
  { key: "entry_price", label: "Entry price", required: true, synonyms: ["entry price", "open price", "entry", "price open", "avg entry", "average entry", "entry_price", "price"] },
  { key: "quantity", label: "Quantity / lots", required: true, synonyms: ["quantity", "qty", "size", "volume", "lots", "lot", "amount", "units", "shares", "contracts"] },
  { key: "exit_time", label: "Exit time", synonyms: ["exit time", "close time", "closed", "close date", "exit date", "time close", "date closed", "exit_time"] },
  { key: "exit_price", label: "Exit price", synonyms: ["exit price", "close price", "exit", "price close", "avg exit", "average exit", "exit_price"] },
  { key: "stop_loss", label: "Stop loss", synonyms: ["stop loss", "sl", "s/l", "stop", "stop_loss"] },
  { key: "take_profit", label: "Take profit", synonyms: ["take profit", "tp", "t/p", "target", "take_profit"] },
  { key: "commission", label: "Commission", synonyms: ["commission", "comm", "commissions"] },
  { key: "fees", label: "Fees", synonyms: ["fees", "fee", "other fees", "exchange fee"] },
  { key: "swap", label: "Swap / financing", synonyms: ["swap", "swaps", "rollover", "financing", "funding"] },
  { key: "profit", label: "Gross profit (broker)", synonyms: ["profit", "p&l", "pnl", "gross p&l", "gross pnl", "realized p&l", "realised p&l", "result"], hint: "If mapped, used as gross P&L; commission, fees and swap are deducted." },
  { key: "asset_class", label: "Asset class", synonyms: ["asset class", "asset type", "class", "category", "market type"] },
  { key: "contract_size", label: "Contract size", synonyms: ["contract size", "lot size", "multiplier", "point value"] },
  { key: "fx_rate", label: "Conversion rate", synonyms: ["fx rate", "conversion rate", "exchange rate", "rate to account"] },
  { key: "external_id", label: "Trade ID / ticket", synonyms: ["ticket", "order", "trade id", "position id", "id", "deal", "order id", "position"] },
  { key: "setup", label: "Setup", synonyms: ["setup", "strategy", "pattern"] },
  { key: "tags", label: "Tags", synonyms: ["tags", "labels"] },
  { key: "notes", label: "Notes", synonyms: ["notes", "comment", "comments", "note", "description"] },
];

export type Mapping = Partial<Record<FieldKey, string>>;
export type DateOrder = "auto" | "ymd" | "dmy" | "mdy";

export interface ImportProfile {
  id: string;
  name: string;
  /** 0–1 confidence that a file with these headers comes from this source. */
  detect: (headers: string[]) => number;
  map: (headers: string[]) => Mapping;
  dateOrder: DateOrder;
}

const norm = (s: string) => s.toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();

/** Maps each field to the best-matching header (exact synonym first, then contains). Each header is used once. */
export function autoMap(headers: string[]): Mapping {
  const used = new Set<string>();
  const out: Mapping = {};
  const H = headers.map((h) => ({ raw: h, n: norm(h) }));
  for (const pass of ["exact", "contains"] as const) {
    for (const f of FIELDS) {
      if (out[f.key]) continue;
      for (const syn of f.synonyms) {
        const hit = H.find((h) => !used.has(h.raw) && (pass === "exact" ? h.n === syn : h.n.includes(syn) && syn.length >= 4));
        if (hit) { out[f.key] = hit.raw; used.add(hit.raw); break; }
      }
    }
  }
  return out;
}

export const PROFILES: ImportProfile[] = [
  { id: "generic", name: "Generic CSV", detect: () => 0.5, map: autoMap, dateOrder: "auto" },
];

export interface ParsedFile { headers: string[]; rows: Record<string, string>[]; errors: string[] }

export function parseCsv(text: string): ParsedFile {
  const res = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
  const headers = (res.meta.fields ?? []).filter((h) => h !== "");
  const errors = res.errors.slice(0, 5).map((e) => `Row ${(e.row ?? 0) + 2}: ${e.message}`);
  return { headers, rows: res.data, errors };
}

/** Numbers like "1,234.56", "1.234,56", "$-12.50", "(45.00)", "1 234,5". */
export function parseNumber(raw: string | undefined | null, decimalComma = false): number | null {
  if (raw === undefined || raw === null) return null;
  let s = String(raw).trim();
  if (!s || s === "-" || s.toLowerCase() === "n/a") return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/[\s' ]/g, "").replace(/[^\d.,\-+eE]/g, "");
  if (!/\d/.test(s)) return null;
  if (decimalComma) s = s.replace(/\./g, "").replace(",", ".");
  else if (/,\d{1,2}$/.test(s) && !s.includes(".")) s = s.replace(",", ".");
  else s = s.replace(/,/g, "");
  const v = Number(s);
  if (!Number.isFinite(v)) return null;
  return neg ? -Math.abs(v) : v;
}

/** Parses a date-time string as wall time in `tz` and returns a UTC ISO string. */
export function parseDateTime(raw: string | undefined | null, order: DateOrder, tz: string): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^\d{10}(\d{3})?$/.test(s)) return new Date(Number(s) * (s.length === 10 ? 1000 : 1)).toISOString();
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s) && /^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const m = s.match(/^(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(am|pm)?)?$/i);
  if (!m) return null;
  const [a, b, c] = [m[1], m[2], m[3]].map(Number);
  let y: number, mo: number, d: number;
  if (m[1].length === 4) { y = a; mo = b; d = c; }
  else {
    const year = m[3].length === 2 ? 2000 + c : c;
    // Explicit order wins; otherwise infer from values > 12, defaulting to day-first.
    const ord = order === "dmy" || order === "mdy" ? order : a > 12 ? "dmy" : b > 12 ? "mdy" : "dmy";
    [y, mo, d] = ord === "mdy" ? [year, a, b] : [year, b, a];
  }
  let hh = m[4] ? Number(m[4]) : 0;
  const mm = m[5] ? Number(m[5]) : 0;
  if (m[7]) { const pm = m[7].toLowerCase() === "pm"; if (hh === 12) hh = pm ? 12 : 0; else if (pm) hh += 12; }
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || hh > 23 || mm > 59) return null;
  const wall = `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  const iso = wallToUtc(wall, tz);
  if (!iso) return null;
  const sec = m[6] ? Number(m[6]) : 0;
  return new Date(new Date(iso).getTime() + sec * 1000).toISOString();
}

export function parseDirection(raw: string | undefined): "long" | "short" | null {
  const s = (raw ?? "").trim().toLowerCase();
  if (/^(buy|long|b|bot|bought|1|buy to open|buy limit|buy stop)$/.test(s) || s.startsWith("buy") || s.startsWith("long")) return "long";
  if (/^(sell|short|s|sld|sold|-1|sell short|sell to open|sell limit|sell stop)$/.test(s) || s.startsWith("sell") || s.startsWith("short")) return "short";
  return null;
}

export function tradeFingerprint(t: { account_id: string; symbol: string; direction: string; entry_at: string; entry_price: number; quantity: number }): string {
  return [t.account_id.slice(0, 8), normalizeSymbol(t.symbol), t.direction, new Date(t.entry_at).toISOString().slice(0, 19), Number(t.entry_price).toPrecision(10), Number(t.quantity).toPrecision(10)].join("|");
}

export type RowStatus = "ok" | "duplicate" | "error";
export interface PreviewRow {
  index: number;
  status: RowStatus;
  errors: string[];
  warnings: string[];
  trade: Partial<Trade> | null;
  notes: string | null;
}

export interface ValidateOptions {
  accountId: string;
  accountCurrency: string;
  tz: string;
  dateOrder: DateOrder;
  decimalComma: boolean;
  existing: Pick<Trade, "account_id" | "symbol" | "direction" | "entry_at" | "entry_price" | "quantity" | "fingerprint">[];
}

export const MAX_ROWS = 5000;

export function validateRows(rows: Record<string, string>[], mapping: Mapping, o: ValidateOptions): PreviewRow[] {
  const get = (r: Record<string, string>, k: FieldKey) => (mapping[k] ? r[mapping[k]!] ?? "" : "");
  const seen = new Set<string>();
  const existing = new Set<string>();
  for (const t of o.existing) {
    if (t.account_id !== o.accountId) continue;
    existing.add(tradeFingerprint(t));
    if (t.fingerprint) existing.add(t.fingerprint);
  }

  return rows.slice(0, MAX_ROWS).map((r, index) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const num = (k: FieldKey) => parseNumber(get(r, k), o.decimalComma);

    const rawSymbol = get(r, "symbol").trim();
    const symbol = normalizeSymbol(rawSymbol).replace(/[^A-Za-z0-9._/:!#-]/g, "");
    if (!symbol || symbol.length > 24) errors.push("Missing or invalid symbol");
    const direction = parseDirection(get(r, "direction"));
    if (!direction) errors.push(`Unknown direction "${get(r, "direction")}"`);
    const entryAt = parseDateTime(get(r, "entry_time"), o.dateOrder, o.tz);
    if (!entryAt) errors.push(`Can't read entry time "${get(r, "entry_time")}"`);
    const exitRaw = get(r, "exit_time");
    const exitAt = exitRaw ? parseDateTime(exitRaw, o.dateOrder, o.tz) : null;
    if (exitRaw && !exitAt) errors.push(`Can't read exit time "${exitRaw}"`);
    const entry = num("entry_price");
    if (!(entry! > 0)) errors.push("Entry price must be a positive number");
    const exit = num("exit_price");
    if (exit !== null && !(exit > 0)) errors.push("Exit price must be positive");
    const qtyRaw = num("quantity");
    const qty = qtyRaw === null ? null : Math.abs(qtyRaw);
    if (!(qty! > 0)) errors.push("Quantity must be a positive number");
    if (entryAt && exitAt && exitAt < entryAt) errors.push("Exit time is before entry time");

    const clsRaw = get(r, "asset_class").trim().toLowerCase();
    const cls: AssetClass = (ASSET_CLASSES as readonly string[]).includes(clsRaw) ? (clsRaw as AssetClass)
      : clsRaw.startsWith("fx") || clsRaw === "currency" ? "forex" : clsRaw.startsWith("stock") || clsRaw === "equity" ? "stocks" : clsRaw.startsWith("index") ? "indices" : clsRaw.startsWith("commod") ? "commodities" : clsRaw.startsWith("crypto") ? "crypto"
      : guessAssetClass(symbol || "X");
    const spec = resolveInstrument(symbol || "X", cls);
    const cs = num("contract_size") ?? spec.contractSize;
    if (!mapping.contract_size && spec.name === spec.symbol && cls !== "stocks" && cls !== "crypto") warnings.push(`Assumed contract size ${cs} for ${symbol}`);

    const profit = mapping.profit ? num("profit") : null;
    const closed = exit !== null && exitAt !== null;
    if ((exit !== null) !== (exitAt !== null) && !errors.length) errors.push("Exit price and exit time must both be present for a closed trade");
    let fx = num("fx_rate");
    if (fx === null) fx = deriveFxRate(spec, o.accountCurrency, exit ?? entry);
    if (fx === null) {
      if (profit !== null) fx = 1;
      else errors.push(`Needs a ${spec.quote}→${o.accountCurrency} conversion rate (map a rate or profit column)`);
    } else if (!(fx > 0)) errors.push("Conversion rate must be positive");

    const commission = Math.abs(num("commission") ?? 0);
    const fees = Math.abs(num("fees") ?? 0);
    const swap = num("swap") ?? 0;
    const stop = num("stop_loss");
    const target = num("take_profit");
    const ext = get(r, "external_id").trim();

    if (errors.length) return { index, status: "error" as const, errors, warnings, trade: null, notes: null };

    const base = { account_id: o.accountId, symbol, direction: direction!, entry_at: entryAt!, entry_price: entry!, quantity: qty! };
    const fp = ext ? `ext:${o.accountId.slice(0, 8)}:${ext}`.slice(0, 200) : tradeFingerprint(base);
    const dup = existing.has(fp) || existing.has(tradeFingerprint(base)) || seen.has(fp);
    seen.add(fp);

    const tags = get(r, "tags").split(/[;,|]/).map((t) => t.trim()).filter(Boolean).slice(0, 30);
    const trade: Partial<Trade> = {
      ...base,
      asset_class: cls,
      status: closed ? "closed" : "open",
      exit_price: closed ? exit : null,
      exit_at: closed ? exitAt : null,
      stop_loss: stop && stop > 0 ? stop : null,
      take_profit: target && target > 0 ? target : null,
      contract_size: cs > 0 ? cs : spec.contractSize,
      quote_currency: spec.quote,
      fx_rate: fx!,
      commission, fees, swap, funding: 0,
      pnl_source: profit !== null && closed ? "reported" : "calculated",
      gross_pnl: profit !== null && closed ? profit : null,
      session: detectSession(new Date(entryAt!)),
      setup: get(r, "setup").trim().slice(0, 120) || null,
      tags,
      source: "import",
      fingerprint: fp,
    };
    return { index, status: dup ? ("duplicate" as const) : ("ok" as const), errors: dup ? ["Already in this account"] : [], warnings, trade, notes: get(r, "notes").trim().slice(0, 10000) || null };
  });
}

export const TEMPLATE_CSV = `symbol,direction,entry_time,entry_price,quantity,exit_time,exit_price,stop_loss,take_profit,commission,swap,tags,notes
EURUSD,buy,2026-10-01 09:15,1.0850,0.5,2026-10-01 13:40,1.0892,1.0825,1.0900,3.50,0,london;breakout,Clean break of Asian range
XAUUSD,sell,2026-10-02 14:05,2365.20,0.2,2026-10-02 16:30,2371.80,2372.00,2350.00,1.40,0,,Stopped near the high
AAPL,buy,2026-10-03 15:35,182.40,50,2026-10-03 19:10,185.10,180.00,188.00,1.00,0,earnings,
`;
