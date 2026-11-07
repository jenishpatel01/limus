"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Trash2, X } from "lucide-react";
import { api } from "@/lib/data/api";
import { motion } from "motion/react";
import { useData } from "@/lib/data/store";
import type { Attachment } from "@/lib/types";
import { Button, IconButton, Skeleton, cx, toast } from "@/components/ui";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const MAX = 5 * 1024 * 1024;

export function checkFile(f: File): string | null {
  if (!ACCEPT.split(",").includes(f.type)) return `${f.name}: only PNG, JPEG, WebP or GIF`;
  if (f.size > MAX) return `${f.name}: larger than 5 MB`;
  return null;
}

/** Signed URLs for private screenshots (valid for one hour). */
export function useSignedUrls(items: Attachment[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = items.map((i) => i.storage_path).join("|");
  useEffect(() => {
    const paths = key ? key.split("|") : [];
    if (!paths.length) return;
    let cancelled = false;
    api.signedUrls(paths).then((u) => { if (!cancelled) setUrls(u); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [key]);
  return urls;
}

function Dropzone({ onFiles, disabled }: { onFiles: (files: File[]) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) onFiles(Array.from(e.dataTransfer.files)); }}
      className={cx("flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
        over ? "border-primary bg-primary-soft/40" : "border-line-strong bg-subtle")}>
      <ImagePlus className="size-5 text-muted" />
      <p className="text-[13px] text-ink-3">Drop chart screenshots here or</p>
      <Button size="sm" disabled={disabled} onClick={() => input.current?.click()}>Choose files</Button>
      <p className="text-[11.5px] text-faint">PNG, JPEG, WebP or GIF · up to 5 MB each</p>
      <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { onFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
    </div>
  );
}

/** Screenshots for an existing trade or strategy: uploads immediately. */
export function AttachmentManager({ parent, items, readOnly }: { parent: { tradeId?: string; strategyId?: string }; items: Attachment[]; readOnly?: boolean }) {
  const { uploadAttachment, deleteAttachment } = useData();
  const urls = useSignedUrls(items);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<Attachment | null>(null);

  async function add(files: File[]) {
    const bad = files.map(checkFile).filter(Boolean);
    if (bad.length) toast(bad[0]!, "error");
    const ok = files.filter((f) => !checkFile(f));
    if (!ok.length) return;
    setBusy(true);
    try {
      for (const f of ok) await uploadAttachment(parent, f);
      toast(ok.length === 1 ? "Screenshot uploaded" : `${ok.length} screenshots uploaded`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed", "error");
    } finally { setBusy(false); }
  }

  async function remove(a: Attachment) {
    try { await deleteAttachment(a); toast("Screenshot deleted"); setView(null); } catch (e) { toast(e instanceof Error ? e.message : "Couldn't delete", "error"); }
  }

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((a) => (
            <div key={a.id} className="group relative aspect-[16/10] overflow-hidden rounded-lg bg-muted-bg shadow-[0_0_0_1px_var(--line)]">
              {urls[a.storage_path] ? (
                <button type="button" onClick={() => setView(a)} className="block size-full" aria-label={`View ${a.file_name}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urls[a.storage_path]} alt={a.caption || a.file_name} className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]" />
                </button>
              ) : <Skeleton className="size-full" />}
              {!readOnly && (
                <IconButton label="Delete screenshot" size="sm" onClick={() => remove(a)} className="absolute right-1.5 top-1.5 bg-white/90 text-ink opacity-0 shadow group-hover:opacity-100 focus:opacity-100 max-sm:opacity-100">
                  <Trash2 className="size-3.5" />
                </IconButton>
              )}
            </div>
          ))}
        </div>
      )}
      {!readOnly && <Dropzone onFiles={add} disabled={busy} />}
      {busy && <p className="text-[12px] text-muted">Uploading…</p>}
      {view && urls[view.storage_path] && <Lightbox src={urls[view.storage_path]} alt={view.caption || view.file_name} onClose={() => setView(null)} />}
    </div>
  );
}

/** Screenshots chosen before a trade exists; uploaded after it's saved. */
export function PendingFiles({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  return (
    <div className="space-y-3">
      {files.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {files.map((f, i) => (
            <div key={i} className="group relative aspect-[16/10] overflow-hidden rounded-lg bg-muted-bg shadow-[0_0_0_1px_var(--line)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previews[i]} alt={f.name} className="size-full object-cover" />
              <IconButton label={`Remove ${f.name}`} size="sm" onClick={() => onChange(files.filter((_, j) => j !== i))} className="absolute right-1.5 top-1.5 bg-white/90 text-ink shadow">
                <X className="size-3.5" />
              </IconButton>
            </div>
          ))}
        </div>
      )}
      <Dropzone onFiles={(list) => {
        const bad = list.map(checkFile).filter(Boolean);
        if (bad.length) toast(bad[0]!, "error");
        onChange([...files, ...list.filter((f) => !checkFile(f))].slice(0, 10));
      }} />
    </div>
  );
}

export function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <motion.div role="dialog" aria-modal="true" aria-label={alt} className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      <motion.img src={src} alt={alt} className="max-h-full max-w-full rounded-lg object-contain shadow-pop" onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 320, damping: 30 }} />
      <IconButton label="Close" onClick={onClose} className="absolute right-4 top-4 bg-white/90 text-ink"><X className="size-4" /></IconButton>
    </motion.div>
  );
}
