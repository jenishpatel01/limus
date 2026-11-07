// Contract specifications for the instruments Limus knows about.
// Every value can be overridden per trade; these are only defaults.

export const ASSET_CLASSES = ["forex", "crypto", "stocks", "indices", "commodities"] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

export const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  forex: "Forex",
  crypto: "Crypto",
  stocks: "Stocks",
  indices: "Indices",
  commodities: "Commodities",
};

export const SESSIONS = ["asian", "london", "overlap", "new_york", "off_hours"] as const;
export type TradingSession = (typeof SESSIONS)[number];

export const SESSION_LABEL: Record<TradingSession, string> = {
  asian: "Asian",
  london: "London",
  overlap: "London / NY overlap",
  new_york: "New York",
  off_hours: "Off hours",
};

export type QuantityUnit = "lots" | "units" | "shares" | "contracts";

export interface InstrumentSpec {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  /** Currency the price is quoted in. */
  quote: string;
  /** Base currency for FX pairs (used to derive conversion rates). */
  base?: string;
  /** Units per 1.0 quantity (e.g. 100,000 per forex lot, 100 oz per gold lot). */
  contractSize: number;
  /** Smallest meaningful price increment. */
  tickSize: number;
  /** Pip size for forex (0.0001, or 0.01 for JPY quotes). */
  pipSize?: number;
  unit: QuantityUnit;
  qtyStep: number;
}

const fx = (symbol: string, name: string): InstrumentSpec => {
  const base = symbol.slice(0, 3);
  const quote = symbol.slice(3, 6);
  const pip = quote === "JPY" ? 0.01 : 0.0001;
  return { symbol, name, assetClass: "forex", base, quote, contractSize: 100_000, tickSize: pip / 10, pipSize: pip, unit: "lots", qtyStep: 0.01 };
};

/**
 * Futures express tick value as contract_size = tick value / tick size
 * (the account-currency value of a 1.0 price move per contract).
 */
const future = (symbol: string, name: string, assetClass: AssetClass, tickSize: number, tickValue: number, quote = "USD"): InstrumentSpec => ({
  symbol, name, assetClass, quote, contractSize: tickValue / tickSize, tickSize, unit: "contracts", qtyStep: 1,
});

export const INSTRUMENTS: InstrumentSpec[] = [
  fx("EURUSD", "Euro / US Dollar"),
  fx("GBPUSD", "British Pound / US Dollar"),
  fx("AUDUSD", "Australian Dollar / US Dollar"),
  fx("NZDUSD", "New Zealand Dollar / US Dollar"),
  fx("USDJPY", "US Dollar / Japanese Yen"),
  fx("USDCHF", "US Dollar / Swiss Franc"),
  fx("USDCAD", "US Dollar / Canadian Dollar"),
  fx("EURJPY", "Euro / Japanese Yen"),
  fx("GBPJPY", "British Pound / Japanese Yen"),
  fx("EURGBP", "Euro / British Pound"),
  fx("AUDJPY", "Australian Dollar / Japanese Yen"),
  fx("EURCHF", "Euro / Swiss Franc"),
  { symbol: "BTCUSD", name: "Bitcoin", assetClass: "crypto", quote: "USD", contractSize: 1, tickSize: 0.01, unit: "units", qtyStep: 0.0001 },
  { symbol: "ETHUSD", name: "Ether", assetClass: "crypto", quote: "USD", contractSize: 1, tickSize: 0.01, unit: "units", qtyStep: 0.001 },
  { symbol: "SOLUSD", name: "Solana", assetClass: "crypto", quote: "USD", contractSize: 1, tickSize: 0.001, unit: "units", qtyStep: 0.01 },
  { symbol: "XRPUSD", name: "XRP", assetClass: "crypto", quote: "USD", contractSize: 1, tickSize: 0.0001, unit: "units", qtyStep: 1 },
  { symbol: "AAPL", name: "Apple Inc.", assetClass: "stocks", quote: "USD", contractSize: 1, tickSize: 0.01, unit: "shares", qtyStep: 1 },
  { symbol: "MSFT", name: "Microsoft Corp.", assetClass: "stocks", quote: "USD", contractSize: 1, tickSize: 0.01, unit: "shares", qtyStep: 1 },
  { symbol: "NVDA", name: "NVIDIA Corp.", assetClass: "stocks", quote: "USD", contractSize: 1, tickSize: 0.01, unit: "shares", qtyStep: 1 },
  { symbol: "TSLA", name: "Tesla Inc.", assetClass: "stocks", quote: "USD", contractSize: 1, tickSize: 0.01, unit: "shares", qtyStep: 1 },
  { symbol: "AMZN", name: "Amazon.com Inc.", assetClass: "stocks", quote: "USD", contractSize: 1, tickSize: 0.01, unit: "shares", qtyStep: 1 },
  { symbol: "META", name: "Meta Platforms", assetClass: "stocks", quote: "USD", contractSize: 1, tickSize: 0.01, unit: "shares", qtyStep: 1 },
  { symbol: "SPY", name: "SPDR S&P 500 ETF", assetClass: "stocks", quote: "USD", contractSize: 1, tickSize: 0.01, unit: "shares", qtyStep: 1 },
  { symbol: "QQQ", name: "Invesco QQQ ETF", assetClass: "stocks", quote: "USD", contractSize: 1, tickSize: 0.01, unit: "shares", qtyStep: 1 },
  { symbol: "US30", name: "Dow Jones 30 (CFD)", assetClass: "indices", quote: "USD", contractSize: 1, tickSize: 0.1, unit: "lots", qtyStep: 0.1 },
  { symbol: "NAS100", name: "Nasdaq 100 (CFD)", assetClass: "indices", quote: "USD", contractSize: 1, tickSize: 0.1, unit: "lots", qtyStep: 0.1 },
  { symbol: "SPX500", name: "S&P 500 (CFD)", assetClass: "indices", quote: "USD", contractSize: 1, tickSize: 0.1, unit: "lots", qtyStep: 0.1 },
  { symbol: "GER40", name: "DAX 40 (CFD)", assetClass: "indices", quote: "EUR", contractSize: 1, tickSize: 0.1, unit: "lots", qtyStep: 0.1 },
  { symbol: "UK100", name: "FTSE 100 (CFD)", assetClass: "indices", quote: "GBP", contractSize: 1, tickSize: 0.1, unit: "lots", qtyStep: 0.1 },
  future("ES", "E-mini S&P 500 future", "indices", 0.25, 12.5),
  future("MES", "Micro E-mini S&P 500 future", "indices", 0.25, 1.25),
  future("NQ", "E-mini Nasdaq-100 future", "indices", 0.25, 5),
  future("MNQ", "Micro E-mini Nasdaq-100 future", "indices", 0.25, 0.5),
  future("YM", "E-mini Dow future", "indices", 1, 5),
  { symbol: "XAUUSD", name: "Gold spot", assetClass: "commodities", quote: "USD", contractSize: 100, tickSize: 0.01, unit: "lots", qtyStep: 0.01 },
  { symbol: "XAGUSD", name: "Silver spot", assetClass: "commodities", quote: "USD", contractSize: 5000, tickSize: 0.001, unit: "lots", qtyStep: 0.01 },
  { symbol: "USOIL", name: "WTI crude oil (CFD)", assetClass: "commodities", quote: "USD", contractSize: 1000, tickSize: 0.01, unit: "lots", qtyStep: 0.01 },
  future("CL", "Crude oil future", "commodities", 0.01, 10),
  future("GC", "Gold future", "commodities", 0.1, 10),
];

const BY_SYMBOL = new Map(INSTRUMENTS.map((i) => [i.symbol, i]));

export function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s/]/g, "");
}

const FIAT = new Set(["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "SEK", "NOK", "DKK", "SGD", "HKD", "ZAR", "MXN", "INR", "CNH", "TRY", "PLN"]);

/** Best-effort spec for any symbol: catalogue first, then sensible per-class defaults. */
export function resolveInstrument(rawSymbol: string, assetClass?: AssetClass): InstrumentSpec {
  const symbol = normalizeSymbol(rawSymbol);
  const known = BY_SYMBOL.get(symbol);
  if (known && (!assetClass || known.assetClass === assetClass)) return known;
  const cls: AssetClass = assetClass ?? guessAssetClass(symbol);
  if (cls === "forex" && /^[A-Z]{6}$/.test(symbol)) return fx(symbol, symbol);
  if (cls === "crypto") {
    const m = symbol.match(/(USDT|USDC|USD|EUR|GBP)$/);
    const quote = m ? (m[1].startsWith("USD") ? "USD" : m[1]) : "USD";
    return { symbol, name: symbol, assetClass: cls, quote, contractSize: 1, tickSize: 0.0001, unit: "units", qtyStep: 0.0001 };
  }
  return {
    symbol, name: symbol, assetClass: cls, quote: "USD", contractSize: 1, tickSize: 0.01,
    unit: cls === "stocks" ? "shares" : cls === "forex" ? "lots" : "lots", qtyStep: cls === "stocks" ? 1 : 0.01,
  };
}

export function guessAssetClass(symbol: string): AssetClass {
  const s = normalizeSymbol(symbol);
  const known = BY_SYMBOL.get(s);
  if (known) return known.assetClass;
  if (/^(XAU|XAG|XPT|XPD|USOIL|UKOIL|WTI|BRENT|NATGAS|CL|GC|SI|NG|HG)/.test(s)) return "commodities";
  if (/^(BTC|ETH|SOL|XRP|ADA|DOGE|BNB|DOT|AVAX|LINK|LTC|MATIC|TON)/.test(s)) return "crypto";
  if (/^[A-Z]{6}$/.test(s) && FIAT.has(s.slice(0, 3)) && FIAT.has(s.slice(3))) return "forex";
  if (/^(US30|US500|SPX|NAS|NDX|GER|DE40|UK100|JPN|JP225|HK50|AUS200|ES|NQ|YM|RTY|MES|MNQ)/.test(s)) return "indices";
  return "stocks";
}

/**
 * Account-currency value of one unit of the quote currency.
 * Returns null when it can't be derived from the trade itself
 * (cross rates need a user-supplied rate).
 */
export function deriveFxRate(spec: Pick<InstrumentSpec, "quote" | "base">, accountCurrency: string, price: number | null | undefined): number | null {
  if (spec.quote === accountCurrency) return 1;
  if (spec.base && spec.base === accountCurrency && price && price > 0) return 1 / price;
  return null;
}

/**
 * Trading session by UTC hour of entry.
 * Asian 22:00–07:00, London 07:00–12:00, London/NY overlap 12:00–16:00,
 * New York 16:00–21:00, off hours 21:00–22:00.
 */
export function detectSession(date: Date): TradingSession {
  const h = date.getUTCHours();
  if (h >= 22 || h < 7) return "asian";
  if (h < 12) return "london";
  if (h < 16) return "overlap";
  if (h < 21) return "new_york";
  return "off_hours";
}

export const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "INR", "SGD", "HKD", "ZAR"] as const;
