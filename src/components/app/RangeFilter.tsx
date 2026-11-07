"use client";

import { useMemo, useState } from "react";
import { CalendarRange } from "lucide-react";
import { useData } from "@/lib/data/store";
import { RANGE_PRESETS, dayKey, presetRange, type DayRange, type RangePreset } from "@/lib/dates";
import { Segmented, cx } from "@/components/ui";

const KEY = "limus-range";

export function useRange(defaultPreset: RangePreset = "all", persistKey = KEY) {
  const { tz } = useData();
  const [preset, setPresetState] = useState<RangePreset>(() => {
    try { return (localStorage.getItem(persistKey) as RangePreset) || defaultPreset; } catch { return defaultPreset; }
  });
  const [custom, setCustom] = useState<DayRange>({ from: null, to: null });
  const today = dayKey(new Date(), tz);
  const range = useMemo(() => presetRange(preset, today, custom), [preset, today, custom]);
  const setPreset = (p: RangePreset) => {
    setPresetState(p);
    try { localStorage.setItem(persistKey, p); } catch { /* ignore */ }
    if (p === "custom" && !custom.from) setCustom({ from: today.slice(0, 8) + "01", to: today });
  };
  return { preset, setPreset, custom, setCustom, range, today };
}

export function RangeFilter({ state, className }: { state: ReturnType<typeof useRange>; className?: string }) {
  const { preset, setPreset, custom, setCustom } = state;
  return (
    <div className={cx("flex flex-wrap items-center gap-2", className)}>
      <Segmented ariaLabel="Time range" value={preset} onChange={setPreset} options={RANGE_PRESETS.map((p) => ({ value: p.id, label: <span title={p.label}>{p.short}</span> }))} />
      {preset === "custom" && (
        <div className="flex items-center gap-1.5 text-[12px] text-muted">
          <CalendarRange className="size-4" />
          <input type="date" aria-label="From date" value={custom.from ?? ""} max={custom.to ?? undefined} onChange={(e) => setCustom({ ...custom, from: e.target.value || null })}
            className="h-7 rounded-md bg-surface px-2 text-[12px] text-ink shadow-[0_0_0_1px_var(--line-strong)] outline-none" />
          <span>to</span>
          <input type="date" aria-label="To date" value={custom.to ?? ""} min={custom.from ?? undefined} onChange={(e) => setCustom({ ...custom, to: e.target.value || null })}
            className="h-7 rounded-md bg-surface px-2 text-[12px] text-ink shadow-[0_0_0_1px_var(--line-strong)] outline-none" />
        </div>
      )}
    </div>
  );
}

export function rangeText(range: DayRange): string {
  if (!range.from && !range.to) return "All time";
  if (range.from === range.to) return range.from ?? "";
  return `${range.from ?? "start"} → ${range.to ?? "today"}`;
}
