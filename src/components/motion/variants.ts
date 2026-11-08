"use client";

// One motion language for the whole product. Every animation pulls its easing,
// duration and distance from here so movement feels consistent.

import { useReducedMotion } from "motion/react";
import { useSyncExternalStore } from "react";
import type { Transition, Variants } from "motion/react";

/** Expo-out: fast start, long soft landing. Used for almost everything. */
export const EASE = [0.22, 1, 0.36, 1] as const;
/** Gentle in-out for continuous or looping movement. */
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

export const DUR = { micro: 0.2, short: 0.45, base: 0.85, long: 1.15, count: 1.6 } as const;

export const SPRING: Transition = { type: "spring", stiffness: 480, damping: 38, mass: 0.9 };
export const SPRING_SOFT: Transition = { type: "spring", stiffness: 260, damping: 30 };

const mq = typeof window !== "undefined" ? window.matchMedia("(max-width: 768px), (pointer: coarse)") : null;

/**
 * `reduce`: user asked for reduced motion: no movement, only instant state changes.
 * `lite`: small or touch screens (or reduced motion): shorter distances and no blur filters,
 * which are expensive on mobile GPUs.
 */
export function useMotionPrefs() {
  const reduce = Boolean(useReducedMotion());
  const small = useSyncExternalStore(
    (cb) => { mq?.addEventListener("change", cb); return () => mq?.removeEventListener("change", cb); },
    () => Boolean(mq?.matches),
    () => false,
  );
  return { reduce, lite: reduce || small };
}

/** Entrance from below. Blur only on capable screens. */
export const fadeUp = (lite: boolean, distance = 36): Variants => ({
  // The filter key must exist in BOTH modes: the server renders the non-lite hidden state (blurred),
  // and when a phone then switches to lite mode, "show" still has to animate that blur away.
  hidden: { opacity: 0, y: lite ? Math.min(20, distance) : distance, filter: lite ? "blur(0px)" : "blur(12px)" },
  // transitionEnd drops the filter once settled, so text renders crisp (no lingering compositing layer).
  show: { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" }, transition: { duration: lite ? DUR.base : DUR.long, ease: EASE } },
});

export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DUR.base, ease: EASE } },
};

export const slideIn = (from: "left" | "right", lite: boolean): Variants => ({
  hidden: { opacity: 0, x: (from === "left" ? -1 : 1) * (lite ? 24 : 64) },
  show: { opacity: 1, x: 0, transition: { duration: DUR.long, ease: EASE } },
});

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  show: { opacity: 1, scale: 1, transition: { duration: DUR.base, ease: EASE } },
};

/** Line of text sliding up from behind a mask. */
export const maskLine: Variants = {
  hidden: { y: "105%" },
  show: { y: "0%", transition: { duration: DUR.long, ease: EASE } },
};

export const stagger = (gap = 0.1, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
});

/** Menus and popovers. */
export const popover: Variants = {
  hidden: { opacity: 0, y: -4, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: DUR.micro + 0.04, ease: EASE } },
  exit: { opacity: 0, y: -4, scale: 0.98, transition: { duration: DUR.micro - 0.04, ease: EASE } },
};

/** Route-level content entrance (fast so navigation never feels delayed). */
export const page = (lite: boolean): Variants => ({
  hidden: { opacity: 0, y: lite ? 14 : 28 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE } },
});
