import Link from "next/link";
import { clsx } from "clsx";

// Pixel "sparkle" mark from the Lumis template: a 7×7 grid of 4.143px cells
// fading out from the centre. [x, y, opacity] in grid units.
const CELLS: [number, number, number][] = [
  [3, 3, 1],
  [3, 4, 0.6], [2, 3, 0.6], [4, 3, 0.6], [3, 2, 0.6],
  [4, 4, 0.32], [2, 4, 0.32], [3, 5, 0.32], [1, 3, 0.32], [5, 3, 0.32], [2, 2, 0.32], [4, 2, 0.32], [3, 1, 0.32],
  [5, 4, 0.07], [1, 4, 0.07], [2, 5, 0.07], [4, 5, 0.07], [3, 6, 0.07], [0, 3, 0.07], [6, 3, 0.07], [2, 1, 0.07], [1, 2, 0.07], [4, 1, 0.07], [5, 2, 0.07], [3, 0, 0.07],
];
const U = 29 / 7;

export function LogoMark({ size = 22, className, color = "var(--primary)" }: { size?: number; className?: string; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 29 29" fill="none" aria-hidden className={className}>
      <g fill={color}>
        {CELLS.map(([x, y, o]) => (
          <rect key={`${x}-${y}`} x={x * U} y={y * U} width={U} height={U} opacity={o} />
        ))}
      </g>
    </svg>
  );
}

export function Logo({ href = "/", className, size = "md", inverted = false }: { href?: string | null; className?: string; size?: "sm" | "md" | "lg"; inverted?: boolean }) {
  const mark = size === "lg" ? 28 : size === "sm" ? 18 : 22;
  const content = (
    <span className={clsx("inline-flex items-center gap-2", className)}>
      <LogoMark size={mark} color={inverted ? "#ffffff" : "var(--primary)"} />
      <span className={clsx("font-medium tracking-[-0.04em]", size === "lg" ? "text-[22px]" : size === "sm" ? "text-[15px]" : "text-[18px]", inverted ? "text-white" : "text-ink")}>
        Limus
      </span>
    </span>
  );
  if (!href) return content;
  return (
    <Link href={href} aria-label="Limus home" className="rounded-md">
      {content}
    </Link>
  );
}
