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
