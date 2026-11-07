"use client";

import { clsx } from "clsx";
import {
  forwardRef, useEffect, useId, useRef, useState, useSyncExternalStore,
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { CountUp } from "@/components/motion";
import { EASE, popover } from "@/components/motion/variants";
import Link from "next/link";
import { AlertTriangle, Check, ChevronDown, Info, Loader2, X } from "lucide-react";

export const cx = clsx;

// ───────────────────────── Buttons ─────────────────────────

type ButtonVariant = "primary" | "secondary" | "dark" | "ghost" | "danger" | "link";
type ButtonSize = "sm" | "md" | "lg";

const buttonBase = "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-[background-color,box-shadow,color,opacity,transform] duration-150 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100 select-none";
const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary font-button font-semibold tracking-[-0.015em] shadow-btn hover:bg-primary-hover",
  secondary: "bg-surface text-ink shadow-[0_0_0_1px_var(--line-strong),var(--shadow-btn)] hover:bg-subtle",
  dark: "bg-ink-2 text-bg shadow-btn hover:opacity-90",
  ghost: "text-ink-3 hover:bg-muted-bg hover:text-ink",
  danger: "bg-loss text-white shadow-btn hover:opacity-90",
  link: "text-primary-text hover:underline underline-offset-4 px-0! h-auto!",
};
const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-[13px]",
  md: "h-9 px-3 text-[14px]",
  lg: "h-11 px-4 text-[15px]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon, className, children, disabled, type = "button", ...rest }, ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={cx(buttonBase, buttonVariants[variant], buttonSizes[size], className)} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function ButtonLink({ href, variant = "secondary", size = "md", icon, className, children, ...rest }: { href: string; variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode; className?: string; children?: ReactNode; prefetch?: boolean; target?: string }) {
  return (
    <Link href={href} className={cx(buttonBase, buttonVariants[variant], buttonSizes[size], className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: "sm" | "md" }>(function IconButton(
  { label, size = "md", className, children, type = "button", ...rest }, ref,
) {
  return (
    <button ref={ref} type={type} aria-label={label} title={label}
      className={cx("inline-flex items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-muted-bg hover:text-ink disabled:opacity-40", size === "sm" ? "size-8" : "size-9", className)} {...rest}>
      {children}
    </button>
  );
});

// ───────────────────────── Form controls ─────────────────────────

const controlBase = "w-full rounded-md bg-surface text-[14px] text-ink placeholder:text-faint shadow-[0_0_0_1px_var(--line-strong)] transition-shadow outline-none focus:shadow-[0_0_0_1px_var(--primary),0_0_0_4px_var(--primary-soft)] disabled:bg-muted-bg disabled:text-muted aria-[invalid=true]:shadow-[0_0_0_1px_var(--loss)]";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { prefix?: string; suffix?: string }>(function Input(
  { className, prefix, suffix, ...rest }, ref,
) {
  if (prefix || suffix) {
    return (
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[13px] text-muted">{prefix}</span>}
        <input ref={ref} className={cx(controlBase, "h-9 px-3", prefix && "pl-8", suffix && "pr-12", className)} {...rest} />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12px] text-muted">{suffix}</span>}
      </div>
    );
  }
  return <input ref={ref} className={cx(controlBase, "h-9 px-3", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 4, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={cx(controlBase, "resize-y px-3 py-2 leading-relaxed", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cx(controlBase, "h-9 appearance-none pl-3 pr-8", className)} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  );
});

export function Field({ label, hint, error, children, className, htmlFor, optional }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string; htmlFor?: string; optional?: boolean }) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-3">
        {label}
        {optional && <span className="ml-1 font-normal text-faint">Optional</span>}
      </label>
      {children}
      {error ? <p className="text-[12px] text-loss" role="alert">{error}</p> : hint ? <p className="text-[12px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function Toggle({ checked, onChange, label, id, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string; disabled?: boolean }) {
  return (
    <button id={id} type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={cx("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors", checked ? "bg-primary" : "bg-line-strong")}>
      <span className={cx("inline-block size-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
  );
}

export function Checkbox({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; className?: string }) {
  return (
    <label className={cx("inline-flex cursor-pointer items-center gap-2 text-[14px] text-ink-3", className)}>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={cx("flex size-4 items-center justify-center rounded-[5px] shadow-[0_0_0_1px_var(--line-strong)] transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-primary", checked && "bg-primary shadow-none")}>
        {checked && <Check className="size-3 text-white" strokeWidth={3} />}
      </span>
      {label}
    </label>
  );
}

/** Segmented control in the style of the template's 1D / 7D / 1M filter. */
export function Segmented<T extends string>({ options, value, onChange, size = "sm", className, ariaLabel }: { options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; size?: "sm" | "md"; className?: string; ariaLabel?: string }) {
  const pillId = useId();
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cx("inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-md bg-muted-bg p-0.5 scrollbar-thin", className)}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cx("relative shrink-0 rounded-[6px] font-medium transition-colors", size === "sm" ? "h-6 px-2 text-[12px]" : "h-8 px-3 text-[13px]",
            value === o.value ? "text-ink" : "text-muted hover:text-ink")}>
          {value === o.value && (
            <motion.span layoutId={pillId} className="absolute inset-0 rounded-[6px] bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.08),0_0_0_1px_var(--line)]"
              transition={{ type: "spring", stiffness: 520, damping: 38 }} />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Multi-select chips. */
export function ChipGroup<T extends string>({ options, value, onChange, className }: { options: { value: T; label: string }[]; value: T[]; onChange: (v: T[]) => void; className?: string }) {
  return (
    <div className={cx("flex flex-wrap gap-1.5", className)}>
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={cx("h-7 rounded-full px-2.5 text-[12px] font-medium transition-colors",
              on ? "bg-primary-soft text-primary-text shadow-[0_0_0_1px_var(--primary)]" : "bg-surface text-ink-3 shadow-[0_0_0_1px_var(--line-strong)] hover:bg-subtle")}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Free-text tags input (Enter or comma adds a tag). */
export function TagInput({ value, onChange, placeholder = "Add tag…", suggestions = [], max = 30 }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; suggestions?: string[]; max?: number }) {
  const [draft, setDraft] = useState("");
  const listId = useId();
  const add = (raw: string) => {
    const tag = raw.trim().replace(/,$/, "").slice(0, 40);
    if (tag && !value.some((v) => v.toLowerCase() === tag.toLowerCase()) && value.length < max) onChange([...value, tag]);
    setDraft("");
  };
  return (
    <div className={cx(controlBase, "flex min-h-9 flex-wrap items-center gap-1 px-1.5 py-1")}>
      {value.map((t) => (
        <span key={t} className="inline-flex h-6 items-center gap-1 rounded-[6px] bg-muted-bg pl-2 pr-1 text-[12px] text-ink-3">
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((v) => v !== t))} className="rounded p-0.5 hover:bg-line">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input value={draft} list={suggestions.length ? listId : undefined} placeholder={value.length ? "" : placeholder}
        onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); add(draft); }
          if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => draft && add(draft)}
        className="h-7 min-w-24 flex-1 bg-transparent px-1.5 text-[14px] outline-none placeholder:text-faint" />
      {suggestions.length > 0 && (
        <datalist id={listId}>{suggestions.filter((s) => !value.includes(s)).map((s) => <option key={s} value={s} />)}</datalist>
      )}
    </div>
  );
}

// ───────────────────────── Surfaces ─────────────────────────

export function Card({ className, children, as: As = "section", ...rest }: { className?: string; children: ReactNode; as?: "section" | "div" | "article" } & Record<string, unknown>) {
  return <As className={cx("surface-card rounded-lg", className)} {...rest}>{children}</As>;
}

export function CardHeader({ title, subtitle, action, className }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-wrap items-start justify-between gap-3 px-5 pt-4", className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-medium tracking-[-0.02em] text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

type Tone = "neutral" | "primary" | "profit" | "loss" | "warn" | "dark";
const toneClass: Record<Tone, string> = {
  neutral: "bg-muted-bg text-ink-3",
  primary: "bg-primary-soft text-primary-text",
  profit: "bg-profit-soft text-profit",
  loss: "bg-loss-soft text-loss",
  warn: "bg-warn-soft text-warn",
  dark: "bg-ink-2 text-bg",
};

export function Badge({ tone = "neutral", children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return <span title={title} className={cx("inline-flex h-5 shrink-0 items-center gap-1 rounded-[6px] px-1.5 text-[11.5px] font-medium tracking-[-0.01em]", toneClass[tone], className)}>{children}</span>;
}

/** KPI tile modelled on the template's analytics cards (icon chip, label, value, delta). */
export function StatCard({ icon, label, value, sub, tone, className, hint }: { icon?: ReactNode; label: string; value: ReactNode; sub?: ReactNode; tone?: "profit" | "loss" | null; className?: string; hint?: string }) {
  return (
    <Card as="div" className={cx("flex min-w-0 flex-col gap-3 p-4 transition-shadow duration-300 hover:shadow-[0_0_0_1px_var(--line-strong),var(--shadow-pop)]", className)}>
      {icon && <span className="flex size-8 items-center justify-center rounded-md bg-subtle text-ink-3 shadow-[0_0_0_1px_var(--line)] [&_svg]:size-4">{icon}</span>}
      <div className="min-w-0">
        <p className="truncate text-[13px] text-muted" title={hint}>{label}</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-x-2 gap-y-0.5">
          <p className={cx("tnum whitespace-nowrap text-[22px] font-medium leading-tight tracking-[-0.03em]", tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "text-ink")}>{typeof value === "string" || typeof value === "number" ? <CountUp value={value} /> : value}</p>
          {sub && <div className="tnum shrink-0 text-[12px] text-muted">{sub}</div>}
        </div>
      </div>
    </Card>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} aria-hidden />;
}

const EMPTY_ICON = { hidden: { opacity: 0, scale: 0.8 }, show: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: EASE } } };
const EMPTY_ITEM = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } } };

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <motion.div className={cx("flex flex-col items-center justify-center px-6 py-14 text-center", className)}
      initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}>
      {icon && (
        <motion.div variants={EMPTY_ICON} className="relative mb-5">
          <span aria-hidden className="absolute -inset-3 rounded-2xl bg-primary-soft/50 blur-md" />
          <span className="float-slow relative flex size-12 items-center justify-center rounded-xl bg-surface text-primary-text shadow-[0_0_0_1px_var(--line),var(--shadow-pop)] [&_svg]:size-5">{icon}</span>
        </motion.div>
      )}
      <motion.h3 variants={EMPTY_ITEM} className="text-[15px] font-medium tracking-[-0.02em]">{title}</motion.h3>
      {description && <motion.p variants={EMPTY_ITEM} className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">{description}</motion.p>}
      {action && <motion.div variants={EMPTY_ITEM} className="mt-5 flex flex-wrap justify-center gap-2">{action}</motion.div>}
    </motion.div>
  );
}

export function PageHeader({ title, description, actions, icon }: { title: string; description?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <motion.span initial={{ opacity: 0, scale: 0.85, rotate: -6 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ duration: 0.5, ease: EASE }}
            className="surface-card hidden size-10 items-center justify-center rounded-xl text-ink-3 sm:flex [&_svg]:size-[18px]">{icon}</motion.span>
        )}
        <div className="min-w-0">
          <div className="overflow-hidden">
            <motion.h1 initial={{ y: "100%" }} animate={{ y: "0%" }} transition={{ duration: 0.6, ease: EASE }} className="text-[24px] font-medium leading-tight tracking-[-0.04em] sm:text-[26px]">{title}</motion.h1>
          </div>
          {description && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.12 }} className="mt-1 text-[14px] text-muted">{description}</motion.p>}
        </div>
      </div>
      {actions && <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: EASE, delay: 0.1 }} className="flex flex-wrap items-center gap-2">{actions}</motion.div>}
    </div>
  );
}

export function Notice({ tone = "info", children, className }: { tone?: "info" | "warn" | "loss"; children: ReactNode; className?: string }) {
  const Icon = tone === "info" ? Info : AlertTriangle;
  return (
    <div role={tone === "info" ? "note" : "alert"} className={cx("flex gap-2.5 rounded-md px-3 py-2.5 text-[13px] leading-relaxed",
      tone === "info" ? "bg-primary-soft/60 text-ink-3" : tone === "warn" ? "bg-warn-soft text-ink-3" : "bg-loss-soft text-ink-3", className)}>
      <Icon className={cx("mt-0.5 size-4 shrink-0", tone === "info" ? "text-primary-text" : tone === "warn" ? "text-warn" : "text-loss")} aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// ───────────────────────── Overlays ─────────────────────────

export function Modal({ open, onClose, title, description, children, footer, size = "md" }: { open: boolean; onClose: () => void; title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => {
      const el = ref.current?.querySelector<HTMLElement>("[autofocus], input, select, textarea, button:not([data-close])");
      el?.focus();
    }, 20);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; clearTimeout(t); prev?.focus?.(); };
  }, [open, onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
    {open && (
    <div key="modal" className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <motion.div className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-[2px]" onClick={onClose} aria-hidden initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
      <motion.div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId}
        initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.16, ease: EASE } }} transition={{ type: "spring", stiffness: 420, damping: 34 }}
        className={cx("relative flex max-h-[92dvh] w-full flex-col rounded-t-xl bg-raised shadow-pop sm:rounded-xl",
          size === "sm" ? "sm:max-w-md" : size === "lg" ? "sm:max-w-3xl" : size === "xl" ? "sm:max-w-5xl" : "sm:max-w-xl")}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id={titleId} className="text-[16px] font-medium tracking-[-0.02em]">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
          </div>
          <IconButton label="Close" size="sm" onClick={onClose} data-close><X className="size-4" /></IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3 safe-bottom">{footer}</div>}
      </motion.div>
    </div>
    )}
    </AnimatePresence>,
    document.body,
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = "Delete", tone = "danger", loading }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; description?: ReactNode; confirmLabel?: string; tone?: "danger" | "primary"; loading?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant={tone === "danger" ? "danger" : "primary"} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
      </>}>
      <div className="text-[14px] leading-relaxed text-body">{description}</div>
    </Modal>
  );
}

/** Lightweight dropdown menu. */
export function Menu({ trigger, children, align = "end", className }: { trigger: (p: { open: boolean; toggle: () => void }) => ReactNode; children: (close: () => void) => ReactNode; align?: "start" | "end"; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      <AnimatePresence>
        {open && (
          <motion.div role="menu" variants={popover} initial="hidden" animate="show" exit="exit" style={{ transformOrigin: align === "end" ? "top right" : "top left" }}
            className={cx("absolute z-40 mt-1.5 min-w-48 rounded-lg bg-raised p-1 shadow-[0_0_0_1px_var(--line),var(--shadow-pop)]", align === "end" ? "right-0" : "left-0", className)}>
            {children(() => setOpen(false))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function MenuItem({ onClick, children, icon, danger, href }: { onClick?: () => void; children: ReactNode; icon?: ReactNode; danger?: boolean; href?: string }) {
  const cls = cx("flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13.5px] transition-colors [&_svg]:size-4 [&_svg]:transition-transform hover:[&_svg]:translate-x-0.5", danger ? "text-loss hover:bg-loss-soft" : "text-ink-3 hover:bg-muted-bg hover:text-ink");
  if (href) return <Link role="menuitem" href={href} onClick={onClick} className={cls}>{icon}{children}</Link>;
  return <button role="menuitem" type="button" onClick={onClick} className={cls}>{icon}{children}</button>;
}

// ───────────────────────── Toasts ─────────────────────────

type Toast = { id: number; kind: "success" | "error" | "info"; message: string };
let toasts: Toast[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
let toastId = 0;

export function toast(message: string, kind: Toast["kind"] = "success") {
  const id = ++toastId;
  toasts = [...toasts.slice(-3), { id, kind, message }];
  emit();
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); emit(); }, kind === "error" ? 6000 : 3500);
}

export function Toaster() {
  const list = useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => toasts, () => toasts);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6">
      <AnimatePresence>
      {list.map((t) => (
        <motion.div key={t.id} layout exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.18 } }} role={t.kind === "error" ? "alert" : "status"} initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className="pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-lg bg-ink-2 px-3.5 py-2.5 text-[13.5px] text-bg shadow-pop">
          {t.kind === "success" ? <Check className="size-4 text-profit" /> : t.kind === "error" ? <AlertTriangle className="size-4 text-loss" /> : <Info className="size-4 text-primary-light" />}
          <span>{t.message}</span>
        </motion.div>
      ))}
      </AnimatePresence>
    </div>
  );
}

// ───────────────────────── Misc ─────────────────────────

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx("size-4 animate-spin text-muted", className)} aria-label="Loading" />;
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { value: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; className?: string }) {
  const lineId = useId();
  return (
    <div role="tablist" className={cx("flex gap-1 overflow-x-auto border-b border-line scrollbar-thin", className)}>
      {tabs.map((t) => (
        <button key={t.value} role="tab" type="button" aria-selected={value === t.value} onClick={() => onChange(t.value)}
          className={cx("relative -mb-px flex h-10 shrink-0 items-center gap-1.5 px-2.5 text-[13.5px] font-medium transition-colors",
            value === t.value ? "text-ink" : "text-muted hover:text-ink")}>
          {value === t.value && <motion.span layoutId={lineId} className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-ink" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
          {t.label}
          {t.count !== undefined && <span className="tnum rounded-[5px] bg-muted-bg px-1.5 text-[11px] text-muted">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
