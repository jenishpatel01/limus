"use client";

import { useCallback, useSyncExternalStore } from "react";

export type ThemePref = "light" | "dark" | "system";
const KEY = "limus-theme";
const listeners = new Set<() => void>();

function resolve(pref: ThemePref): "light" | "dark" {
  if (pref === "system") return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  return pref;
}

function read(): ThemePref {
  try { return (localStorage.getItem(KEY) as ThemePref) || "light"; } catch { return "light"; }
}

export function applyTheme(pref: ThemePref) {
  try { localStorage.setItem(KEY, pref); } catch { /* ignore */ }
  document.documentElement.dataset.theme = resolve(pref);
  listeners.forEach((l) => l());
}

type VTDocument = Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };

/**
 * Switches theme with a circular wipe that grows from the click point (View Transitions API).
 * Falls back to an instant switch on browsers without it or when reduced motion is requested.
 */
export function applyThemeAnimated(pref: ThemePref, origin?: { x: number; y: number }) {
  const d = document as VTDocument;
  const next = resolve(pref);
  if (next === document.documentElement.dataset.theme) { applyTheme(pref); return; }
  if (!d.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) { applyTheme(pref); return; }
  const x = origin?.x ?? innerWidth / 2, y = origin?.y ?? 0;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  d.startViewTransition(() => applyTheme(pref)).ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 700, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" },
    );
  }).catch(() => undefined);
}

export function useTheme() {
  const pref = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    read,
    () => "light" as ThemePref,
  );
  const set = useCallback((p: ThemePref) => applyTheme(p), []);
  const resolved = typeof document !== "undefined" ? (document.documentElement.dataset.theme as "light" | "dark") ?? "light" : "light";
  return { pref, resolved, set };
}
