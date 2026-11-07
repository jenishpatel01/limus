"use client";

// Charts. Thin marks, recessive grid, one y-axis, hover tooltips everywhere.
// P&L polarity uses position (above/below zero) plus colour, never colour alone.

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useId, useRef, type ReactNode } from "react";
import { motion, useInView } from "motion/react";
import { useMotionPrefs } from "@/components/motion/variants";
import { money, pct } from "@/lib/format";
import { cx } from "@/components/ui";

export const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"];

/**
 * Mounts a chart only once it scrolls into view, so its draw animation is seen
 * and off-screen charts cost nothing. Reserves the height to avoid layout shift.
 */
function LazyChart({ height, label, children }: { height: number; label: string; children: () => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -8% 0px" });
  return (
    <div ref={ref} style={{ height }} role="img" aria-label={label} className="relative">
      {inView ? children() : <div className="skeleton absolute inset-0 opacity-50" />}
    </div>
  );
}

function TooltipBox({ title, rows }: { title: ReactNode; rows: { label: string; value: ReactNode; color?: string }[] }) {
  return (
    <div className="min-w-36 rounded-lg bg-raised/95 px-3 py-2 text-[12px] shadow-[0_0_0_1px_var(--line),var(--shadow-pop)] backdrop-blur-sm animate-fade-in">
      <p className="mb-1 font-medium text-ink">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center justify-between gap-4 text-muted">
          <span className="flex items-center gap-1.5">{r.color && <span className="size-2 rounded-full" style={{ background: r.color }} />}{r.label}</span>
          <span className="tnum font-medium text-ink">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

const axisProps = { tickLine: false, axisLine: false, tick: { fontSize: 11, fill: "var(--muted)" } } as const;

function compactMoney(v: number, currency: string) {
  return money(v, currency, { compact: true });
}

export function ChartEmpty({ height = 240, children = "No closed trades in this period" }: { height?: number; children?: ReactNode }) {
  return <div className="flex items-center justify-center rounded-md bg-subtle text-[13px] text-muted" style={{ height }}>{children}</div>;
}

export interface CurvePoint { label: string; value: number; sub?: string }

/** Equity / balance curve. Single series, so the card title names it (no legend). */
export function EquityChart({ data, currency, height = 260, baseline }: { data: CurvePoint[]; currency: string; height?: number; baseline?: number }) {
  const gid = useId().replace(/:/g, "");
  const { reduce } = useMotionPrefs();
  if (data.length < 2) return <ChartEmpty height={height}>Not enough closed trades to draw a curve yet</ChartEmpty>;
  const values = data.map((d) => d.value);
  const min = Math.min(...values, baseline ?? Infinity), max = Math.max(...values, baseline ?? -Infinity);
  const pad = (max - min) * 0.08 || Math.abs(max) * 0.02 || 1;
  return (
    <LazyChart height={height} label={`Equity curve from ${money(data[0].value, currency)} to ${money(data.at(-1)!.value, currency)}`}>{() => (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`eq-fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.16} />
              <stop offset="70%" stopColor="var(--primary)" stopOpacity={0.03} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id={`eq-stroke-${gid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--primary-light)" />
              <stop offset="100%" stopColor="var(--primary)" />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 4" />
          <XAxis dataKey="label" {...axisProps} minTickGap={36} />
          <YAxis {...axisProps} width={64} domain={[min - pad, max + pad]} tickFormatter={(v: number) => compactMoney(v, currency)} />
          {baseline !== undefined && <ReferenceLine y={baseline} stroke="var(--line-strong)" strokeDasharray="4 4" />}
          <Tooltip cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as CurvePoint;
            return <TooltipBox title={p.sub ?? p.label} rows={[{ label: "Balance", value: money(p.value, currency) }]} />;
          }} />
          <Area type="monotone" dataKey="value" stroke={`url(#eq-stroke-${gid})`} strokeWidth={2} fill={`url(#eq-fill-${gid})`} dot={false}
            activeDot={{ r: 5, strokeWidth: 3, stroke: "var(--surface)", fill: "var(--primary)", style: { filter: "drop-shadow(0 0 6px color-mix(in oklab, var(--primary) 45%, transparent))" } }}
            isAnimationActive={!reduce} animationDuration={1400} animationEasing="ease-out" />
        </AreaChart>
      </ResponsiveContainer>
    )}</LazyChart>
  );
}

/** Drawdown (% below peak), drawn downward from zero. */
export function DrawdownChart({ data, height = 200 }: { data: { label: string; value: number; sub?: string }[]; height?: number }) {
  const { reduce } = useMotionPrefs();
  if (data.length < 2) return <ChartEmpty height={height}>Not enough data</ChartEmpty>;
  const neg = data.map((d) => ({ ...d, neg: -d.value }));
  return (
    <LazyChart height={height} label={`Drawdown chart, deepest ${pct(Math.max(...data.map((d) => d.value)), 2)}`}>{() => (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={neg} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 4" />
          <XAxis dataKey="label" {...axisProps} minTickGap={36} />
          <YAxis {...axisProps} width={48} tickFormatter={(v: number) => `${v.toFixed(0)}%`} domain={["dataMin", 0]} />
          <Tooltip cursor={{ stroke: "var(--line-strong)" }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as { label: string; value: number; sub?: string };
            return <TooltipBox title={p.sub ?? p.label} rows={[{ label: "Below peak", value: pct(p.value, 2) }]} />;
          }} />
          <Area type="monotone" dataKey="neg" stroke="var(--loss)" strokeWidth={1.5} fill="var(--loss)" fillOpacity={0.1} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)", fill: "var(--loss)" }} isAnimationActive={!reduce} animationDuration={1200} animationEasing="ease-out" />
        </AreaChart>
      </ResponsiveContainer>
    )}</LazyChart>
  );
}

/** P&L bars around a zero baseline (daily, monthly, by group). */
export function PnlBars({ data, currency, height = 220, valueLabel = "Net P&L", extra }: {
  data: { label: string; value: number; sub?: string; trades?: number }[];
  currency: string; height?: number; valueLabel?: string; extra?: (d: { trades?: number }) => { label: string; value: ReactNode }[];
}) {
  const { reduce } = useMotionPrefs();
  if (!data.length || data.every((d) => d.value === 0 && !d.trades)) return <ChartEmpty height={height} />;
  return (
    <LazyChart height={height} label={`${valueLabel} bar chart with ${data.length} bars`}>{() => (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 4" />
          <XAxis dataKey="label" {...axisProps} minTickGap={12} />
          <YAxis {...axisProps} width={64} tickFormatter={(v: number) => compactMoney(v, currency)} />
          <ReferenceLine y={0} stroke="var(--line-strong)" />
          <Tooltip cursor={{ fill: "var(--bg-muted)", opacity: 0.6 }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as { label: string; value: number; sub?: string; trades?: number };
            return <TooltipBox title={p.sub ?? p.label} rows={[
              { label: valueLabel, value: <span className={p.value >= 0 ? "text-profit" : "text-loss"}>{money(p.value, currency, { sign: true })}</span> },
              ...(p.trades !== undefined ? [{ label: "Trades", value: p.trades }] : []),
              ...(extra ? extra(p) : []),
            ]} />;
          }} />
          <Bar dataKey="value" radius={[4, 4, 4, 4]} maxBarSize={28} isAnimationActive={!reduce} animationDuration={900} animationEasing="ease-out" activeBar={{ fillOpacity: 0.85 }}>
            {data.map((d, i) => <Cell key={i} fill={d.value >= 0 ? "var(--profit)" : "var(--loss)"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )}</LazyChart>
  );
}

/** Concentric ring chart in the style of the template's session-distribution cards. */
export function RingChart({ items, centerValue, centerLabel, size = 168 }: { items: { label: string; value: number; display?: string }[]; centerValue: ReactNode; centerLabel: string; size?: number }) {
  const total = items.reduce((a, b) => a + Math.max(0, b.value), 0);
  const rings = items.slice(0, 5);
  const stroke = 7, gap = 4;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={rings.map((r) => `${r.label} ${total ? ((r.value / total) * 100).toFixed(1) : 0}%`).join(", ")}>
          {rings.map((r, i) => {
            const radius = size / 2 - stroke / 2 - i * (stroke + gap);
            const c = 2 * Math.PI * radius;
            const frac = total ? Math.max(0, r.value) / total : 0;
            return (
              <g key={r.label} transform={`rotate(-90 ${size / 2} ${size / 2})`}>
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--bg-muted)" strokeWidth={stroke} />
                <motion.circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={SERIES[i]} strokeWidth={stroke} strokeLinecap="round"
                  initial={{ strokeDasharray: `0.001 ${c}` }} whileInView={{ strokeDasharray: `${Math.max(0.001, frac * c - (frac > 0 && frac < 1 ? 2 : 0))} ${c}` }}
                  viewport={{ once: true }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: i * 0.08 }}>
                  <title>{`${r.label}: ${r.display ?? r.value} (${(frac * 100).toFixed(1)}%)`}</title>
                </motion.circle>
              </g>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="tnum text-[20px] font-medium tracking-[-0.03em]">{centerValue}</span>
          <span className="text-[11px] text-muted">{centerLabel}</span>
        </div>
      </div>
      <ul className="min-w-0 space-y-2">
        {rings.map((r, i) => (
          <li key={r.label} className="flex items-center gap-2 text-[12.5px]">
            <span className="size-2.5 shrink-0 rounded-full border-2" style={{ borderColor: SERIES[i] }} />
            <span className="text-ink-3">{r.label}</span>
            <span className="tnum ml-auto pl-3 text-muted">{total ? `${((Math.max(0, r.value) / total) * 100).toFixed(0)}%` : "—"}{r.display ? ` · ${r.display}` : ""}</span>
          </li>
        ))}
        {items.length > 5 && <li className="text-[12px] text-faint">+{items.length - 5} more</li>}
      </ul>
    </div>
  );
}

/** Horizontal bars for breakdown rows (strategy, asset, session…). */
export function BreakdownBars({ rows, currency }: { rows: { label: string; value: number; sub?: string }[]; currency: string }) {
  if (!rows.length) return <ChartEmpty height={120} />;
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,120px)_1fr_auto] items-center gap-3 text-[13px]" title={`${r.label}: ${money(r.value, currency)}`}>
          <span className="truncate text-ink-3">{r.label}</span>
          <span className="relative h-2 rounded-full bg-muted-bg">
            <motion.span className={cx("absolute inset-y-0 left-0 rounded-full", r.value >= 0 ? "bg-profit" : "bg-loss")}
              initial={{ width: 0 }} whileInView={{ width: `${Math.max(2, (Math.abs(r.value) / max) * 100)}%` }} viewport={{ once: true }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
          </span>
          <span className={cx("tnum text-right font-medium", r.value >= 0 ? "text-profit" : "text-loss")}>{money(r.value, currency, { sign: true })}{r.sub && <span className="ml-1.5 font-normal text-muted">{r.sub}</span>}</span>
        </li>
      ))}
    </ul>
  );
}

/** Tiny bar sparkline like the template's stat-card bars. */
export function MiniBars({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(...values.map(Math.abs), 1);
  return (
    <div className={cx("flex h-9 items-end gap-1", className)} aria-hidden>
      {values.map((v, i) => (
        <span key={i} className={cx("w-2 rounded-[3px]", i === values.length - 1 ? (v >= 0 ? "bg-primary" : "bg-loss") : "bg-muted-bg")} style={{ height: `${Math.max(12, (Math.abs(v) / max) * 100)}%` }} />
      ))}
    </div>
  );
}
