// The blue pixel mosaic from the template's call-to-action band.
// Deterministic (seeded) so server and client render the same squares.
//
// When `animated`:
//  - bright squares flash quickly and shift towards a lighter blue, each on its own rhythm,
//  - about a third of the quieter squares breathe,
//  - a soft band of light sweeps across the whole mosaic,
//  - squares flare up when the cursor passes over them.
// Timing and colours live in globals.css (.mz-*), so reduced motion can switch them off.

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

export function PixelMosaic({ cols = 32, rows = 12, seed = 7, className, animated = false }: { cols?: number; rows?: number; seed?: number; className?: string; animated?: boolean }) {
  const r = rng(seed);
  // Separate generator for animation timing, so the square pattern itself never changes.
  const a = rng(seed + 991);
  const cells: { x: number; y: number; o: number; kind: "flash" | "soft" | null; dur: number; delay: number }[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = r();
      // Denser, stronger towards the bottom edge.
      const bias = y / rows;
      const o = v < 0.12 + bias * 0.25 ? 0.55 + r() * 0.45 : v < 0.55 ? 0.12 + r() * 0.22 : 0.05 + r() * 0.08;
      const p = a(), d = a(), l = a();
      const kind = !animated ? null : o > 0.5 ? "flash" : o > 0.1 && p < 0.35 ? "soft" : null;
      cells.push({ x, y, o, kind, dur: kind === "flash" ? 0.7 + d * 1.1 : 1.4 + d * 1.6, delay: -l * 3 });
    }
  }
  return (
    <svg className={className} viewBox={`0 0 ${cols} ${rows}`} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="mz-sweep-grad" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" style={{ stopColor: "var(--mosaic-glow)", stopOpacity: 0 }} />
          <stop offset="0.5" style={{ stopColor: "var(--mosaic-glow)", stopOpacity: 0.7 }} />
          <stop offset="1" style={{ stopColor: "var(--mosaic-glow)", stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <rect width={cols} height={rows} style={{ fill: "var(--mosaic-bg)" }} />
      {cells.map((c) => (
        <rect key={`${c.x}-${c.y}`} x={c.x} y={c.y} width={1.002} height={1.002} opacity={c.o.toFixed(3)}
          className={animated ? `mz-cell${c.kind ? ` mz-${c.kind}` : ""}` : undefined}
          style={{ fill: "var(--primary)", ...(c.kind || animated ? ({ "--o": c.o.toFixed(3), "--d": `${c.dur.toFixed(2)}s`, "--dl": `${c.delay.toFixed(2)}s` } as React.CSSProperties) : {}) }} />
      ))}
      {animated && (
        <g className="mz-sweep" style={{ pointerEvents: "none", ["--mz-w" as string]: `${cols * 1.5}px` }}>
          <rect x={-cols * 0.3} y={-1} width={cols * 0.3} height={rows + 2} fill="url(#mz-sweep-grad)" transform="skewX(-18)" />
        </g>
      )}
    </svg>
  );
}
