"use client";

// Motion primitives built on the shared system in ./variants.
// Every component respects prefers-reduced-motion and switches to a lighter
// mode (no blur, shorter travel) on phones and touch devices.

import {
  AnimatePresence, animate, motion, useInView, useMotionValue, useScroll, useSpring, useTransform, type MotionValue,
} from "motion/react";
import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { DUR, EASE, fade, fadeUp, maskLine, page, scaleIn, slideIn, stagger, useMotionPrefs } from "./variants";
import type { Transition, Variants } from "motion/react";

export { AnimatePresence, motion };
export * from "./variants";

type Tag = "div" | "section" | "li" | "span" | "ul" | "p";

/** Adds a delay to a variant set's "show" transition (variant transitions win over the transition prop). */
function withDelay(v: Variants, delay: number): Variants {
  if (!delay) return v;
  const show = v.show as { transition?: Transition };
  return { ...v, show: { ...(v.show as object), transition: { ...(show.transition ?? {}), delay } } } as Variants;
}

/** Fades content up when it scrolls into view. */
export function Reveal({ children, delay = 0, y = 40, className, as = "div", once = true, amount = 0.25 }: {
  children: ReactNode; delay?: number; y?: number; className?: string; as?: Tag; once?: boolean; amount?: number;
}) {
  const { reduce, lite } = useMotionPrefs();
  const M = motion[as];
  const v = withDelay(fadeUp(lite, y), delay);
  return (
    <M className={className} variants={v} initial={reduce ? false : "hidden"} whileInView="show" viewport={{ once, amount }}>
      {children}
    </M>
  );
}

/** Reveals each child in sequence as the group enters the viewport. */
export function Stagger({ children, className, gap = 0.12, y = 36, amount = 0.15, as = "div", itemClassName }: {
  children: ReactNode; className?: string; gap?: number; y?: number; amount?: number; as?: Tag; itemClassName?: string;
}) {
  const { reduce, lite } = useMotionPrefs();
  const M = motion[as];
  const item = fadeUp(lite, y);
  return (
    <M className={className} initial={reduce ? false : "hidden"} whileInView="show" viewport={{ once: true, amount }} variants={stagger(lite ? gap * 0.6 : gap)}>
      {Children.map(children, (child) => child == null ? null : <motion.div className={itemClassName} variants={item}>{child}</motion.div>)}
    </M>
  );
}

/** Slides content in horizontally on reveal. */
export function SlideIn({ children, from = "left", className, delay = 0 }: { children: ReactNode; from?: "left" | "right"; className?: string; delay?: number }) {
  const { reduce, lite } = useMotionPrefs();
  return (
    <motion.div className={className} variants={withDelay(slideIn(from, lite), delay)} initial={reduce ? false : "hidden"} whileInView="show" viewport={{ once: true, amount: 0.3 }}>
      {children}
    </motion.div>
  );
}

/** Headline that blurs in word by word on load. Use "\n" for a line break. */
export function Words({ text, className, delay = 0.1, as = "h1" }: { text: string; className?: string; delay?: number; as?: "h1" | "h2" | "p" }) {
  const { reduce, lite } = useMotionPrefs();
  const M = motion[as];
  const lines = text.split("\n");
  let i = 0;
  return (
    <M className={className} aria-label={text.replace(/\n/g, " ")}>
      {lines.map((line, li) => (
        <span key={li} className="block" aria-hidden>
          {line.split(" ").map((w, wi, arr) => {
            const idx = i++;
            return (
              <motion.span key={wi} className="inline-block whitespace-pre"
                initial={reduce ? false : { opacity: 0, y: "0.8em", rotate: 2, ...(lite ? {} : { filter: "blur(14px)" }) }}
                animate={{ opacity: 1, y: 0, rotate: 0, ...(lite ? {} : { filter: "blur(0px)", transitionEnd: { filter: "none" } }) }}
                transition={{ duration: DUR.long + 0.2, ease: EASE, delay: delay + idx * 0.11 }}>
                {w}{wi < arr.length - 1 ? " " : ""}
              </motion.span>
            );
          })}
        </span>
      ))}
    </M>
  );
}

/**
 * Each line slides up from behind a mask when scrolled into view (editorial heading reveal).
 * A line can be plain text or [text, className] to style it (e.g. a muted second line).
 */
export function MaskText({ lines, className, as = "h2", delay = 0 }: { lines: (string | [string, string])[]; className?: string; as?: "h1" | "h2" | "h3" | "p"; delay?: number }) {
  const { reduce } = useMotionPrefs();
  const M = motion[as];
  const items = lines.map((l) => (typeof l === "string" ? [l, ""] as const : l));
  return (
    <M className={className} aria-label={items.map(([t]) => t).join(" ")} initial={reduce ? false : "hidden"} whileInView="show" viewport={{ once: true, amount: 0.5 }} variants={stagger(0.14, delay)}>
      {items.map(([t, c], i) => (
        <span key={i} className="block overflow-hidden pb-[0.08em]" aria-hidden>
          <motion.span className={`block ${c}`} variants={maskLine}>{t}</motion.span>
        </span>
      ))}
    </M>
  );
}

/** Content that drifts down, shrinks and fades as it scrolls out of the top of the viewport (hero exit). */
export function ScrollFadeOut({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { reduce, lite } = useMotionPrefs();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const opacity = useTransform(scrollYProgress, [0, 0.85], [1, 0]);
  const y = useTransform(scrollYProgress, [0, 1], [0, lite ? 60 : 160]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, lite ? 0.97 : 0.92]);
  return (
    <div ref={ref} className={className}>
      <motion.div style={reduce ? undefined : { opacity, y, scale }}>{children}</motion.div>
    </div>
  );
}

/** Progress bar that grows from the left when scrolled into view. */
export function GrowBar({ width, className }: { width: number; className?: string }) {
  const { reduce } = useMotionPrefs();
  return (
    <motion.span className={className} style={{ width: `${width}%`, transformOrigin: "0% 50%" }}
      initial={reduce ? false : { scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, amount: 1 }}
      transition={{ duration: 1.3, ease: EASE, delay: 0.3 }} />
  );
}

/** Panel that tilts up from a 3D angle into place as it scrolls into view (product screenshot reveal). */
export function ScrollTiltIn({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { reduce, lite } = useMotionPrefs();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 0.3"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [lite ? 10 : 28, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [lite ? 0.94 : 0.84, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [lite ? 40 : 120, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.45], [0.2, 1]);
  return (
    <div ref={ref} className={className} style={{ perspective: 1400 }}>
      <motion.div style={reduce ? undefined : { rotateX, scale, y, opacity, transformOrigin: "50% 0%" }}>{children}</motion.div>
    </div>
  );
}

/** Appears on page load after a delay (hero badges, buttons). */
export function FadeIn({ children, delay = 0, className, y = 32 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  const { reduce, lite } = useMotionPrefs();
  return (
    <motion.div className={className} initial={reduce ? false : "hidden"} animate="show" variants={withDelay(fadeUp(lite, y), delay)}>
      {children}
    </motion.div>
  );
}

/** Route content entrance. Fast, so navigation never waits on it. */
export function PageTransition({ children, routeKey }: { children: ReactNode; routeKey: string }) {
  const { reduce, lite } = useMotionPrefs();
  return (
    <motion.div key={routeKey} initial={reduce ? false : "hidden"} animate="show" variants={page(lite)}>
      {children}
    </motion.div>
  );
}

/** Image / panel revealed by an expanding clip path, with a subtle settle-in scale. */
export function ClipReveal({ children, className }: { children: ReactNode; className?: string }) {
  const { reduce, lite } = useMotionPrefs();
  return (
    <motion.div className={className}
      initial={reduce ? false : { clipPath: lite ? "inset(0% 0% 0% 0% round 16px)" : "inset(18% 10% 18% 10% round 32px)", opacity: lite ? 0 : 1, scale: lite ? 1 : 1.08 }}
      whileInView={{ clipPath: "inset(0% 0% 0% 0% round 16px)", opacity: 1, scale: 1 }}
      viewport={{ once: true, amount: 0.2 }} transition={{ duration: 1.5, ease: EASE }}>
      {children}
    </motion.div>
  );
}

/** Thin line that draws itself across a section boundary. */
export function Divider({ className }: { className?: string }) {
  const { reduce } = useMotionPrefs();
  return (
    <motion.div aria-hidden className={`h-px origin-left bg-line ${className ?? ""}`}
      initial={reduce ? false : { scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, amount: 1 }} transition={{ duration: 1.2, ease: EASE }} />
  );
}

/** Reading-progress bar pinned to the top of the viewport. */
export function ScrollProgress({ className }: { className?: string }) {
  const { scrollYProgress } = useScroll();
  const { reduce } = useMotionPrefs();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.4 });
  return <motion.div aria-hidden className={`fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-primary ${className ?? ""}`} style={{ scaleX: reduce ? scrollYProgress : scaleX }} />;
}

/** Tilts its content a few degrees towards the cursor (desktop pointers only). */
export function Tilt({ children, className, max = 8 }: { children: ReactNode; className?: string; max?: number }) {
  const { lite } = useMotionPrefs();
  const mx = useMotionValue(0), my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [max, -max]), { stiffness: 120, damping: 20 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-max, max]), { stiffness: 120, damping: 20 });
  if (lite) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} style={{ rotateX: rx, rotateY: ry, transformPerspective: 1200 }}
      onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); mx.set((e.clientX - r.left) / r.width - 0.5); my.set((e.clientY - r.top) / r.height - 0.5); }}
      onPointerLeave={() => { mx.set(0); my.set(0); }}>
      {children}
    </motion.div>
  );
}

/** Paragraphs that brighten word by word as they scroll through the viewport. */
export function ScrollLitText({ paragraphs, className, dim = "#3d3d3d", lit = "#ffffff" }: { paragraphs: { text: string; accent?: string }[]; className?: string; dim?: string; lit?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { reduce } = useMotionPrefs();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] });
  const total = paragraphs.reduce((a, p) => a + p.text.split(" ").length, 0);
  let k = 0;
  return (
    <div ref={ref} className={className}>
      {paragraphs.map((p, pi) => (
        <p key={pi} className="mt-6 first:mt-0">
          {p.text.split(" ").map((w, wi) => {
            const idx = k++;
            return <LitWord key={wi} progress={scrollYProgress} start={idx / total} end={(idx + 1) / total} dim={dim} lit={p.accent ?? lit} reduce={reduce}>{w} </LitWord>;
          })}
        </p>
      ))}
      <span className="sr-only">{paragraphs.map((p) => p.text).join(" ")}</span>
    </div>
  );
}

function LitWord({ progress, start, end, dim, lit, reduce, children }: { progress: MotionValue<number>; start: number; end: number; dim: string; lit: string; reduce: boolean; children: ReactNode }) {
  const color = useTransform(progress, [start, end], [dim, lit]);
  return <motion.span aria-hidden style={{ color: reduce ? lit : color }}>{children}</motion.span>;
}

/**
 * Animates the first number inside a formatted string ("+$9,025.92", "47.3%", "1 : 2.27")
 * from 0 when it first scrolls into view, keeping prefix, suffix, separators and decimals.
 * Later value changes (e.g. a new filter) tween from the previous value.
 */
export function CountUp({ value, duration = DUR.count }: { value: string | number; duration?: number }) {
  const text = String(value);
  const m = text.match(/-?[\d,]*\.?\d+/);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const { reduce } = useMotionPrefs();
  const [frame, setFrame] = useState<string | null>(null);
  const prev = useRef<number | null>(null);
  const target = m ? Number(m[0].replace(/,/g, "")) : NaN;
  const decimals = m && m[0].includes(".") ? m[0].split(".")[1].length : 0;
  const grouped = m ? m[0].includes(",") || Math.abs(target) >= 1000 : false;
  const fmt = (n: number) => (grouped ? n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : n.toFixed(decimals));
  const animatable = Boolean(m) && Number.isFinite(target) && !reduce;

  useEffect(() => {
    if (!animatable || !inView) return;
    const from = prev.current ?? 0;
    if (from === target) return;
    const controls = animate(from, target, {
      duration: prev.current === null ? duration : DUR.base, ease: EASE,
      onUpdate: (v) => setFrame(text.replace(m![0], fmt(v))),
      onComplete: () => { prev.current = target; setFrame(null); },
    });
    return () => { controls.stop(); prev.current = target; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animatable, inView, target, text]);

  const shown = !animatable ? text : frame ?? (!inView ? text.replace(m![0], fmt(0)) : text);
  return <span ref={ref} className="tnum">{shown}</span>;
}

/** Subtle parallax drift while scrolling (disabled in lite mode). */
export function Parallax({ children, className, distance = 90 }: { children: ReactNode; className?: string; distance?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { lite } = useMotionPrefs();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);
  return <motion.div ref={ref} className={className} style={{ y: lite ? 0 : y }}>{children}</motion.div>;
}

/** Height-animated expand/collapse for filter panels and accordions. */
export function Collapse({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  const { reduce } = useMotionPrefs();
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div key="c" className={`overflow-hidden ${className ?? ""}`}
          initial={reduce ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
          transition={{ duration: DUR.short, ease: EASE }}>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** In-view stagger for rows of a table or list (each child must be an element that accepts motion props via MotionItem). */
export const listVariants = stagger(0.035);
export function useListItem() {
  const { reduce, lite } = useMotionPrefs();
  return { variants: fadeUp(lite, 18), reduce };
}

export { fade, scaleIn };
