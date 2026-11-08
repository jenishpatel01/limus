"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy as CopyIcon, FileUp, RotateCcw, Upload, XCircle } from "lucide-react";
import { useData } from "@/lib/data/store";
import { api } from "@/lib/data/api";
import type { ImportRecord, Trade } from "@/lib/types";
import { FIELDS, MAX_ROWS, PROFILES, TEMPLATE_CSV, parseCsv, validateRows, type DateOrder, type Mapping, type PreviewRow } from "@/lib/import/csv";
import { dayKey } from "@/lib/dates";
import { dateTime, money, num, price, relativeTime } from "@/lib/format";
import { download } from "@/lib/reports/csv";
import { Badge, Button, Card, CardHeader, Checkbox, ConfirmDialog, Field, Notice, PageHeader, Segmented, Select, cx, toast } from "@/components/ui";

type Step = "upload" | "map" | "preview" | "done";
const STEPS: { id: Step; label: string }[] = [{ id: "upload", label: "Upload" }, { id: "map", label: "Map columns" }, { id: "preview", label: "Preview & validate" }, { id: "done", label: "Import" }];

export function ImportPage() {
  const data = useData();
  const { accounts, scope, scopedAccounts, trades, tz, user, imports, addImported, upsertImport, notify, deleteTrades } = data;
  const importable = accounts.filter((a) => a.status !== "archived");
  const [step, setStep] = useState<Step>("upload");
  const [accountId, setAccountId] = useState(scope.kind === "account" ? scopedAccounts[0]?.id ?? "" : importable.find((a) => !a.is_demo)?.id ?? "");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [dateOrder, setDateOrder] = useState<DateOrder>("auto");
  const [timeZone, setTimeZone] = useState<"user" | "UTC">("user");
  const [decimalComma, setDecimalComma] = useState(false);
  const [filter, setFilter] = useState<"all" | "ok" | "duplicate" | "error">("all");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportRecord | null>(null);
  const [undo, setUndo] = useState<ImportRecord | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const account = accounts.find((a) => a.id === accountId);

  const preview: PreviewRow[] = useMemo(() => {
    if (step !== "preview" && step !== "done") return [];
    if (!account) return [];
    return validateRows(rows, mapping, { accountId: account.id, accountCurrency: account.currency, tz: timeZone === "UTC" ? "UTC" : tz, dateOrder, decimalComma, existing: trades });
  }, [step, rows, mapping, account, tz, timeZone, dateOrder, decimalComma, trades]);
  const counts = { ok: preview.filter((r) => r.status === "ok").length, duplicate: preview.filter((r) => r.status === "duplicate").length, error: preview.filter((r) => r.status === "error").length };
  const missingRequired = FIELDS.filter((f) => f.required && !mapping[f.key]);

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (!/\.(csv|txt|tsv)$/i.test(f.name) && !/text|csv/.test(f.type)) return toast("Please choose a .csv file", "error");
    if (f.size > 5 * 1024 * 1024) return toast("File is larger than 5 MB", "error");
    const text = await f.text();
    const parsed = parseCsv(text);
    if (!parsed.headers.length || !parsed.rows.length) return toast("No rows found. Does the file have a header row?", "error");
    setFileName(f.name);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setParseErrors(parsed.errors);
    const best = [...PROFILES].sort((a, b) => b.detect(parsed.headers) - a.detect(parsed.headers))[0];
    setMapping(best.map(parsed.headers));
    setDateOrder(best.dateOrder);
    setStep("map");
  }

  async function runImport() {
    if (!account) return;
    const ok = preview.filter((r) => r.status === "ok" && r.trade);
    if (!ok.length) return;
    setImporting(true);
    let record: ImportRecord | null = null;
    try {
      record = await api.createImport({ user_id: user.id, account_id: account.id, file_name: fileName.slice(0, 255), profile: "generic", total_rows: preview.length, imported_rows: 0, duplicate_rows: counts.duplicate, error_rows: counts.error, mapping: mapping as Record<string, string>, status: "failed" });
      const inserted = await api.insertTrades(ok.map((r) => ({ ...r.trade!, user_id: user.id, import_id: record!.id })));
      const byFp = new Map(inserted.map((t) => [t.fingerprint, t]));
      const journals = await api.insertJournals(ok.filter((r) => r.notes).flatMap((r) => {
        const t = byFp.get(r.trade!.fingerprint ?? null);
        return t ? [{ user_id: user.id, trade_id: t.id, kind: "trade" as const, entry_date: dayKey(t.entry_at, tz), notes: r.notes }] : [];
      }));
      const status = inserted.length === preview.length ? "completed" : "partial";
      record = await api.updateImport(record.id, { imported_rows: inserted.length, status });
      addImported(inserted, journals, record);
      setResult(record);
      setStep("done");
      toast(`Imported ${inserted.length} trade${inserted.length === 1 ? "" : "s"}`);
      void notify({ kind: "import", title: `Imported ${inserted.length} trades into ${account.name}`, body: `${fileName}: ${counts.duplicate} duplicates and ${counts.error} errors skipped.`, link: "/app/import" }).catch(() => undefined);
    } catch (e) {
      if (record) upsertImport(record);
      toast(e instanceof Error ? e.message : "Import failed", "error");
    } finally { setImporting(false); }
  }

  function reset() {
    setStep("upload"); setFileName(""); setHeaders([]); setRows([]); setMapping({}); setResult(null); setFilter("all");
    if (fileRef.current) fileRef.current.value = "";
  }

  const shown = preview.filter((r) => filter === "all" || r.status === filter).slice(0, 200);
  const sample = (h: string | undefined) => (h ? rows.slice(0, 3).map((r) => r[h]).filter(Boolean).join(" · ") : "");

  return (
    <>
      <PageHeader title="Import trades" icon={<Upload />} description="Bring in your trade history from any CSV export." />

      <ol className="mb-6 flex flex-wrap gap-2 text-[13px]" aria-label="Import steps">
        {STEPS.map((s, i) => {
          const idx = STEPS.findIndex((x) => x.id === step);
          return (
            <li key={s.id} className={cx("flex items-center gap-2 rounded-full px-3 py-1", i === idx ? "bg-primary-soft text-primary-text" : i < idx ? "text-ink-3" : "text-faint")}>
              <span className={cx("flex size-5 items-center justify-center rounded-full text-[11px] font-medium", i < idx ? "bg-profit text-white" : i === idx ? "bg-primary text-white" : "bg-muted-bg")}>{i < idx ? "✓" : i + 1}</span>{s.label}
            </li>
          );
        })}
      </ol>

      {step === "upload" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="p-5">
            <Field label="Import into account" htmlFor="imp-acc">
              <Select id="imp-acc" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">Choose an account…</option>
                {importable.map((a) => <option key={a.id} value={a.id}>{a.name}{a.is_demo ? " (demo)" : ""} · {a.currency}</option>)}
              </Select>
            </Field>
            <label onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (accountId) void onFile(e.dataTransfer.files[0]); }}
              className={cx("mt-5 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-strong bg-subtle px-6 py-14 text-center transition-colors hover:bg-muted-bg", !accountId && "pointer-events-none opacity-50")}>
              <FileUp className="size-6 text-muted" />
              <span className="text-[14.5px] font-medium">Drop a CSV file here, or click to browse</span>
              <span className="text-[12.5px] text-muted">Up to 5 MB and {MAX_ROWS.toLocaleString()} rows. One row per trade, with a header row.</span>
              <input ref={fileRef} type="file" accept=".csv,.txt,.tsv,text/csv" className="sr-only" disabled={!accountId} onChange={(e) => void onFile(e.target.files?.[0])} />
            </label>
            {!importable.length && <Notice tone="warn" className="mt-4">Create a trading account first. <Link href="/app/portfolio?new=1" className="text-primary-text underline">New account</Link></Notice>}
          </Card>
          <Card className="p-5 text-[13px] leading-relaxed text-body">
            <h3 className="text-[14px] font-medium text-ink">How it works</h3>
            <ul className="mt-2 list-disc space-y-1.5 pl-4">
              <li>Columns are matched automatically. You can change any match.</li>
              <li>Every row is validated before anything is saved.</li>
              <li>Trades already in the account are detected by ticket ID, or by symbol, side, entry time, price and size, and skipped.</li>
              <li>If your file has a profit column, it&apos;s used as gross P&amp;L; otherwise P&amp;L is calculated from prices.</li>
            </ul>
            <Button size="sm" className="mt-4" icon={<CopyIcon className="size-3.5" />} onClick={() => download("limus-import-template.csv", TEMPLATE_CSV)}>Download template</Button>
            <p className="mt-4 text-[12px] text-muted">Today there&apos;s one generic CSV format. Broker-specific formats (MT4/MT5, cTrader and others) aren&apos;t built yet. Export to CSV and map the columns.</p>
          </Card>
        </div>
      )}

      {step === "map" && (
        <Card>
          <CardHeader title={`Map columns · ${fileName}`} subtitle={`${rows.length.toLocaleString()} rows, ${headers.length} columns${rows.length > MAX_ROWS ? `. Only the first ${MAX_ROWS.toLocaleString()} rows will be imported.` : ""}`} />
          {parseErrors.length > 0 && <Notice tone="warn" className="mx-5 mt-4">Some lines couldn&apos;t be read: {parseErrors.join("; ")}</Notice>}
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {FIELDS.map((f) => (
              <Field key={f.key} label={<>{f.label}{f.required && <span className="text-loss"> *</span>}</>} htmlFor={`map-${f.key}`} hint={sample(mapping[f.key]) || f.hint}>
                <Select id={`map-${f.key}`} value={mapping[f.key] ?? ""} aria-invalid={f.required && !mapping[f.key]} onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value || undefined })}>
                  <option value="">{f.required ? "Choose a column…" : "Not in file"}</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </Select>
              </Field>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 border-t border-line p-5 md:grid-cols-3">
            <Field label="Date order" hint="For ambiguous dates like 03/04/2026."><Segmented size="md" ariaLabel="Date order" value={dateOrder} onChange={setDateOrder} options={[{ value: "auto", label: "Auto" }, { value: "dmy", label: "DD/MM" }, { value: "mdy", label: "MM/DD" }]} /></Field>
            <Field label="Times in the file are in"><Segmented size="md" ariaLabel="Timezone" value={timeZone} onChange={setTimeZone} options={[{ value: "user", label: tz.replace(/_/g, " ") }, { value: "UTC", label: "UTC" }]} /></Field>
            <Field label="Number format"><Checkbox checked={decimalComma} onChange={setDecimalComma} label="Comma is the decimal separator (1.234,56)" /></Field>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
            <Button variant="ghost" onClick={reset}>Start over</Button>
            <div className="flex items-center gap-3">
              {missingRequired.length > 0 && <span className="text-[12.5px] text-loss">Map: {missingRequired.map((f) => f.label).join(", ")}</span>}
              <Button variant="primary" disabled={missingRequired.length > 0} onClick={() => setStep("preview")}>Preview</Button>
            </div>
          </div>
        </Card>
      )}

      {step === "preview" && account && (
        <Card>
          <CardHeader title="Preview & validate" subtitle={`Into ${account.name} (${account.currency}). Nothing is saved until you confirm.`} />
          <div className="flex flex-wrap gap-2 px-5 pt-4">
            <Segmented size="md" ariaLabel="Filter rows" value={filter} onChange={setFilter} options={[
              { value: "all", label: `All ${preview.length}` }, { value: "ok", label: <span className="text-profit">Ready {counts.ok}</span> },
              { value: "duplicate", label: <span className="text-warn">Duplicates {counts.duplicate}</span> }, { value: "error", label: <span className="text-loss">Errors {counts.error}</span> },
            ]} />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-[12.5px]">
              <thead><tr className="border-y border-line bg-subtle text-left text-muted">
                <th className="px-5 py-2 font-medium">Row</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Symbol</th><th className="px-3 py-2 font-medium">Side</th>
                <th className="px-3 py-2 font-medium">Entry</th><th className="px-3 py-2 text-right font-medium">Size</th><th className="px-3 py-2 text-right font-medium">Entry px</th><th className="px-3 py-2 text-right font-medium">Exit px</th><th className="px-5 py-2 font-medium">Notes</th>
              </tr></thead>
              <tbody className="rows-in">
                {shown.map((r) => (
                  <tr key={r.index} className="row-hover border-b border-line last:border-0 align-top">
                    <td className="px-5 py-2 text-muted">{r.index + 2}</td>
                    <td className="px-3 py-2">{r.status === "ok" ? <Badge tone="profit"><CheckCircle2 className="size-3" />Ready</Badge> : r.status === "duplicate" ? <Badge tone="warn">Duplicate</Badge> : <Badge tone="loss"><XCircle className="size-3" />Error</Badge>}</td>
                    <td className="px-3 py-2 font-medium">{r.trade?.symbol ?? rows[r.index]?.[mapping.symbol ?? ""] ?? "—"}</td>
                    <td className="px-3 py-2">{r.trade ? (r.trade.direction === "long" ? "Buy" : "Sell") : "—"}</td>
                    <td className="px-3 py-2 text-muted">{r.trade?.entry_at ? dateTime(r.trade.entry_at, tz) : "—"}</td>
                    <td className="tnum px-3 py-2 text-right">{num(r.trade?.quantity ?? null, 6)}</td>
                    <td className="tnum px-3 py-2 text-right">{price(r.trade?.entry_price ?? null)}</td>
                    <td className="tnum px-3 py-2 text-right">{price(r.trade?.exit_price ?? null)}</td>
                    <td className="max-w-[320px] px-5 py-2">
                      {r.errors.map((e) => <p key={e} className={r.status === "error" ? "text-loss" : "text-warn"}>{e}</p>)}
                      {r.warnings.map((w) => <p key={w} className="flex items-start gap-1 text-muted"><AlertTriangle className="mt-0.5 size-3 shrink-0" />{w}</p>)}
                      {r.trade?.pnl_source === "reported" && <p className="text-muted">Gross P&amp;L from file: {money(r.trade.gross_pnl ?? null, account.currency)}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.filter((r) => filter === "all" || r.status === filter).length > 200 && <p className="px-5 py-3 text-[12px] text-muted">Showing the first 200 rows.</p>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
            <Button variant="ghost" onClick={() => setStep("map")}>Back to mapping</Button>
            <div className="flex items-center gap-3">
              <span className="text-[12.5px] text-muted">{counts.duplicate + counts.error > 0 ? `${counts.duplicate + counts.error} rows will be skipped.` : "All rows are valid."}</span>
              <Button variant="primary" disabled={!counts.ok} loading={importing} onClick={runImport}>Import {counts.ok} trade{counts.ok === 1 ? "" : "s"}</Button>
            </div>
          </div>
        </Card>
      )}

      {step === "done" && result && (
        <Card className="p-8 text-center">
          <CheckCircle2 className="mx-auto size-10 text-profit" />
          <h2 className="mt-3 text-[22px] font-medium tracking-[-0.03em]">{result.imported_rows} trade{result.imported_rows === 1 ? "" : "s"} imported</h2>
          <p className="mt-1 text-[14px] text-muted">{result.duplicate_rows} duplicate{result.duplicate_rows === 1 ? "" : "s"} and {result.error_rows} row{result.error_rows === 1 ? "" : "s"} with errors were skipped.</p>
          <div className="mt-6 flex justify-center gap-2"><Button onClick={reset}>Import another file</Button><Link href="/app/journal" className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-[14px] font-semibold text-white">View journal</Link></div>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader title="Import history" />
        <ul className="px-5 pb-4 pt-2">
          {imports.length === 0 ? <li className="py-4 text-[13px] text-muted">No imports yet.</li> : imports.map((r) => {
            const acc = accounts.find((a) => a.id === r.account_id);
            const live = trades.filter((t) => t.import_id === r.id).length;
            return (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 last:border-0">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium">{r.file_name} <Badge tone={r.status === "completed" ? "profit" : r.status === "partial" ? "warn" : "loss"}>{r.status}</Badge></p>
                  <p className="text-[12px] text-muted">{relativeTime(r.created_at)} · {acc?.name ?? "Deleted account"} · {r.imported_rows} imported, {r.duplicate_rows} duplicates, {r.error_rows} errors of {r.total_rows} rows</p>
                </div>
                {live > 0 && <Button size="sm" icon={<RotateCcw className="size-3.5" />} onClick={() => setUndo(r)}>Undo ({live})</Button>}
              </li>
            );
          })}
        </ul>
      </Card>
      <ConfirmDialog open={Boolean(undo)} onClose={() => setUndo(null)} title="Undo this import?" confirmLabel="Delete imported trades"
        description={`This deletes the ${undo ? trades.filter((t) => t.import_id === undo.id).length : 0} trades created by ${undo?.file_name ?? "this import"}, including any notes or screenshots added to them since.`}
        onConfirm={async () => {
          if (!undo) return;
          try { await deleteTrades(trades.filter((t: Trade) => t.import_id === undo.id).map((t) => t.id)); toast("Import undone"); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't undo", "error"); }
          setUndo(null);
        }} />
    </>
  );
}
