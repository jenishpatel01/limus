// PDF export with jsPDF. Charts are drawn as vectors, so they stay sharp when printed.

import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { ReportData } from "./build";
import { utcToWall } from "@/lib/dates";

// Standard PDF fonts only cover Latin-1, so amounts use the ISO code (e.g. "USD 1,234.50").
const amt = (v: number | null | undefined, cur: string, sign = false) => {
  if (v === null || v === undefined || !Number.isFinite(v)) return "-";
  const s = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${v < 0 ? "-" : sign && v > 0 ? "+" : ""}${cur} ${s}`;
};
const pc = (v: number | null | undefined, dp = 1) => (v === null || v === undefined || !Number.isFinite(v) ? "-" : `${v.toFixed(dp)}%`);
const rt = (v: number | null | undefined) => (v === null || v === undefined ? "-" : v === Infinity ? "inf" : v.toFixed(2));
const rm = (v: number | null | undefined) => (v === null || v === undefined ? "-" : `${v > 0 ? "+" : ""}${v.toFixed(2)}R`);

const INK: [number, number, number] = [0, 0, 0];
const MUTED: [number, number, number] = [122, 122, 122];
const LINE: [number, number, number] = [229, 231, 235];
const BLUE: [number, number, number] = [18, 78, 235];
const GREEN: [number, number, number] = [18, 179, 63];
const RED: [number, number, number] = [229, 72, 77];

function logo(doc: jsPDF, x: number, y: number, size: number) {
  const cells: [number, number, number][] = [[3, 3, 1], [3, 4, 0.6], [2, 3, 0.6], [4, 3, 0.6], [3, 2, 0.6], [4, 4, 0.32], [2, 4, 0.32], [3, 5, 0.32], [1, 3, 0.32], [5, 3, 0.32], [2, 2, 0.32], [4, 2, 0.32], [3, 1, 0.32]];
  const u = size / 7;
  for (const [cx, cy, o] of cells) {
    const mix = (c: number) => Math.round(255 - (255 - c) * o);
    doc.setFillColor(mix(BLUE[0]), mix(BLUE[1]), mix(BLUE[2]));
    doc.rect(x + cx * u, y + cy * u, u, u, "F");
  }
}

export function reportPdf(r: ReportData, tz: string): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  let y = M;

  logo(doc, M, y - 4, 18);
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...INK).text("Limus", M + 24, y + 9);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED).text(`Generated ${utcToWall(new Date().toISOString(), tz).replace("T", " ")} (${tz})`, W - M, y + 9, { align: "right" });
  y += 40;
  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(...INK).text(r.spec.title, M, y);
  y += 18;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...MUTED);
  const scopeLine = `${r.spec.from} to ${r.spec.to} · ${r.accountNames.join(", ") || "No accounts"}${r.strategyName ? ` · Strategy: ${r.strategyName}` : ""}`;
  doc.text(doc.splitTextToSize(scopeLine, W - 2 * M), M, y);
  y += 22;

  // KPI grid
  const s = r.stats;
  const kpis: [string, string, [number, number, number]?][] = [
    ["Net P&L", amt(s.netPnl, r.currency, true), s.netPnl >= 0 ? GREEN : RED],
    ["Trades", String(s.totalTrades)],
    ["Win rate", pc(s.winRate)],
    ["Profit factor", rt(s.profitFactor)],
    ["Expectancy", amt(s.expectancy, r.currency)],
    ["Average R", rm(s.avgR)],
    ["Max drawdown", pc(r.dd.maxDrawdownPct, 2)],
    ["Recovery factor", rt(r.recovery)],
    ["Start balance", amt(r.startBalance, r.currency)],
    ["End balance", amt(r.endBalance, r.currency)],
    ["Avg win / loss", `${amt(s.avgWin, r.currency)} / ${amt(s.avgLoss === null ? null : -s.avgLoss, r.currency)}`],
    ["Streaks (W / L)", `${s.maxConsecWins} / ${s.maxConsecLosses}`],
  ];
  const cols = 4, cw = (W - 2 * M) / cols, ch = 44;
  kpis.forEach(([label, value, color], i) => {
    const cx = M + (i % cols) * cw, cy = y + Math.floor(i / cols) * ch;
    doc.setDrawColor(...LINE).setLineWidth(0.6).roundedRect(cx + 2, cy, cw - 4, ch - 6, 4, 4, "S");
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED).text(label, cx + 10, cy + 13);
    doc.setFont("helvetica", "bold").setFontSize(i === 10 ? 8.5 : 11).setTextColor(...(color ?? INK)).text(value, cx + 10, cy + 29);
  });
  y += Math.ceil(kpis.length / cols) * ch + 12;

  // Equity curve
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...INK).text("Equity curve", M, y);
  y += 8;
  const chH = 140, chW = W - 2 * M;
  doc.setDrawColor(...LINE).setLineWidth(0.6).roundedRect(M, y, chW, chH, 4, 4, "S");
  const pts = r.curve.map((p) => p.balance);
  if (pts.length >= 2) {
    const min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1;
    const px = (i: number) => M + 10 + (i / (pts.length - 1)) * (chW - 20);
    const py = (v: number) => y + chH - 14 - ((v - min) / span) * (chH - 32);
    doc.setDrawColor(...LINE).setLineWidth(0.4);
    for (let g = 0; g <= 3; g++) { const gy = y + 18 + (g * (chH - 32)) / 3; doc.line(M + 10, gy, M + chW - 10, gy); }
    doc.setDrawColor(...BLUE).setLineWidth(1.4);
    for (let i = 1; i < pts.length; i++) doc.line(px(i - 1), py(pts[i - 1]), px(i), py(pts[i]));
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
    doc.text(amt(max, r.currency), M + 12, y + 12);
    doc.text(amt(min, r.currency), M + 12, y + chH - 4);
  } else {
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED).text("Not enough closed trades to draw a curve.", M + chW / 2, y + chH / 2, { align: "center" });
  }
  y += chH + 22;

  const table = (title: string, head: string[], body: (string | number)[][], opts: { pnlCol?: number } = {}) => {
    if (y > doc.internal.pageSize.getHeight() - 120) { doc.addPage(); y = M; }
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...INK).text(title, M, y);
    autoTable(doc, {
      startY: y + 8, head: [head], body, margin: { left: M, right: M }, theme: "plain",
      styles: { font: "helvetica", fontSize: 8, cellPadding: 4, textColor: [61, 61, 61], lineColor: LINE, lineWidth: { bottom: 0.5 } },
      headStyles: { textColor: MUTED, fontStyle: "normal", fillColor: [249, 250, 251] },
      didParseCell: (d) => {
        if (d.section === "body" && opts.pnlCol !== undefined && d.column.index === opts.pnlCol) {
          const raw = String(d.cell.raw);
          d.cell.styles.textColor = raw.startsWith("-") ? RED : raw.startsWith("+") ? GREEN : [61, 61, 61];
        }
        if (d.column.index > 0) d.cell.styles.halign = "right";
      },
    });
    y = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y) + 22;
  };

  const groupBody = (rows: ReportData["byAsset"]) => rows.map((g) => [g.label, g.trades, pc(g.winRate), rt(g.profitFactor), rm(g.avgR), amt(g.netPnl, r.currency, true)]);
  const groupHead = ["Name", "Trades", "Win rate", "PF", "Avg R", "Net P&L"];
  if (r.byStrategy.length) table("By strategy", groupHead, groupBody(r.byStrategy), { pnlCol: 5 });
  if (r.byAsset.length) table("By asset class", groupHead, groupBody(r.byAsset), { pnlCol: 5 });
  if (r.bySymbol.length) table("By symbol", groupHead, groupBody(r.bySymbol.slice(0, 15)), { pnlCol: 5 });
  if (r.days.length) table("Daily results", ["Day", "Trades", "Wins", "Losses", "Net P&L"], r.days.map((d) => [d.day, d.trades, d.wins, d.losses, amt(d.pnl, r.currency, true)]), { pnlCol: 4 });
  if (r.trades.length) table(`Trades (${r.trades.length})`, ["Closed", "Symbol", "Side", "Qty", "Entry", "Exit", "R", "Net P&L"],
    r.trades.map((t) => [utcToWall(t.exit_at, tz).replace("T", " "), t.symbol, t.direction === "long" ? "Buy" : "Sell", t.quantity, t.entry_price, t.exit_price ?? "-", rm(t.r_multiple), amt(t.net_pnl, r.currency, true)]), { pnlCol: 7 });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
    doc.text(`Limus · ${r.spec.title}`, M, doc.internal.pageSize.getHeight() - 20);
    doc.text(`Page ${i} of ${pages}`, W - M, doc.internal.pageSize.getHeight() - 20, { align: "right" });
  }
  return doc.output("blob");
}
