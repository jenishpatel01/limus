// Animated backgrounds for the landing page. Purely decorative (aria-hidden, no text, no numbers):
// strip charts that scroll like recorder tape, a conveyor of mini dashboard widgets, a flowing data
// line, radar rings and a drifting grid. All motion is CSS transform/opacity (see globals.css, .bd-*),
// seeded so server and client render the same shapes, and switched off for reduced motion.

import { useId, type CSSProperties, type ReactNode } from "react";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Tone = "auto" | "light";

/** Colours for a backdrop: follows the theme ("auto") or is fixed for always-dark sections ("light" ink on dark). */
function tones(tone: Tone): CSSProperties {
  const v = tone === "light"
    ? { "--st-c": "#80b9ff", "--st-up": "#2bc45a", "--st-dn": "#f06468", "--st-grid": "rgba(255,255,255,.16)", "--st-card": "rgba(255,255,255,.04)", "--st-card-line": "rgba(255,255,255,.14)" }
    : { "--st-c": "var(--primary)", "--st-up": "var(--profit)", "--st-dn": "var(--loss)", "--st-grid": "var(--line-strong)", "--st-card": "var(--surface)", "--st-card-line": "var(--line)" };
  return v as CSSProperties;
}

const fadeX = "linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent)";

/**
 * A wrapping series in 0..1. The last point equals the first, so two copies side by side join
 * seamlessly and the strip can scroll forever.
 */
function series(seed: number, n: number, smooth: number) {
  const r = rng(seed);
  const v = [0];
  let drift = 0;
  for (let i = 1; i <= n; i++) { drift = drift * 0.8 + (r() - 0.5) * 0.9; v.push(v[i - 1] + drift); }
  const end = v[n];
  let s = v.slice(0, n).map((x, i) => x - (end * i) / n);
  for (let k = 0; k < smooth; k++) s = s.map((_, i) => (s[(i - 1 + n) % n] + s[i] * 2 + s[(i + 1) % n]) / 4);
  const min = Math.min(...s), max = Math.max(...s), span = max - min || 1;
  return s.map((x) => (x - min) / span);
}

const COPIES = 4;

/** A chart strip that scrolls sideways forever, like paper coming off a chart recorder. */
export function StripChart({
  kind, seed = 1, height = 160, tileWidth = 1000, points = 40, seconds = 60, reverse = false, tone = "auto", ticks = false, className = "",
}: {
  kind: "line" | "area" | "candles" | "bars"; seed?: number; height?: number; tileWidth?: number; points?: number;
  seconds?: number; reverse?: boolean; tone?: Tone; ticks?: boolean; className?: string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const W = tileWidth, H = height, pad = H * 0.14, step = W / points;
  const v = series(seed, points, kind === "line" || kind === "area" ? 2 : 1);
  const y = (t: number) => pad + (1 - t) * (H - pad * 2);
  const f = (n: number) => n.toFixed(1);
  const r = rng(seed * 31 + 7);

  let body: ReactNode;
  if (kind === "line" || kind === "area") {
    const line = "M" + Array.from({ length: points + 1 }, (_, i) => `${f(i * step)} ${f(y(v[i % points]))}`).join(" L");
    body = (
      <>
        {kind === "area" && <path d={`${line} L${W} ${H} L0 ${H} Z`} fill={`url(#g${id})`} />}
        <path d={line} fill="none" strokeWidth={2} strokeLinejoin="round" style={{ stroke: "var(--st-c)" }} />
      </>
    );
  } else if (kind === "candles") {
    body = Array.from({ length: points }, (_, i) => {
      const o = v[i], c = v[(i + 1) % points];
      const hi = Math.min(1, Math.max(o, c) + 0.04 + r() * 0.1), lo = Math.max(0, Math.min(o, c) - 0.04 - r() * 0.1);
      const cx = i * step + step / 2, up = c >= o, col = up ? "var(--st-up)" : "var(--st-dn)";
      const top = y(Math.max(o, c)), bh = Math.max(3, Math.abs(y(o) - y(c)));
      return (
        <g key={i} style={{ stroke: col, fill: col }}>
          <line x1={f(cx)} x2={f(cx)} y1={f(y(hi))} y2={f(y(lo))} strokeWidth={1.5} />
          <rect x={f(cx - step * 0.27)} y={f(top)} width={f(step * 0.54)} height={f(bh)} rx={2} stroke="none" />
        </g>
      );
    });
  } else {
    body = Array.from({ length: points }, (_, i) => {
      const bh = 8 + v[i] * (H - pad * 2 - 8);
      return <rect key={i} x={f(i * step + step * 0.2)} y={f(H - bh)} width={f(step * 0.6)} height={f(bh)} rx={3} style={{ fill: "var(--st-c)" }} opacity={0.35 + v[i] * 0.5} />;
    });
  }

  const tickPath = ticks
    ? Array.from({ length: Math.floor(W / 20) + 1 }, (_, i) => `M${i * 20} ${H} L${i * 20} ${H - (i % 5 === 0 ? 12 : 6)}`).join(" ")
    : "";

  return (
    <div aria-hidden className={`pointer-events-none overflow-hidden ${className}`} style={{ height: H, ...tones(tone), maskImage: fadeX, WebkitMaskImage: fadeX }}>
      <svg className="bd-strip" width={W * COPIES} height={H} style={{ ["--bd-w" as string]: `${W}px`, animationDuration: `${seconds}s`, animationDirection: reverse ? "reverse" : "normal" }}>
        <defs>
          {kind === "area" && (
            <linearGradient id={`g${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" style={{ stopColor: "var(--st-c)", stopOpacity: 0.28 }} />
              <stop offset="1" style={{ stopColor: "var(--st-c)", stopOpacity: 0 }} />
            </linearGradient>
          )}
          <g id={`t${id}`}>
            {body}
            {ticks && <path d={tickPath} fill="none" strokeWidth={1} style={{ stroke: "var(--st-grid)" }} />}
          </g>
        </defs>
        {Array.from({ length: COPIES }, (_, k) => <use key={k} href={`#t${id}`} x={k * W} />)}
      </svg>
    </div>
  );
}

/** One abstract dashboard widget (no text, no numbers) drawn inside a 132 x 84 card. */
function widget(kind: number, r: () => number): ReactNode {
  const label = <rect x={14} y={12} width={34} height={4} rx={2} style={{ fill: "var(--st-grid)" }} />;
  switch (kind % 6) {
    case 0: // bar chart
      return <>{label}{Array.from({ length: 7 }, (_, j) => { const h = 12 + r() * 38; return <rect key={j} x={14 + j * 15} y={74 - h} width={9} height={h} rx={2.5} style={{ fill: j === 6 ? "var(--st-c)" : "var(--st-grid)" }} />; })}</>;
    case 1: { // donut
      const a = 0.35 + r() * 0.5, C = 2 * Math.PI * 21;
      return <>{label}<g transform="translate(66 50) rotate(-90)"><circle r={21} fill="none" strokeWidth={8} style={{ stroke: "var(--st-grid)" }} opacity={0.5} /><circle r={21} fill="none" strokeWidth={8} strokeLinecap="round" strokeDasharray={`${(C * a).toFixed(1)} ${C.toFixed(1)}`} style={{ stroke: "var(--st-up)" }} /></g></>;
    }
    case 2: { // sparkline
      const p = Array.from({ length: 12 }, (_, j) => `${14 + j * 9.6} ${(64 - (r() * 0.5 + j * 0.04) * 38).toFixed(1)}`);
      return <>{label}<path d={`M${p.join(" L")}`} fill="none" strokeWidth={2} strokeLinejoin="round" style={{ stroke: "var(--st-c)" }} /><path d={`M${p.join(" L")} L118 74 L14 74Z`} style={{ fill: "var(--st-c)" }} opacity={0.12} /></>;
    }
    case 3: // progress rows
      return <>{label}{[0, 1, 2].map((j) => <g key={j}><rect x={14} y={30 + j * 16} width={104} height={6} rx={3} style={{ fill: "var(--st-grid)" }} opacity={0.5} /><rect x={14} y={30 + j * 16} width={30 + r() * 74} height={6} rx={3} style={{ fill: j === 2 ? "var(--st-dn)" : j === 1 ? "var(--st-up)" : "var(--st-c)" }} /></g>)}</>;
    case 4: // mini candles
      return <>{label}{Array.from({ length: 8 }, (_, j) => { const t = 28 + r() * 22, h = 8 + r() * 18, up = r() > 0.4, c = up ? "var(--st-up)" : "var(--st-dn)"; return <g key={j} style={{ fill: c, stroke: c }}><line x1={20 + j * 13} x2={20 + j * 13} y1={t - 6} y2={t + h + 6} strokeWidth={1.2} /><rect x={16.5 + j * 13} y={t} width={7} height={h} rx={1.5} stroke="none" /></g>; })}</>;
    default: // heat grid
      return <>{label}{Array.from({ length: 12 }, (_, j) => <rect key={j} x={14 + (j % 6) * 18} y={28 + Math.floor(j / 6) * 22} width={14} height={18} rx={3} style={{ fill: r() > 0.85 ? "var(--st-dn)" : "var(--st-c)" }} opacity={0.12 + r() * 0.6} />)}</>;
  }
}

/** A conveyor belt of tiny dashboard widgets drifting sideways. Decorative: shapes only, no data. */
export function WidgetTape({ seed = 3, seconds = 90, reverse = false, tone = "auto", className = "" }: { seed?: number; seconds?: number; reverse?: boolean; tone?: Tone; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const r = rng(seed);
  const cw = 132, ch = 84, gap = 24, count = 9, W = count * (cw + gap), H = ch + 8;
  const offset = Math.floor(r() * 6);
  return (
    <div aria-hidden className={`pointer-events-none overflow-hidden ${className}`} style={{ height: H, ...tones(tone), maskImage: fadeX, WebkitMaskImage: fadeX }}>
      <svg className="bd-strip" width={W * 3} height={H} style={{ ["--bd-w" as string]: `${W}px`, animationDuration: `${seconds}s`, animationDirection: reverse ? "reverse" : "normal" }}>
        <defs>
          <g id={`w${id}`}>
            {Array.from({ length: count }, (_, i) => (
              <g key={i} transform={`translate(${i * (cw + gap)} 4)`}>
                <rect width={cw} height={ch} rx={10} style={{ fill: "var(--st-card)", stroke: "var(--st-card-line)" }} />
                {widget(i + offset, r)}
              </g>
            ))}
          </g>
        </defs>
        {[0, 1, 2].map((k) => <use key={k} href={`#w${id}`} x={k * W} />)}
      </svg>
    </div>
  );
}

/** A dashed data line that flows between the three "how it works" steps, with glowing pulses riding along it. */
export function FlowPath({ className = "" }: { className?: string }) {
  const d = "M0 22 C 120 -6, 200 50, 330 22 S 560 -6, 700 22 S 940 50, 1060 22 S 1230 0, 1296 22";
  return (
    <svg aria-hidden className={`pointer-events-none absolute inset-x-0 top-0 hidden h-11 w-full md:block ${className}`} viewBox="0 0 1296 44" preserveAspectRatio="none">
      <path d={d} fill="none" strokeWidth={2} strokeDasharray="6 8" className="bd-dash" vectorEffect="non-scaling-stroke" style={{ stroke: "var(--line-strong)" }} />
      <path d={d} fill="none" strokeWidth={2} strokeDasharray="60 1400" strokeLinecap="round" className="bd-comet" vectorEffect="non-scaling-stroke" style={{ stroke: "var(--primary)" }} />
      <path d={d} fill="none" strokeWidth={2} strokeDasharray="60 1400" strokeLinecap="round" className="bd-comet bd-comet-2" vectorEffect="non-scaling-stroke" style={{ stroke: "var(--profit)" }} />
    </svg>
  );
}

/** Radar-style rings that expand and fade from a point (used behind the Security section). */
export function PulseRings({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute ${className}`}>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="bd-ring absolute inset-0 rounded-full border border-primary/40" style={{ ["--dl" as string]: `${i * 1.6}s` }} />
      ))}
      <span className="live-dot absolute left-1/2 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
    </div>
  );
}

/** A faint grid that slowly pans diagonally, fading out towards the edges. */
export function GridDrift({ tone = "auto", size = 48, className = "" }: { tone?: Tone; size?: number; className?: string }) {
  const line = tone === "light" ? "rgba(255,255,255,.08)" : "var(--line)";
  const mask = "radial-gradient(ellipse 75% 75% at 50% 50%, #000 25%, transparent 80%)";
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} style={{ maskImage: mask, WebkitMaskImage: mask }}>
      <div className="bd-grid absolute" style={{ inset: `-${size}px 0 0 -${size}px`, backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`, backgroundSize: `${size}px ${size}px`, ["--bd-g" as string]: `${size}px` }} />
    </div>
  );
}

/** Drifting colour orbs (blue, cyan, violet) that give glass panels something to blur. */
const ORB_SETS: [number, number, string, string, number][][] = [
  [[1, 560, "66%", "-14%", 24], [2, 440, "-8%", "34%", 28], [3, 400, "46%", "68%", 26]],
  [[3, 520, "-10%", "-10%", 26], [1, 480, "62%", "28%", 22], [2, 400, "18%", "74%", 30]],
  [[2, 520, "58%", "-16%", 28], [3, 440, "-6%", "28%", 24], [1, 420, "68%", "64%", 22]],
];
export function Orbs({ variant = 0, fixed = false, className = "" }: { variant?: number; fixed?: boolean; className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none inset-0 z-0 overflow-hidden ${fixed ? "fixed" : "absolute"} ${className}`}>
      {ORB_SETS[variant % ORB_SETS.length].map(([c, size, x, y, secs], i) => (
        <span key={i} className="orb" style={{ width: size, height: size, left: x, top: y, ["--orb" as string]: `var(--orb-${c})`, ["--od" as string]: `${secs}s`, ["--odl" as string]: `${-i * 7}s`, ["--dx" as string]: `${i % 2 ? -70 : 80}px`, ["--dy" as string]: `${i === 1 ? 60 : -50}px` }} />
      ))}
    </div>
  );
}

/** Hero background: colour orbs, three charts at different speeds, and a recorder scan line sweeping across. */
export function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <Orbs variant={0} />
      <StripChart kind="candles" seed={5} height={150} points={36} seconds={110} reverse className="absolute inset-x-0 top-[14%] hidden opacity-45 lg:block" />
      <StripChart kind="line" seed={9} height={210} points={44} seconds={70} ticks className="absolute inset-x-0 top-[46%] hidden opacity-60 lg:block" />
      <StripChart kind="area" seed={14} height={260} points={34} seconds={95} className="absolute inset-x-0 bottom-0 opacity-70" />
      {/* Keeps the headline readable: the charts fade out behind the text column. */}
      <div className="absolute inset-y-0 left-0 hidden w-[56%] bg-gradient-to-r from-bg via-bg/85 to-transparent lg:block" />
      <div className="bd-scan absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
      <div className="bd-scan absolute inset-y-0 left-0 w-px bg-primary/50" style={{ ["--bd-off" as string]: "96px" }} />
    </div>
  );
}
