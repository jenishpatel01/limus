"use client";

import { useState } from "react";
import { NotebookPen, Pencil, Plus, Trash2 } from "lucide-react";
import { useData } from "@/lib/data/store";
import type { JournalEntry, JournalKind } from "@/lib/types";
import { EMOTIONS, MISTAKES } from "@/lib/types";
import { dayKey } from "@/lib/dates";
import { dayLabel } from "@/lib/format";
import { Badge, Button, Card, ChipGroup, ConfirmDialog, EmptyState, Field, IconButton, Input, Modal, Select, Textarea, toast } from "@/components/ui";

export function NoteEditor({ open, onClose, entry, defaultDate }: { open: boolean; onClose: () => void; entry?: JournalEntry | null; defaultDate?: string }) {
  const { saveJournal, tz } = useData();
  const [kind, setKind] = useState<JournalKind>(entry?.kind && entry.kind !== "trade" ? entry.kind : "daily");
  const [date, setDate] = useState(entry?.entry_date ?? defaultDate ?? dayKey(new Date(), tz));
  const [title, setTitle] = useState(entry?.title ?? "");
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [lessons, setLessons] = useState(entry?.lessons ?? "");
  const [emotional, setEmotional] = useState(entry?.emotional_state ?? "");
  const [mistakes, setMistakes] = useState<string[]>(entry?.mistakes ?? []);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!date) return;
    setSaving(true);
    try {
      await saveJournal({ id: entry?.id, kind, entry_date: date, title: title.trim() || null, notes: notes.trim() || null, lessons: lessons.trim() || null, emotional_state: emotional || null, mistakes, trade_id: null });
      toast(entry ? "Note updated" : "Note saved");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save", "error");
    } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={entry ? "Edit note" : "New journal note"} description="Pre-market plans, end-of-day reviews and weekly reflections."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={saving} disabled={!date || (!notes.trim() && !lessons.trim() && !title.trim())} onClick={save}>Save note</Button></>}>
      <div className="grid gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Type" htmlFor="n-kind"><Select id="n-kind" value={kind} onChange={(e) => setKind(e.target.value as JournalKind)}><option value="daily">Daily review</option><option value="weekly">Weekly review</option><option value="note">General note</option></Select></Field>
          <Field label="Date" htmlFor="n-date"><Input id="n-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <Field label="Title" htmlFor="n-title" optional><Input id="n-title" maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Pre-market plan, CPI day" /></Field>
        <Field label="Notes" htmlFor="n-notes"><Textarea id="n-notes" rows={5} maxLength={10000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Market context, what went well, what didn't…" /></Field>
        <Field label="Lessons" htmlFor="n-lessons" optional><Textarea id="n-lessons" rows={3} maxLength={10000} value={lessons} onChange={(e) => setLessons(e.target.value)} /></Field>
        <Field label="Overall emotional state" htmlFor="n-emo" optional><Select id="n-emo" value={emotional} onChange={(e) => setEmotional(e.target.value)}><option value="">Not recorded</option>{EMOTIONS.map((x) => <option key={x}>{x}</option>)}</Select></Field>
        <Field label="Mistakes" optional><ChipGroup options={MISTAKES.map((m) => ({ value: m, label: m }))} value={mistakes} onChange={setMistakes} /></Field>
      </div>
    </Modal>
  );
}

export function NoteCard({ entry, onEdit, onDelete }: { entry: JournalEntry; onEdit: () => void; onDelete: () => void }) {
  return (
    <Card as="article" className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge tone="primary">{entry.kind === "daily" ? "Daily" : entry.kind === "weekly" ? "Weekly" : "Note"}</Badge>
            <span className="text-[12px] text-muted">{dayLabel(entry.entry_date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
          </div>
          {entry.title && <h3 className="mt-2 text-[15px] font-medium tracking-[-0.02em]">{entry.title}</h3>}
        </div>
        <div className="flex shrink-0 gap-0.5">
          <IconButton label="Edit note" size="sm" onClick={onEdit}><Pencil className="size-3.5" /></IconButton>
          <IconButton label="Delete note" size="sm" onClick={onDelete}><Trash2 className="size-3.5" /></IconButton>
        </div>
      </div>
      {entry.notes && <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-body">{entry.notes}</p>}
      {entry.lessons && <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-3"><span className="font-medium">Lesson: </span>{entry.lessons}</p>}
      {(entry.emotional_state || entry.mistakes.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1">
          {entry.emotional_state && <Badge>{entry.emotional_state}</Badge>}
          {entry.mistakes.map((m) => <Badge key={m} tone="loss">{m}</Badge>)}
        </div>
      )}
    </Card>
  );
}

export function DailyNotes() {
  const { journal, deleteJournal } = useData();
  const notes = journal.filter((j) => !j.trade_id).sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  const [editing, setEditing] = useState<JournalEntry | null | "new">(null);
  const [confirm, setConfirm] = useState<JournalEntry | null>(null);

  return (
    <>
      <div className="mb-4 flex justify-end"><Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing("new")}>New note</Button></div>
      {notes.length === 0 ? (
        <Card><EmptyState icon={<NotebookPen />} title="No daily notes yet" description="Write a pre-market plan or an end-of-day review. Notes show up on the calendar too." action={<Button variant="primary" onClick={() => setEditing("new")}>Write a note</Button>} /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {notes.map((n) => <NoteCard key={n.id} entry={n} onEdit={() => setEditing(n)} onDelete={() => setConfirm(n)} />)}
        </div>
      )}
      {editing && <NoteEditor open onClose={() => setEditing(null)} entry={editing === "new" ? null : editing} />}
      <ConfirmDialog open={Boolean(confirm)} onClose={() => setConfirm(null)} title="Delete this note?" description="This journal note will be permanently deleted."
        onConfirm={async () => { if (!confirm) return; try { await deleteJournal(confirm.id); toast("Note deleted"); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't delete", "error"); } setConfirm(null); }} />
    </>
  );
}
