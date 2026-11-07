import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight, BarChart3, BookOpen, CalendarDays, Camera, ChevronDown, FileText, Layers, Lock, PenLine, ShieldCheck, Sparkles, Upload, Wallet, Zap,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { PixelMosaic } from "@/components/brand/PixelMosaic";

export const metadata: Metadata = {
  title: "Limus — Turn your trades into decisions",
  description: "A trading journal and portfolio platform for forex, crypto, stocks, indices and commodities. Accurate P&L, clean analytics, private by default.",
};

const btnPrimary = "inline-flex h-10 items-center gap-1.5 rounded-md bg-[#124eeb] px-4 font-button text-[14px] font-semibold tracking-[-0.015em] text-white shadow-btn transition-colors hover:bg-[#0f43cc]";
const btnSecondary = "inline-flex h-10 items-center gap-1.5 rounded-md bg-white px-4 text-[14px] font-medium text-black shadow-[0_0_0_1px_#d1d5db,var(--shadow-btn)] transition-colors hover:bg-[#f9fafb]";

export default function Home() {
  return (
    <div className="bg-white text-black" data-theme="light">
      <Nav />
      <main>
        <Hero />
        <Markets />
        <HowItWorks />
        <ProductPreview />
        <Statement />
        <SpeedSection />
        <Features />
        <Security />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#e5e7eb] bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 sm:px-8 lg:px-[52px]">
        <Logo />
        <nav aria-label="Primary" className="hidden items-center gap-8 text-[14px] text-black md:flex">
          <a href="#features" className="hover:text-[#616161]">Features</a>
          <a href="#how" className="hover:text-[#616161]">How it works</a>
          <a href="#security" className="hover:text-[#616161]">Security</a>
          <a href="#faq" className="hover:text-[#616161]">FAQ</a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/login" className="text-[14px] text-[#3d3d3d] hover:text-black">Log in</Link>
          <Link href="/register" className={btnPrimary}>Start for free</Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-[1400px] items-center gap-12 px-4 pb-20 pt-14 sm:px-8 lg:grid-cols-[minmax(0,560px)_1fr] lg:px-[52px] lg:pb-28 lg:pt-24">
        <div className="relative z-10">
          <a href="#features" className="inline-flex items-center overflow-hidden rounded-md text-[12px] shadow-[0_0_0_1px_#e5e7eb]">
            <span className="bg-white px-2.5 py-1.5 font-medium">Journal · Portfolio · Analytics</span>
            <span className="flex items-center gap-1 border-l border-[#e5e7eb] bg-[#f9fafb] px-2.5 py-1.5 text-[#616161]">See features <ChevronDown className="size-3 -rotate-90" /></span>
          </a>
          <h1 className="mt-7 text-[44px] font-medium leading-[1.02] tracking-[-0.045em] sm:text-[60px]">Turn your trades<br />into decisions.</h1>
          <p className="mt-6 max-w-md text-[18px] font-medium leading-[1.5] tracking-[-0.02em] text-[#616161]">Log every trade, keep each account separate, and watch Limus show you exactly where your edge comes from.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/register" className={btnPrimary}>Start for free</Link>
            <Link href="/login" className={btnSecondary}>Log in</Link>
          </div>
          <p className="mt-4 text-[12.5px] font-medium text-[#124eeb]">Free to use · No credit card · Explore with a demo account</p>
        </div>
        <HeroCollage />
      </div>
    </section>
  );
}

/** Illustration of the product (sample numbers), styled like the template's tilted chart collage. */
function HeroCollage() {
  const bars = [38, 52, 30, 64, 46, 72, 58, 80, 66, 90];
  return (
    <div aria-hidden className="relative h-[420px] select-none [perspective:1600px] lg:h-[520px]">
      <div className="absolute inset-0 origin-center [transform:rotateX(38deg)_rotateZ(-24deg)_scale(1.05)] [transform-style:preserve-3d]">
        <div className="grid grid-cols-2 gap-5 opacity-90 grayscale-[35%]">
          <Tile className="col-span-2 h-44">
            <p className="text-[11px] text-[#7a7a7a]">Equity curve</p>
            <p className="text-[22px] font-medium tracking-[-0.03em]">$31,482.20</p>
            <svg viewBox="0 0 300 70" className="mt-2 h-16 w-full"><path d="M0 60 L30 55 L60 58 L90 44 L120 47 L150 34 L180 38 L210 24 L240 27 L270 14 L300 10" fill="none" stroke="#124eeb" strokeWidth="2.5" /><path d="M0 60 L30 55 L60 58 L90 44 L120 47 L150 34 L180 38 L210 24 L240 27 L270 14 L300 10 L300 70 L0 70Z" fill="#124eeb" opacity=".08" /></svg>
          </Tile>
          <Tile className="h-40">
            <p className="text-[11px] text-[#7a7a7a]">Win rate</p>
            <p className="text-[26px] font-medium tracking-[-0.03em]">54.2%</p>
            <div className="mt-3 flex h-12 items-end gap-1.5">{bars.slice(0, 7).map((b, i) => <span key={i} className="w-3 rounded-[3px] bg-[#e5e7eb]" style={{ height: `${b}%`, background: i === 6 ? "#124eeb" : undefined }} />)}</div>
          </Tile>
          <Tile className="h-40">
            <p className="text-[11px] text-[#7a7a7a]">Profit factor</p>
            <p className="text-[26px] font-medium tracking-[-0.03em]">1.86</p>
            <div className="mt-4 h-2 rounded-full bg-[#f3f4f6]"><div className="h-2 w-[68%] rounded-full bg-[#12b33f]" /></div>
          </Tile>
          <Tile className="col-span-2 h-44">
            <p className="text-[11px] text-[#7a7a7a]">Daily P&amp;L</p>
            <div className="mt-3 flex h-24 items-end gap-2">{[30, 18, 42, 22, 26, 55, 12, 10, 38, 46, 14, 28].map((v, i) => <span key={i} className="flex-1 rounded-[3px]" style={{ height: `${v + 20}%`, background: [1, 4, 7, 10].includes(i) ? "#e5484d" : "#12b33f" }} />)}</div>
          </Tile>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-white lg:to-white/70" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white to-transparent" />
    </div>
  );
}

function Tile({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl bg-white p-4 shadow-[0_0_0_1px_#e5e7eb,0_10px_26px_-4.5px_rgba(0,0,0,0.06)] ${className}`}>{children}</div>;
}

function SectionHead({ eyebrow, title, sub, center = true }: { eyebrow: string; title: React.ReactNode; sub?: React.ReactNode; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-xl"}>
      <p className="text-[14px] font-medium text-[#124eeb]">{eyebrow}</p>
      <h2 className="mt-3 text-[34px] font-medium leading-[1.08] tracking-[-0.04em] sm:text-[44px]">{title}</h2>
      {sub && <p className="mt-4 text-[16px] font-medium leading-[1.5] tracking-[-0.02em] text-[#616161]">{sub}</p>}
    </div>
  );
}

function Markets() {
  const items = ["Forex", "Crypto", "Stocks", "Indices", "Commodities"];
  return (
    <section className="border-y border-[#e5e7eb] bg-[#f9fafb]">
      <div className="mx-auto flex max-w-[1400px] flex-col items-center gap-6 px-4 py-12 sm:px-8 md:flex-row md:justify-between lg:px-[52px]">
        <p className="max-w-xs text-center text-[16px] font-medium leading-snug tracking-[-0.02em] text-[#616161] md:text-left"><span className="text-black">Built for every market</span> you trade, with correct contract math for each.</p>
        <ul className="flex flex-wrap justify-center gap-x-10 gap-y-3">
          {items.map((i) => <li key={i} className="flex items-center gap-2 text-[18px] font-medium tracking-[-0.03em]"><LogoMark size={14} />{i}</li>)}
        </ul>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: PenLine, t: "Log.", d: "Add trades in seconds, or import your history from a CSV. Prices, size, costs, notes and screenshots." },
    { icon: BarChart3, t: "Analyse.", d: "Limus calculates net P&L, R multiples, drawdown and 20+ statistics from your real numbers." },
    { icon: Sparkles, t: "Improve.", d: "See which setups, sessions and habits make or lose money, and adjust your plan." },
  ];
  return (
    <section id="how" className="scroll-mt-20 py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8 lg:px-[52px]">
        <SectionHead eyebrow="How it works" title="From trade to insight in 3 simple steps." />
        <div className="mt-16 grid gap-10 md:grid-cols-3 md:gap-0">
          {steps.map((s, i) => (
            <div key={s.t} className={`px-0 md:px-10 ${i > 0 ? "md:border-l md:border-[#e5e7eb]" : ""}`}>
              <s.icon className="size-6" strokeWidth={1.5} />
              <p className="mt-5 text-[16px] font-medium leading-[1.5] tracking-[-0.02em] text-[#616161]"><span className="text-black">{s.t}</span> {s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductPreview() {
  const stats = [["Net profit", "+$6,482.20", "#12b33f"], ["Win rate", "54.2%", "#000"], ["Profit factor", "1.86", "#000"], ["Max drawdown", "6.4%", "#e5484d"]];
  return (
    <section className="pb-24 lg:pb-32">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8 lg:px-[52px]">
        <div className="overflow-hidden rounded-2xl bg-white shadow-[0_0_0_1px_#e5e7eb,0_10px_26px_-4.5px_rgba(0,0,0,0.06)]">
          <div className="grid lg:grid-cols-[230px_1fr]">
            <aside className="hidden border-r border-[#e5e7eb] p-4 lg:block">
              <div className="flex items-center gap-2.5 rounded-lg px-2 py-2"><span className="flex size-8 items-center justify-center rounded-full bg-[#0c2442] text-[12px] text-white">AM</span><span><span className="block text-[13px] font-medium">Alex Morgan</span><span className="block text-[11.5px] text-[#7a7a7a]">Sample account</span></span></div>
              <ul className="mt-4 space-y-0.5 text-[13.5px] text-[#3d3d3d]">
                {[["Dashboard", BarChart3], ["Trading Journal", BookOpen], ["Portfolio", Wallet], ["Calendar", CalendarDays], ["Strategies", Layers], ["Risk Management", ShieldCheck], ["Reports", FileText]].map(([l, I], i) => {
                  const Icon = I as typeof BarChart3;
                  return <li key={l as string} className={`flex h-9 items-center gap-2.5 rounded-lg px-2.5 ${i === 0 ? "bg-[#f3f4f6] font-medium text-black" : ""}`}><Icon className="size-4" strokeWidth={1.5} />{l as string}</li>;
                })}
              </ul>
            </aside>
            <div className="p-5 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[22px] font-medium tracking-[-0.04em]">Welcome back, Alex</p>
                <div className="flex gap-0.5 rounded-md bg-[#f3f4f6] p-0.5 text-[12px]">{["1D", "1W", "1M", "3M", "YTD", "All"].map((p) => <span key={p} className={`rounded-[6px] px-2 py-1 ${p === "3M" ? "bg-white shadow-[0_1px_2px_rgba(0,0,0,.08)]" : "text-[#7a7a7a]"}`}>{p}</span>)}</div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {stats.map(([l, v, c]) => (
                  <div key={l} className="rounded-xl p-4 shadow-[0_0_0_1px_#e5e7eb]"><p className="text-[12.5px] text-[#7a7a7a]">{l}</p><p className="mt-1 text-[22px] font-medium tracking-[-0.03em]" style={{ color: c }}>{v}</p></div>
                ))}
              </div>
              <div className="mt-4 rounded-xl p-5 shadow-[0_0_0_1px_#e5e7eb]">
                <p className="text-[14px] font-medium">Equity curve</p>
                <svg viewBox="0 0 800 180" className="mt-3 h-44 w-full" preserveAspectRatio="none"><g stroke="#e5e7eb" strokeDasharray="3 4">{[30, 75, 120, 165].map((y) => <line key={y} x1="0" x2="800" y1={y} y2={y} />)}</g><path d="M0 150 C60 146 90 140 130 132 S200 120 240 126 S320 100 360 96 S430 104 470 84 S560 70 600 58 S700 46 740 34 L800 26" fill="none" stroke="#124eeb" strokeWidth="2.5" /></svg>
              </div>
              <p className="mt-3 text-[11.5px] text-[#adadad]">Illustration with sample numbers.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Statement() {
  return (
    <section className="bg-black py-28 text-white lg:py-36">
      <div className="mx-auto max-w-[760px] px-6">
        <p className="text-[24px] font-medium leading-[1.3] tracking-[-0.035em] sm:text-[30px]">A trade isn&apos;t just a number. It&apos;s a decision.</p>
        <p className="mt-6 text-[24px] font-medium leading-[1.3] tracking-[-0.035em] text-[#adadad] sm:text-[30px]">Limus keeps the numbers honest and the context attached: the setup, the emotions, the mistakes, the lesson. So every trade teaches you something.</p>
        <p className="mt-6 text-[24px] font-medium leading-[1.3] tracking-[-0.035em] sm:text-[30px]">Less guessing. <span className="text-[#80b9ff]">More clarity.</span></p>
      </div>
    </section>
  );
}

function SpeedSection() {
  const rows = [
    { icon: Zap, t: "Instant calculations.", d: "Gross and net P&L, risk, R multiple and pip value update as you type." },
    { icon: Camera, t: "Context that sticks.", d: "Screenshots, emotions, mistakes and lessons live with every trade." },
    { icon: ShieldCheck, t: "Built-in discipline.", d: "Daily loss limits, drawdown tracking and risk-per-trade alerts." },
  ];
  return (
    <section className="py-24 lg:py-32">
      <div className="mx-auto grid max-w-[1400px] items-center gap-14 px-4 sm:px-8 lg:grid-cols-[minmax(0,480px)_1fr] lg:px-[52px]">
        <div>
          <p className="text-[14px] font-medium text-[#124eeb]">Precision meets discipline</p>
          <h2 className="mt-3 text-[30px] font-medium leading-[1.15] tracking-[-0.04em] sm:text-[34px]">Spreadsheets take hours. Limus takes seconds. <span className="text-[#7a7a7a]">Focus on trading, not formulas.</span></h2>
          <p className="mt-5 text-[16px] font-medium leading-[1.5] tracking-[-0.02em] text-[#616161]">Contract sizes, pip values, currency conversion and costs are handled for forex, crypto, stocks, indices and commodities.</p>
          <ul className="mt-10 space-y-7">
            {rows.map((r) => (
              <li key={r.t} className="grid grid-cols-[1fr_1.1fr] gap-6">
                <span className="flex items-center gap-2 text-[16px] font-medium tracking-[-0.02em]"><r.icon className="size-[18px]" strokeWidth={1.5} />{r.t}</span>
                <span className="text-[14px] font-medium leading-[1.5] text-[#7a7a7a]">{r.d}</span>
              </li>
            ))}
          </ul>
        </div>
        <div aria-hidden className="rounded-2xl bg-white p-6 shadow-[0_0_0_1px_#e5e7eb,0_10px_26px_-4.5px_rgba(0,0,0,0.06)]">
          <div className="flex gap-1 text-[12px]">{["Overview", "Strategies", "Sessions", "Calendar"].map((t, i) => <span key={t} className={`rounded-md px-2.5 py-1 ${i === 0 ? "bg-[#f3f4f6] text-black" : "text-[#7a7a7a]"}`}>{t}</span>)}</div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["Expectancy", "$42.10"], ["Avg R", "+0.38R"], ["Payoff", "1.72"], ["Recovery", "3.1"]].map(([l, v]) => (
              <div key={l} className="rounded-lg p-3 shadow-[0_0_0_1px_#e5e7eb]"><p className="text-[11px] text-[#7a7a7a]">{l}</p><p className="mt-1 text-[17px] font-medium">{v}</p></div>
            ))}
          </div>
          <div className="mt-5 rounded-lg p-4 shadow-[0_0_0_1px_#e5e7eb]">
            <p className="text-[12.5px] font-medium">Performance by session</p>
            <div className="mt-4 space-y-3 text-[12px]">
              {[["London", 82, "#12b33f"], ["London / NY overlap", 64, "#12b33f"], ["New York", 38, "#12b33f"], ["Asian", 24, "#e5484d"]].map(([l, w, c]) => (
                <div key={l as string} className="grid grid-cols-[130px_1fr] items-center gap-3"><span className="text-[#3d3d3d]">{l as string}</span><span className="h-2 rounded-full bg-[#f3f4f6]"><span className="block h-2 rounded-full" style={{ width: `${w}%`, background: c as string }} /></span></div>
              ))}
            </div>
          </div>
          <p className="mt-3 text-[11.5px] text-[#adadad]">Illustration with sample numbers.</p>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    { icon: BookOpen, t: "Trading journal", d: "Every field a serious trader needs, with search, filters, tags and duplicates." },
    { icon: Wallet, t: "Multi-account portfolio", d: "Personal, funded, prop challenge and paper accounts, each with its own balance." },
    { icon: BarChart3, t: "Analytics centre", d: "Win rate, profit factor, expectancy, drawdown and breakdowns by any dimension." },
    { icon: CalendarDays, t: "Trading calendar", d: "Green and red days at a glance, with that day's trades and notes one click away." },
    { icon: Layers, t: "Strategy library", d: "Document your playbook and compare each strategy's real performance." },
    { icon: ShieldCheck, t: "Risk management", d: "Position size, R:R, stop and target calculators that know contract specs." },
    { icon: FileText, t: "PDF & CSV reports", d: "Daily, weekly, monthly, yearly, account and strategy reports." },
    { icon: Upload, t: "CSV import", d: "Map columns, validate every row and skip duplicates automatically." },
  ];
  return (
    <section id="features" className="scroll-mt-20 border-t border-[#e5e7eb] bg-[#f9fafb] py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8 lg:px-[52px]">
        <SectionHead eyebrow="Features" title={<>Everything you need to<br className="hidden sm:block" /> trade with clarity.</>} sub="From your first trade to a full performance review, Limus gives you professional tools without the spreadsheet." />
        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((f) => (
            <div key={f.t} className="rounded-xl bg-white p-6 shadow-[0_0_0_1px_#e5e7eb]">
              <f.icon className="size-6" strokeWidth={1.5} />
              <p className="mt-6 text-[16px] font-medium tracking-[-0.02em]">{f.t}</p>
              <p className="mt-1.5 text-[14px] font-medium leading-[1.5] text-[#7a7a7a]">{f.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Security() {
  const items = [
    { icon: Lock, t: "Private by default", d: "Row Level Security on every table: only you can read or change your records." },
    { icon: Camera, t: "Private screenshots", d: "Images are stored in a private bucket and shown through short-lived signed links." },
    { icon: FileText, t: "Your data, exportable", d: "Export every trade as CSV whenever you like. Delete everything with one action." },
    { icon: ShieldCheck, t: "No investment advice", d: "Limus records and analyses. It never places trades or tells you what to buy." },
  ];
  return (
    <section id="security" className="scroll-mt-20 py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8 lg:px-[52px]">
        <SectionHead eyebrow="Security" title="Your trades stay yours." sub="Your trading history is sensitive. Limus is built so that nobody else can see it." />
        <div className="mt-16 grid overflow-hidden rounded-xl shadow-[0_0_0_1px_#e5e7eb] sm:grid-cols-2 lg:grid-cols-4">
          {items.map((s, i) => (
            <div key={s.t} className={`p-6 ${i > 0 ? "border-t border-[#e5e7eb] sm:border-t-0 sm:border-l" : ""} ${i === 2 ? "sm:border-l-0 sm:border-t lg:border-l lg:border-t-0" : ""} ${i === 3 ? "sm:border-t lg:border-t-0" : ""}`}>
              <p className="flex items-center gap-2 text-[14px] font-medium"><s.icon className="size-4" strokeWidth={1.5} />{s.t}</p>
              <p className="mt-2 text-[13px] font-medium leading-[1.5] text-[#7a7a7a]">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const qs = [
    ["Which markets does Limus support?", "Forex, crypto, stocks, indices and commodities, including futures. Each trade stores its contract size and currency conversion, so P&L is calculated correctly for every instrument."],
    ["Does Limus connect to my broker?", "Not yet. Import your history from any CSV export with the column-mapping importer, or log trades by hand. Direct broker and exchange connections are on the roadmap."],
    ["How is P&L calculated?", "Gross P&L = (exit − entry) × direction × quantity × contract size × conversion rate. Net P&L subtracts commission and fees and adds swap and funding. The database recalculates it on every save, so stored numbers are always consistent."],
    ["Can I track several accounts?", "Yes. Each account (personal, funded, prop challenge, paper…) keeps its own balance, deposits, withdrawals and drawdown. Accounts in the same currency are combined into a portfolio view."],
    ["Is there sample data to explore?", "Yes. You can load a clearly labelled demo account with about 150 sample trades. It's never mixed into your real totals, and you can remove it in one click."],
    ["Does it work on my phone?", "Limus is a progressive web app. Add it to your home screen for a full-screen, app-like experience on iOS and Android."],
  ];
  return (
    <section id="faq" className="scroll-mt-20 border-t border-[#e5e7eb] py-24 lg:py-32">
      <div className="mx-auto grid max-w-[1400px] gap-12 px-4 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:px-[52px]">
        <div>
          <h2 className="text-[34px] font-medium leading-[1.08] tracking-[-0.04em] sm:text-[44px]">Frequently<br />asked questions.</h2>
          <p className="mt-5 text-[16px] font-medium text-[#616161]">Have another question?</p>
          <Link href="/register" className="mt-2 inline-flex items-center gap-1 text-[14px] font-medium">Try it with the demo account <ArrowRight className="size-3.5" /></Link>
        </div>
        <div className="space-y-3">
          {qs.map(([q, a]) => (
            <details key={q} className="group rounded-xl bg-white shadow-[0_0_0_1px_#e5e7eb] [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-medium tracking-[-0.02em]">{q}<ChevronDown className="size-4 shrink-0 text-[#7a7a7a] transition-transform group-open:rotate-180" /></summary>
              <p className="px-5 pb-5 text-[14px] font-medium leading-[1.6] text-[#616161]">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section className="relative overflow-hidden">
      <PixelMosaic className="absolute inset-0 h-full w-full" cols={40} rows={12} />
      <div className="relative mx-auto flex max-w-[1400px] flex-col items-center px-4 py-28 text-center sm:py-36">
        <h2 className="text-[34px] font-medium leading-[1.08] tracking-[-0.04em] sm:text-[48px]">Ready to trade<br />with more clarity?</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/register" className={btnPrimary}>Start for free</Link>
          <a href="#features" className={btnSecondary}>See features</a>
        </div>
        <p className="mt-4 text-[12.5px] font-medium text-black/70">No credit card required.</p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[#1c1c1c] text-white">
      <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-8 lg:px-[52px]">
        <div className="flex flex-wrap items-center justify-between gap-6 border-b border-white/10 pb-10">
          <Logo inverted href="/" />
          <p className="text-[20px] font-medium tracking-[-0.03em] sm:text-[24px]">Your trades, illuminated.</p>
        </div>
        <div className="grid grid-cols-2 gap-8 pt-10 text-[14px] sm:grid-cols-3">
          <div><p className="text-[13px] text-[#adadad]">Product</p><ul className="mt-4 space-y-2.5"><li><a href="#features" className="hover:text-[#80b9ff]">Features</a></li><li><a href="#how" className="hover:text-[#80b9ff]">How it works</a></li><li><a href="#faq" className="hover:text-[#80b9ff]">FAQ</a></li></ul></div>
          <div><p className="text-[13px] text-[#adadad]">Account</p><ul className="mt-4 space-y-2.5"><li><Link href="/register" className="hover:text-[#80b9ff]">Create account</Link></li><li><Link href="/login" className="hover:text-[#80b9ff]">Log in</Link></li><li><Link href="/forgot-password" className="hover:text-[#80b9ff]">Reset password</Link></li></ul></div>
          <div><p className="text-[13px] text-[#adadad]">Trust</p><ul className="mt-4 space-y-2.5"><li><a href="#security" className="hover:text-[#80b9ff]">Security</a></li></ul></div>
        </div>
        <p className="mt-14 text-[12px] leading-relaxed text-[#7a7a7a]">Limus is a trading journal and analytics tool. It does not provide investment advice or execute trades. Trading involves risk of loss.</p>
      </div>
    </footer>
  );
}
