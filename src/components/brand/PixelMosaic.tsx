// The blue pixel mosaic from the template's call-to-action band.
// Deterministic (seeded) so server and client render the same squares.

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
  const cells: { x: number; y: number; o: number }[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = r();
      // Denser, stronger towards the bottom edge.
      const bias = y / rows;
      const o = v < 0.12 + bias * 0.25 ? 0.55 + r() * 0.45 : v < 0.55 ? 0.12 + r() * 0.22 : 0.05 + r() * 0.08;
      cells.push({ x, y, o });
    }
  }
  return (
    <svg className={className} viewBox={`0 0 ${cols} ${rows}`} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width={cols} height={rows} fill="#e9eefc" />
      {cells.map((c, i) => {
        // Every 7th strong pixel gently pulses, like the template's animated mosaic.
        const tw = animated && c.o > 0.5 && i % 7 === 0;
        return (
          <rect key={`${c.x}-${c.y}`} x={c.x} y={c.y} width={1.002} height={1.002} fill="#124eeb" opacity={c.o.toFixed(3)}
            className={tw ? "twinkle" : undefined} style={tw ? ({ "--o": c.o.toFixed(3), animationDelay: `${(i % 13) * 0.35}s` } as React.CSSProperties) : undefined} />
        );
      })}
    </svg>
  );
}
