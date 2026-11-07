import { describe, expect, it } from "vitest";
import { autoMap, parseCsv, parseDateTime, parseDirection, parseNumber, TEMPLATE_CSV, validateRows, tradeFingerprint } from "@/lib/import/csv";
import { safeCell } from "@/lib/reports/csv";

const ACC = "11111111-2222-3333-4444-555555555555";

describe("parsing helpers", () => {
  it("numbers in many formats", () => {
    expect(parseNumber("1,234.56")).toBe(1234.56);
    expect(parseNumber("$-12.50")).toBe(-12.5);
    expect(parseNumber("(45.00)")).toBe(-45);
    expect(parseNumber("1.234,56", true)).toBe(1234.56);
    expect(parseNumber("12,5")).toBe(12.5);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
  });

  it("directions", () => {
    expect(parseDirection("Buy")).toBe("long");
    expect(parseDirection("SELL LIMIT")).toBe("short");
    expect(parseDirection("long")).toBe("long");
    expect(parseDirection("x")).toBeNull();
  });

  it("dates in the user's timezone", () => {
    expect(parseDateTime("2026-10-01 09:15", "auto", "UTC")).toBe("2026-10-01T09:15:00.000Z");
    expect(parseDateTime("2026.10.01 09:15:30", "auto", "UTC")).toBe("2026-10-01T09:15:30.000Z");
    expect(parseDateTime("2026-10-01 09:15", "auto", "Asia/Kolkata")).toBe("2026-10-01T03:45:00.000Z");
    expect(parseDateTime("13/02/2026 10:00", "auto", "UTC")).toBe("2026-02-13T10:00:00.000Z");
    expect(parseDateTime("02/13/2026 10:00", "auto", "UTC")).toBe("2026-02-13T10:00:00.000Z");
    expect(parseDateTime("03/04/2026", "mdy", "UTC")).toBe("2026-03-04T00:00:00.000Z");
    expect(parseDateTime("03/04/2026", "dmy", "UTC")).toBe("2026-04-03T00:00:00.000Z");
    expect(parseDateTime("1/2/26 3:05 pm", "mdy", "UTC")).toBe("2026-01-02T15:05:00.000Z");
    expect(parseDateTime("2026-10-01T09:15:00Z", "auto", "Asia/Kolkata")).toBe("2026-10-01T09:15:00.000Z");
    expect(parseDateTime("31/31/2026", "auto", "UTC")).toBeNull();
    expect(parseDateTime("yesterday", "auto", "UTC")).toBeNull();
  });
});

describe("column mapping", () => {
  it("maps common headers automatically", () => {
    const m = autoMap(["Ticket", "Open Time", "Type", "Volume", "Symbol", "Open Price", "S/L", "T/P", "Close Time", "Close Price", "Commission", "Swap", "Profit"]);
    expect(m).toMatchObject({ symbol: "Symbol", direction: "Type", entry_time: "Open Time", entry_price: "Open Price", quantity: "Volume", exit_time: "Close Time", exit_price: "Close Price", stop_loss: "S/L", take_profit: "T/P", commission: "Commission", swap: "Swap", profit: "Profit", external_id: "Ticket" });
  });
});

describe("validation & duplicates", () => {
  const parsed = parseCsv(TEMPLATE_CSV);
  const mapping = autoMap(parsed.headers);
  const opts = { accountId: ACC, accountCurrency: "USD", tz: "UTC", dateOrder: "auto" as const, decimalComma: false, existing: [] };

  it("parses the template file", () => {
    expect(parsed.headers).toContain("symbol");
    expect(parsed.rows).toHaveLength(3);
    const rows = validateRows(parsed.rows, mapping, opts);
    expect(rows.map((r) => r.status)).toEqual(["ok", "ok", "ok"]);
    expect(rows[0].trade).toMatchObject({ symbol: "EURUSD", direction: "long", status: "closed", contract_size: 100000, fx_rate: 1, commission: 3.5, tags: ["london", "breakout"] });
    expect(rows[1].trade).toMatchObject({ asset_class: "commodities", contract_size: 100, direction: "short" });
    expect(rows[2].trade).toMatchObject({ asset_class: "stocks", quantity: 50 });
  });

  it("flags duplicates within the file and against existing trades", () => {
    const twice = parseCsv(TEMPLATE_CSV + TEMPLATE_CSV.split("\n").slice(1).join("\n"));
    const rows = validateRows(twice.rows, mapping, opts);
    expect(rows.filter((r) => r.status === "duplicate")).toHaveLength(3);
    const first = validateRows(parsed.rows, mapping, opts);
    const existing = first.map((r) => ({ ...(r.trade as Record<string, unknown>), account_id: ACC, fingerprint: r.trade!.fingerprint ?? null })) as never[];
    const again = validateRows(parsed.rows, mapping, { ...opts, existing });
    expect(again.every((r) => r.status === "duplicate")).toBe(true);
    const otherAccount = validateRows(parsed.rows, mapping, { ...opts, accountId: "99999999-0000-0000-0000-000000000000", existing });
    expect(otherAccount.every((r) => r.status === "ok")).toBe(true);
  });

  it("reports row errors clearly", () => {
    const bad = parseCsv("symbol,direction,entry_time,entry_price,quantity\nEURUSD,flat,2026-10-01 09:00,1.1,1\n,buy,nope,-1,0\nEURGBP,buy,2026-10-01 09:00,0.85,1");
    const rows = validateRows(bad.rows, autoMap(bad.headers), opts);
    expect(rows[0].status).toBe("error");
    expect(rows[0].errors[0]).toMatch(/direction/);
    expect(rows[1].errors.length).toBeGreaterThanOrEqual(4);
    // EURGBP in a USD account can't be converted without a rate (open trade, so only needed later) → error
    expect(rows[2].status).toBe("error");
    expect(rows[2].errors[0]).toMatch(/conversion rate/);
  });

  it("uses broker profit as gross P&L when mapped", () => {
    const f = parseCsv("Symbol,Type,Open Time,Open Price,Volume,Close Time,Close Price,Commission,Profit\nEURGBP,buy,2026-10-01 09:00,0.85,1,2026-10-01 10:00,0.851,-7,117.40");
    const rows = validateRows(f.rows, autoMap(f.headers), opts);
    expect(rows[0].status).toBe("ok");
    expect(rows[0].trade).toMatchObject({ pnl_source: "reported", gross_pnl: 117.4, commission: 7, fx_rate: 1 });
  });

  it("fingerprints are stable", () => {
    const t = { account_id: ACC, symbol: "eurusd", direction: "long", entry_at: "2026-10-01T09:15:00Z", entry_price: 1.085, quantity: 0.5 };
    expect(tradeFingerprint(t)).toBe(tradeFingerprint({ ...t, symbol: "EURUSD", entry_at: "2026-10-01T09:15:00.000Z" }));
  });
});

describe("CSV export safety", () => {
  it("neutralises formula injection", () => {
    expect(safeCell("=HYPERLINK(\"x\")")).toBe("'=HYPERLINK(\"x\")");
    expect(safeCell("+cmd")).toBe("'+cmd");
    expect(safeCell("-12.5")).toBe("-12.5");
    expect(safeCell(-3)).toBe(-3);
    expect(safeCell("EURUSD")).toBe("EURUSD");
  });
});
