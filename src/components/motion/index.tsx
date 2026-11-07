"use client";

// Motion primitives modelled on the Lumis template's Framer effects:
// blur-up reveals, staggered words, scroll-lit text, count-up numbers.
// All respect prefers-reduced-motion.

import { animate, motion, useInView, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { Children, useEffect, useRef, useState, type ReactNode } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Fades content up from a soft blur when it scrolls into view. */
export function Reveal({ children, delay = 0, y = 18, className, as = "div", once = true, amount = 0.25 }: {
  children: ReactNode; delay?: number; y?: number; className?: string; as?: "div" | "section" | "li" | "span"; once?: boolean; amount?: number;
}) {
  const reduce = useReducedMotion();
  const M = motion[as];
  return (
    <M className={className}
      initial={reduce ? false : { opacity: 0, y, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once, amount }}
      transition={{ duration: 0.8, ease: EASE, delay }}>
      {children}
    </M>
  );
}

/** Reveals each child in sequence. */
export function Stagger({ children, className, gap = 0.08, y = 16, amount = 0.2 }: { children: ReactNode; className?: string; gap?: number; y?: number; amount?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={reduce ? false : "hidden"} whileInView="show" viewport={{ once: true, amount }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}>
      {Children.map(children, (child) => (
        <motion.div variants={{ hidden: { opacity: 0, y, filter: "blur(6px)" }, show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease: EASE } } }}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

/** Headline that blurs in word by word on load. Use "\n" for a line break. */
export function Words({ text, className, delay = 0.1, as = "h1" }: { text: string; className?: string; delay?: number; as?: "h1" | "h2" | "p" }) {
  const reduce = useReducedMotion();
  const M = motion[as];
  const lines = text.split("\n");
  let i = 0;
  return (
    <M className={className} aria-label={text.replace(/\n/g, " ")}>
      {lines.map((line, li) => (
        <span key={li} className="block" aria-hidden>
          {line.split(" ").map((w, wi) => {
            const idx = i++;
            return (
              <motion.span key={wi} className="inline-block whitespace-pre"
                initial={reduce ? false : { opacity: 0, y: "0.35em", filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.9, ease: EASE, delay: delay + idx * 0.07 }}>
                {w}{wi < line.split(" ").length - 1 ? " " : ""}
              </motion.span>
            );
          })}
        </span>
      ))}
    </M>
  );
}

/** Appears after a delay on page load (for hero badges, buttons). */
export function FadeIn({ children, delay = 0, className, y = 12 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0, y, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: 0.8, ease: EASE, delay }}>
      {children}
    </motion.div>
  );
}

/** Paragraphs that brighten word by word as they scroll through the viewport (template's statement section). */
export function ScrollLitText({ paragraphs, className, dim = "#3d3d3d", lit = "#ffffff" }: { paragraphs: { text: string; accent?: string }[]; className?: string; dim?: string; lit?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] });
  const words = paragraphs.flatMap((p, pi) => p.text.split(" ").map((w) => ({ w, pi })));
  const total = words.length;
  let k = 0;
  return (
    <div ref={ref} className={className}>
      {paragraphs.map((p, pi) => (
        <p key={pi} className="mt-6 first:mt-0">
          {p.text.split(" ").map((w, wi) => {
            const idx = k++;
            return <LitWord key={wi} progress={scrollYProgress} start={idx / total} end={(idx + 1) / total} dim={dim} lit={p.accent ?? lit} reduce={!!reduce}>{w} </LitWord>;
          })}
        </p>
      ))}
      <span className="sr-only">{words.map((x) => x.w).join(" ")}</span>
    </div>
  );
}

function LitWord({ progress, start, end, dim, lit, reduce, children }: { progress: MotionValue<number>; start: number; end: number; dim: string; lit: string; reduce: boolean; children: ReactNode }) {
  const color = useTransform(progress, [start, end], [dim, lit]);
  return <motion.span aria-hidden style={{ color: reduce ? lit : color }}>{children}</motion.span>;
}

/**
 * Animates the first number inside a formatted string ("+$9,025.92", "47.3%", "1 : 2.27")
 * from 0 when it scrolls into view, keeping prefix, suffix, separators and decimals.
 */
export function CountUp({ value, duration = 1.1 }: { value: string | number; duration?: number }) {
  const text = String(value);
  const m = text.match(/-?[\d,]*\.?\d+/);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const [frame, setFrame] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const target = m ? Number(m[0].replace(/,/g, "")) : NaN;
  const decimals = m && m[0].includes(".") ? m[0].split(".")[1].length : 0;
  const grouped = m ? m[0].includes(",") || Math.abs(target) >= 1000 : false;
  const fmt = (n: number) => (grouped ? n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : n.toFixed(decimals));
  const animatable = Boolean(m) && Number.isFinite(target) && !reduce;

  useEffect(() => {
    if (!animatable || !inView || done) return;
    const controls = animate(0, target, {
      duration, ease: EASE,
      onUpdate: (v) => setFrame(text.replace(m![0], fmt(v))),
      onComplete: () => setDone(true),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animatable, inView, done]);

  const shown = !animatable || done ? text : frame ?? text.replace(m![0], fmt(0));
  return <span ref={ref} className="tnum">{shown}</span>;
}

/** Adds a subtle parallax drift to its child while scrolling. */
export function Parallax({ children, className, distance = 60 }: { children: ReactNode; className?: string; distance?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);
  return <motion.div ref={ref} className={className} style={{ y: reduce ? 0 : y }}>{children}</motion.div>;
}
