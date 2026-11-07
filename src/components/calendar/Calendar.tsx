"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, NotebookPen, Plus } from "lucide-react";
import { useData } from "@/lib/data/store";
import { dailyPnl } from "@/lib/engine/metrics";
import { dayKey, daysInMonth, weekdayIndex, WEEKDAYS } from "@/lib/dates";
import { dateTime, dayLabel, money, pct, pnlClass, rMult } from "@/lib/format";
import type { JournalEntry } from "@/lib/types";
import { Badge, Button, Card, IconButton, Modal, PageHeader, StatCard, cx, toast } from "@/components/ui";
import { NoteCard, NoteEditor } from "@/components/journal/DailyNotes";

export function CalendarPage() {
  const params = useSearchParams();
  const { scopedTrades, scopedAccounts, journal, tz, currency, deleteJournal } = useData();
  const today = dayKey(new Date(), tz);
  const initialDay = params.get("day");
  const [month, setMonth] = useState((initialDay ?? today).slice(0, 7));
  const [selected, setSelected] = useState<string | null>(initialDay);
  const [note, setNote] = useState<JournalEntry | "new" | null>(null);

  const trades = useMemo(() => scopedTrades.filter((t) => scopedAccounts.find((a) => a.id === t.account_id)?.currency === currency), [scopedTrades, scopedAccounts, currency]);
  const days = useMemo(() => dailyPnl(trades, tz), [trades, tz]);
  const notesByDay = useMemo(() => {
    const m = new Map<string, JournalEntry[]>();
    for (const j of journal) if (!j.trade_id) m.set(j.entry_date, [...(m.get(j.entry_date) ?? []), j]);
    return m;
  }, [journal]);

  const [y, mo] = month.split("-").map(Number);
  const first = `${month}-01`;
  const count = daysInMonth(y, mo);
  const lead = weekdayIndex(first);
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  const monthDays = [...days.values()].filter((d) => d.day.startsWith(month));
  const mNet = monthDays.reduce((a, d) => a + d.pnl, 0);
  const mTrades = monthDays.reduce((a, d) => a + d.trades, 0);
  const mWins = monthDays.reduce((a, d) => a + d.wins, 0);
  const mLosses = monthDays.reduce((a, d) => a + d.losses, 0);
  const green = monthDays.filter((d) => d.pnl > 0).length;
  const red = monthDays.filter((d) => d.pnl < 0).length;
  const best = monthDays.reduce<typeof monthDays[number] | null>((b, d) => (!b || d.pnl > b.pnl ? d : b), null);
  const worst = monthDays.reduce<typeof monthDays[number] | null>((b, d) => (!b || d.pnl < b.pnl ? d : b), null);
  const maxAbs = Math.max(...monthDays.map((d) => Math.abs(d.pnl)), 1);

  const shift = (n: number) => { const d = new Date(Date.UTC(y, mo - 1 + n, 1)); setMonth(d.toISOString().slice(0, 7)); };

  return (
    <>
      <PageHeader title="Calendar" icon={<CalendarDays />} description={`Realised P&L by close day in ${tz.replace(/_/g, " ")}.`}
        actions={<Button icon={<NotebookPen className="size-4" />} onClick={() => setNote("new")}>New note</Button>} />

      <div className="stagger mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={`Net P&L · ${dayLabel(first, { month: "long", year: "numeric" })}`} value={money(mNet, currency, { sign: true })} tone={mNet > 0 ? "profit" : mNet < 0 ? "loss" : null} />
        <StatCard label="Trades" value={mTrades} sub={<><span className="text-profit">{mWins}W</span> · <span className="text-loss">{mLosses}L</span></>} />
        <StatCard label="Win rate" value={pct(mTrades ? (mWins / mTrades) * 100 : null)} sub={`${green} green · ${red} red days`} />
        <StatCard label="Best / worst day" value={best ? money(best.pnl, currency, { compact: true, sign: true }) : "—"} tone={best && best.pnl > 0 ? "profit" : null} sub={worst ? <span className="text-loss">{money(worst.pnl, currency, { compact: true })}</span> : undefined} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex items-center gap-1">
            <IconButton label="Previous month" onClick={() => shift(-1)}><ChevronLeft className="size-4" /></IconButton>
            <h2 className="min-w-36 text-center text-[15px] font-medium tracking-[-0.02em]">{dayLabel(first, { month: "long", year: "numeric" })}</h2>
            <IconButton label="Next month" onClick={() => shift(1)}><ChevronRight className="size-4" /></IconButton>
          </div>
          <Button size="sm" onClick={() => { setMonth(today.slice(0, 7)); setSelected(today); }}>Today</Button>
        </div>
        <div className="overflow-x-auto">
          <div className="stagger min-w-[720px]">
            <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_minmax(0,0.9fr)] border-b border-line bg-subtle text-[12px] text-muted">
              {WEEKDAYS.map((d) => <div key={d} className="px-3 py-2 font-medium">{d}</div>)}
              <div className="px-3 py-2 text-right font-medium">Week</div>
            </div>
            {weeks.map((w, i) => {
              const wk = w.filter(Boolean).map((d) => days.get(d!)).filter(Boolean);
              const wNet = wk.reduce((a, d) => a + d!.pnl, 0);
              const wTrades = wk.reduce((a, d) => a + d!.trades, 0);
              return (
                <div key={i} className="grid grid-cols-[repeat(7,minmax(0,1fr))_minmax(0,0.9fr)] border-b border-line last:border-0">
                  {w.map((d, j) => {
                    if (!d) return <div key={j} className="min-h-24 border-r border-line bg-subtle/60" />;
                    const b = days.get(d);
                    const hasNote = notesByDay.has(d);
                    const intensity = b ? 0.08 + (Math.abs(b.pnl) / maxAbs) * 0.22 : 0;
                    return (
                      <button key={d} type="button" onClick={() => setSelected(d)} aria-pressed={selected === d}
                        aria-label={`${dayLabel(d)}${b ? `, ${money(b.pnl, currency)}, ${b.trades} trades` : ", no trades"}`}
                        className={cx("relative flex min-h-24 flex-col border-r border-line p-2 text-left transition-shadow hover:z-10 hover:shadow-[inset_0_0_0_1px_var(--line-strong)]",
                          selected === d && "z-10 shadow-[inset_0_0_0_2px_var(--primary)]")}
                        style={b && b.pnl !== 0 ? { background: `color-mix(in oklab, ${b.pnl > 0 ? "var(--profit)" : "var(--loss)"} ${Math.round(intensity * 100)}%, var(--surface))` } : undefined}>
                        <span className="flex w-full items-center justify-between">
                          <span className={cx("text-[12px]", d === today ? "flex size-5 items-center justify-center rounded-full bg-primary font-medium text-white" : "text-muted")}>{Number(d.slice(8))}</span>
                          {hasNote && <NotebookPen className="size-3 text-primary-text" aria-label="Has journal note" />}
                        </span>
                        {b && (
                          <span className="mt-auto">
                            <span className={cx("tnum block text-[13px] font-medium", pnlClass(b.pnl))}>{money(b.pnl, currency, { compact: Math.abs(b.pnl) >= 10000, sign: true })}</span>
                            <span className="block text-[11px] text-muted">{b.trades} trade{b.trades === 1 ? "" : "s"} · {b.wins}W {b.losses}L</span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                  <div className="flex flex-col items-end justify-center px-3 text-right">
                    <span className={cx("tnum text-[13px] font-medium", pnlClass(wNet))}>{wTrades ? money(wNet, currency, { compact: true, sign: true }) : "—"}</span>
                    {wTrades > 0 && <span className="text-[11px] text-muted">{wTrades} trades</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {selected && (
        <DayPanel day={selected} onClose={() => setSelected(null)} trades={trades} notes={notesByDay.get(selected) ?? []}
          onNewNote={() => setNote("new")} onEditNote={setNote}
          onDeleteNote={async (j) => { try { await deleteJournal(j.id); toast("Note deleted"); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't delete", "error"); } }} />
      )}
      {note && <NoteEditor open onClose={() => setNote(null)} entry={note === "new" ? null : note} defaultDate={selected ?? today} />}
    </>
  );
}

function DayPanel({ day, onClose, trades, notes, onNewNote, onEditNote, onDeleteNote }: {
  day: string; onClose: () => void; trades: ReturnType<typeof useData>["trades"]; notes: JournalEntry[];
  onNewNote: () => void; onEditNote: (j: JournalEntry) => void; onDeleteNote: (j: JournalEntry) => void;
}) {
  const { tz, currency, accounts } = useData();
  const closed = trades.filter((t) => t.status === "closed" && t.exit_at && dayKey(t.exit_at, tz) === day);
  const opened = trades.filter((t) => dayKey(t.entry_at, tz) === day && !closed.includes(t));
  const net = closed.reduce((a, t) => a + (t.net_pnl ?? 0), 0);
  const cur = (id: string) => accounts.find((a) => a.id === id)?.currency ?? currency;
  return (
    <Modal open onClose={onClose} size="lg" title={dayLabel(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      description={closed.length ? `${closed.length} closed trade${closed.length === 1 ? "" : "s"} · net ${money(net, currency, { sign: true })}` : "No trades closed on this day"}
      footer={<><Button icon={<Plus className="size-4" />} onClick={onNewNote}>Add note</Button><Button onClick={onClose}>Close</Button></>}>
      <div className="space-y-5">
        <section>
          <h3 className="mb-2 text-[13px] font-medium text-ink-3">Closed trades</h3>
          {closed.length === 0 ? <p className="text-[13px] text-muted">None.</p> : (
            <ul className="divide-y divide-line rounded-lg shadow-[0_0_0_1px_var(--line)]">
              {closed.map((t) => (
                <li key={t.id}>
                  <Link href={`/app/journal/${t.id}`} className="flex items-center justify-between gap-3 px-3 py-2.5 text-[13px] hover:bg-subtle">
                    <span><span className="font-medium">{t.symbol}</span> <Badge tone={t.direction === "long" ? "profit" : "loss"}>{t.direction === "long" ? "Buy" : "Sell"}</Badge><span className="ml-2 text-[12px] text-muted">{dateTime(t.exit_at, tz)}</span></span>
                    <span className="tnum text-right"><span className={cx("font-medium", pnlClass(t.net_pnl))}>{money(t.net_pnl, cur(t.account_id), { sign: true })}</span><span className="ml-2 text-[12px] text-muted">{rMult(t.r_multiple)}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        {opened.length > 0 && (
          <section>
            <h3 className="mb-2 text-[13px] font-medium text-ink-3">Opened this day</h3>
            <ul className="divide-y divide-line rounded-lg shadow-[0_0_0_1px_var(--line)]">
              {opened.map((t) => (
                <li key={t.id}><Link href={`/app/journal/${t.id}`} className="flex justify-between px-3 py-2.5 text-[13px] hover:bg-subtle"><span className="font-medium">{t.symbol} <Badge tone="primary">{t.status}</Badge></span><span className="text-muted">{dateTime(t.entry_at, tz)}</span></Link></li>
              ))}
            </ul>
          </section>
        )}
        <section>
          <h3 className="mb-2 text-[13px] font-medium text-ink-3">Journal notes</h3>
          {notes.length === 0 ? <p className="text-[13px] text-muted">No notes for this day.</p> : <div className="space-y-3">{notes.map((n) => <NoteCard key={n.id} entry={n} onEdit={() => onEditNote(n)} onDelete={() => onDeleteNote(n)} />)}</div>}
        </section>
      </div>
    </Modal>
  );
}

