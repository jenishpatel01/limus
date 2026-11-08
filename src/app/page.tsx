import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight, BarChart3, BookOpen, CalendarDays, Camera, ChevronDown, FileText, Layers, Lock, PenLine, ShieldCheck, Sparkles, Upload, Wallet, Zap,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { PixelMosaic } from "@/components/brand/PixelMosaic";
import { ThemeToggle } from "@/components/brand/ThemeToggle";
import {
  CountUp, Divider, FadeIn, GrowBar, MaskText, Parallax, Reveal, ScrollFadeOut, ScrollLitText, ScrollProgress, ScrollTiltIn, Stagger, Tilt, Words,
} from "@/components/motion";

export const metadata: Metadata = {
  title: "Limus — Turn your trades into decisions",
  description: "A trading journal and portfolio platform for forex, crypto, stocks, indices and commodities. Accurate P&L, clean analytics, private by default.",
};

// Everything below uses theme tokens (text-ink, bg-surface, border-line…), so the page follows
// light and dark mode: dark text on light backgrounds, white text on dark backgrounds.
const btnPrimary = "inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 font-button text-[14px] font-semibold tracking-[-0.015em] text-white shadow-btn transition-[background-color,transform] duration-200 hover:bg-primary-hover active:scale-[0.97]";
const btnSecondary = "inline-flex h-10 items-center gap-1.5 rounded-md bg-surface px-4 text-[14px] font-medium text-ink shadow-[0_0_0_1px_var(--line-strong),var(--shadow-btn)] transition-[background-color,transform] duration-200 hover:bg-subtle active:scale-[0.97]";
const panel = "bg-surface shadow-[0_0_0_1px_var(--line),0_10px_26px_-4.5px_rgba(0,0,0,0.08)]";

/** Seconds until the intro cover has wiped away; hero animations start just before that. */
const INTRO = 1.2;

export default function Home() {
  return (
    <div className="bg-bg text-ink">
      <PageIntro />
      <ScrollProgress />
      <Nav />
      <main>
        <Hero />
        <Markets />
        <HowItWorks />
        <div className="mx-auto max-w-[1400px] px-4 pb-16 sm:px-8 lg:px-[52px]"><Divider /></div>
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

function PageIntro() {
  return (
    <div aria-hidden className="page-intro">
      <div className="page-intro-inner">
        <LogoMark size={46} />
        <span className="page-intro-word"><span>Limus</span></span>
      </div>
      <span className="page-intro-bar" />
    </div>
  );
}

function Nav() {
  return (
    <header className="nav-in sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 sm:px-8 lg:px-[52px]">
          <Logo />
          <nav aria-label="Primary" className="hidden items-center gap-8 text-[14px] text-ink md:flex">
            {[["#features", "Features"], ["#how", "How it works"], ["#security", "Security"], ["#faq", "FAQ"]].map(([h, l]) => (
              <a key={h} href={h} className="group relative py-1 transition-colors hover:text-primary-text">
                {l}
                <span className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-primary transition-transform duration-300 ease-out group-hover:scale-x-100" />
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <ThemeToggle />
            <Link href="/login" className="px-1 text-[14px] text-ink-3 transition-colors hover:text-ink">Log in</Link>
            <Link href="/register" className={btnPrimary}>Start for free</Link>
          </div>
        </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="float-slower pointer-events-none absolute right-[8%] top-24 size-[420px] rounded-full bg-primary-soft opacity-70 blur-[110px]" />
      <div aria-hidden className="float-slow pointer-events-none absolute -left-40 top-64 size-[320px] rounded-full bg-primary-soft opacity-40 blur-[100px]" />
      <div className="relative mx-auto grid max-w-[1400px] items-center gap-12 px-4 pb-20 pt-14 sm:px-8 lg:grid-cols-[minmax(0,560px)_1fr] lg:px-[52px] lg:pb-28 lg:pt-24">
        <ScrollFadeOut className="relative z-10">
          <FadeIn delay={INTRO}><a href="#features" className="inline-flex items-center overflow-hidden rounded-md text-[12px] shadow-[0_0_0_1px_var(--line)] transition-shadow hover:shadow-[0_0_0_1px_var(--line-strong)]">
            <span className="bg-surface px-2.5 py-1.5 font-medium text-ink">Journal · Portfolio · Analytics</span>
            <span className="flex items-center gap-1 border-l border-line bg-subtle px-2.5 py-1.5 text-body">See features <ChevronDown className="size-3 -rotate-90" /></span>
          </a></FadeIn>
          <Words text={"Turn your trades\ninto decisions."} className="mt-7 text-[44px] font-medium leading-[1.02] tracking-[-0.045em] text-ink sm:text-[64px]" delay={INTRO + 0.1} />
          <FadeIn delay={INTRO + 0.55}><p className="mt-6 max-w-md text-[18px] font-medium leading-[1.5] tracking-[-0.02em] text-body">Log every trade, keep each account separate, and watch Limus show you exactly where your edge comes from.</p></FadeIn>
          <FadeIn delay={INTRO + 0.75}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/register" className={`${btnPrimary} group`}>Start for free <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" /></Link>
              <Link href="/login" className={btnSecondary}>Log in</Link>
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-[12.5px] font-medium text-primary-text"><span className="live-dot size-1.5 rounded-full bg-primary" />Free to use · No credit card · Explore with a demo account</p>
          </FadeIn>
        </ScrollFadeOut>
        <FadeIn delay={INTRO + 0.3} y={60}><Parallax distance={50}><Tilt max={6}><HeroCollage /></Tilt></Parallax></FadeIn>
      </div>
    </section>
  );
}

/** Illustration of the product (sample numbers), styled like the template's tilted chart collage. */
function HeroCollage() {
  const bars = [38, 52, 30, 64, 46, 72, 58, 80, 66, 90];
  const drawDelay = { animationDelay: `${INTRO + 0.6}s` };
  return (
    <div aria-hidden className="relative h-[420px] select-none [perspective:1600px] lg:h-[520px]">
      <div className="absolute inset-0 origin-center [transform:rotateX(38deg)_rotateZ(-24deg)_scale(1.05)] [transform-style:preserve-3d]">
        <div className="float-slow grid grid-cols-2 gap-5">
          <Tile className="col-span-2 h-44">
            <p className="text-[11px] text-muted">Equity curve</p>
            <p className="text-[22px] font-medium tracking-[-0.03em] text-ink">$31,482.20</p>
            <svg viewBox="0 0 300 70" className="mt-2 h-16 w-full"><path className="draw-line" style={{ ["--len" as string]: 360, ...drawDelay, stroke: "var(--primary)" }} d="M0 60 L30 55 L60 58 L90 44 L120 47 L150 34 L180 38 L210 24 L240 27 L270 14 L300 10" fill="none" strokeWidth="2.5" /><path d="M0 60 L30 55 L60 58 L90 44 L120 47 L150 34 L180 38 L210 24 L240 27 L270 14 L300 10 L300 70 L0 70Z" style={{ fill: "var(--primary)" }} opacity=".1" /></svg>
          </Tile>
          <Tile className="h-40">
            <p className="text-[11px] text-muted">Win rate</p>
            <p className="text-[26px] font-medium tracking-[-0.03em] text-ink">54.2%</p>
            <div className="mt-3 flex h-12 items-end gap-1.5">{bars.slice(0, 7).map((b, i) => <span key={i} className={`w-3 rounded-[3px] ${i === 6 ? "bg-primary" : "bg-line"}`} style={{ height: `${b}%` }} />)}</div>
          </Tile>
          <Tile className="h-40">
            <p className="text-[11px] text-muted">Profit factor</p>
            <p className="text-[26px] font-medium tracking-[-0.03em] text-ink">1.86</p>
            <div className="mt-4 h-2 rounded-full bg-muted-bg"><div className="h-2 w-[68%] rounded-full bg-profit" /></div>
          </Tile>
          <Tile className="col-span-2 h-44">
            <p className="text-[11px] text-muted">Daily P&amp;L</p>
            <div className="mt-3 flex h-24 items-end gap-2">{[30, 18, 42, 22, 26, 55, 12, 10, 38, 46, 14, 28].map((v, i) => <span key={i} className={`flex-1 rounded-[3px] ${[1, 4, 7, 10].includes(i) ? "bg-loss" : "bg-profit"}`} style={{ height: `${v + 20}%` }} />)}</div>
          </Tile>
        </div>
      </div>
      {/* Fades: left edge into the text column, bottom (extended past the box, where tilted cards overhang). */}
      <div className="pointer-events-none absolute inset-y-0 -left-8 w-1/3 bg-gradient-to-r from-bg/70 to-transparent" />
      <div className="pointer-events-none absolute -bottom-56 -left-[20%] -right-[40%] h-[22rem] bg-gradient-to-t from-bg from-55% to-transparent" />
    </div>
  );
}

function Tile({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl p-4 ${panel} ${className}`}>{children}</div>;
}

function SectionHead({ eyebrow, title, sub, center = true }: { eyebrow: string; title: (string | [string, string])[]; sub?: React.ReactNode; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-xl"}>
      <Reveal y={16}><p className="text-[14px] font-medium text-primary-text">{eyebrow}</p></Reveal>
      <MaskText lines={title} className="mt-3 text-[34px] font-medium leading-[1.08] tracking-[-0.04em] text-ink sm:text-[46px]" />
      {sub && <Reveal delay={0.25}><p className="mt-4 text-[16px] font-medium leading-[1.5] tracking-[-0.02em] text-body">{sub}</p></Reveal>}
    </div>
  );
}

function Markets() {
  const items = ["Forex", "Crypto", "Stocks", "Indices", "Commodities"];
  return (
    <section className="border-y border-line bg-subtle">
      <div className="mx-auto flex max-w-[1400px] flex-col items-center gap-6 px-4 py-12 sm:px-8 md:flex-row md:justify-between lg:px-[52px]">
        <Reveal><p className="max-w-xs text-center text-[16px] font-medium leading-snug tracking-[-0.02em] text-body md:text-left"><span className="text-ink">Built for every market</span> you trade, with correct contract math for each.</p></Reveal>
        <div className="relative w-full overflow-hidden md:max-w-[640px] [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
          <ul className="marquee flex w-max gap-12">
            {[...items, ...items, ...items, ...items].map((i, k) => <li key={k} aria-hidden={k >= items.length} className="flex shrink-0 items-center gap-2 text-[18px] font-medium tracking-[-0.03em] text-ink"><LogoMark size={14} />{i}</li>)}
          </ul>
        </div>
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
        <SectionHead eyebrow="How it works" title={["From trade to insight", "in 3 simple steps."]} />
        <Stagger className="mt-16 grid gap-10 md:grid-cols-3 md:gap-0" gap={0.18} y={48}>
          {steps.map((s, i) => (
            <div key={s.t} className={`group px-0 md:px-10 ${i > 0 ? "md:border-l md:border-line" : ""}`}>
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-lg bg-surface text-ink shadow-[0_0_0_1px_var(--line)] transition-transform duration-500 group-hover:-translate-y-1 group-hover:rotate-[-6deg]"><s.icon className="size-5" strokeWidth={1.5} /></span>
                <span className="text-[40px] font-medium tracking-[-0.05em] text-line-strong">0{i + 1}</span>
              </div>
              <p className="mt-6 text-[16px] font-medium leading-[1.5] tracking-[-0.02em] text-body"><span className="text-ink">{s.t}</span> {s.d}</p>
            </div>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

function ProductPreview() {
  const stats: [string, string, string][] = [["Net profit", "+$6,482.20", "text-profit"], ["Win rate", "54.2%", "text-ink"], ["Profit factor", "1.86", "text-ink"], ["Max drawdown", "6.4%", "text-loss"]];
  return (
    <section className="pb-24 lg:pb-32">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8 lg:px-[52px]">
        <ScrollTiltIn><div className={`overflow-hidden rounded-2xl ${panel}`}>
          <div className="grid lg:grid-cols-[230px_1fr]">
            <aside className="hidden border-r border-line p-4 lg:block">
              <div className="flex items-center gap-2.5 rounded-lg px-2 py-2"><span className="flex size-8 items-center justify-center rounded-full bg-navy text-[12px] text-white">AM</span><span><span className="block text-[13px] font-medium text-ink">Alex Morgan</span><span className="block text-[11.5px] text-muted">Sample account</span></span></div>
              <ul className="mt-4 space-y-0.5 text-[13.5px] text-ink-3">
                {[["Dashboard", BarChart3], ["Trading Journal", BookOpen], ["Portfolio", Wallet], ["Calendar", CalendarDays], ["Strategies", Layers], ["Risk Management", ShieldCheck], ["Reports", FileText]].map(([l, I], i) => {
                  const Icon = I as typeof BarChart3;
                  return <li key={l as string} className={`flex h-9 items-center gap-2.5 rounded-lg px-2.5 ${i === 0 ? "bg-muted-bg font-medium text-ink" : ""}`}><Icon className="size-4" strokeWidth={1.5} />{l as string}</li>;
                })}
              </ul>
            </aside>
            <div className="p-5 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[22px] font-medium tracking-[-0.04em] text-ink">Welcome back, Alex</p>
                <div className="flex gap-0.5 rounded-md bg-muted-bg p-0.5 text-[12px]">{["1D", "1W", "1M", "3M", "YTD", "All"].map((p) => <span key={p} className={`rounded-[6px] px-2 py-1 ${p === "3M" ? "bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,.12)]" : "text-muted"}`}>{p}</span>)}</div>
              </div>
              <Stagger className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4" gap={0.1} y={24}>
                {stats.map(([l, v, c]) => (
                  <div key={l} className="rounded-xl p-4 shadow-[0_0_0_1px_var(--line)]"><p className="text-[12.5px] text-muted">{l}</p><p className={`mt-1 text-[22px] font-medium tracking-[-0.03em] ${c}`}><CountUp value={v} /></p></div>
                ))}
              </Stagger>
              <div className="mt-4 rounded-xl p-5 shadow-[0_0_0_1px_var(--line)]">
                <p className="text-[14px] font-medium text-ink">Equity curve</p>
                <svg viewBox="0 0 800 180" className="mt-3 h-44 w-full" preserveAspectRatio="none"><g style={{ stroke: "var(--line)" }} strokeDasharray="3 4">{[30, 75, 120, 165].map((y) => <line key={y} x1="0" x2="800" y1={y} y2={y} />)}</g><path className="draw-line" style={{ ["--len" as string]: 900, stroke: "var(--primary)" }} d="M0 150 C60 146 90 140 130 132 S200 120 240 126 S320 100 360 96 S430 104 470 84 S560 70 600 58 S700 46 740 34 L800 26" fill="none" strokeWidth="2.5" /></svg>
              </div>
              <p className="mt-3 text-[11.5px] text-faint">Illustration with sample numbers.</p>
            </div>
          </div>
        </div></ScrollTiltIn>
      </div>
    </section>
  );
}

function Statement() {
  return (
    <section className="border-y border-line bg-black py-28 text-white lg:py-36">
      <div className="mx-auto max-w-[760px] px-6">
        <ScrollLitText className="text-[24px] font-medium leading-[1.3] tracking-[-0.035em] sm:text-[32px]" dim="#2e2e2e" lit="#ffffff" paragraphs={[
          { text: "A trade isn't just a number. It's a decision." },
          { text: "Limus keeps the numbers honest and the context attached: the setup, the emotions, the mistakes, the lesson. So every trade teaches you something.", accent: "#adadad" },
          { text: "Less guessing. More clarity.", accent: "#80b9ff" },
        ]} />
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
    <section className="overflow-hidden py-24 lg:py-32">
      <div className="mx-auto grid max-w-[1400px] items-center gap-14 px-4 sm:px-8 lg:grid-cols-[minmax(0,480px)_1fr] lg:px-[52px]">
        <div>
          <Reveal y={16}><p className="text-[14px] font-medium text-primary-text">Precision meets discipline</p></Reveal>
          <MaskText lines={["Spreadsheets take hours.", "Limus takes seconds.", ["Focus on trading, not formulas.", "text-muted"]]} className="mt-3 text-[30px] font-medium leading-[1.15] tracking-[-0.04em] text-ink sm:text-[36px]" />
          <Reveal delay={0.2}><p className="mt-5 text-[16px] font-medium leading-[1.5] tracking-[-0.02em] text-body">Contract sizes, pip values, currency conversion and costs are handled for forex, crypto, stocks, indices and commodities.</p></Reveal>
          <Stagger className="mt-10 space-y-7" gap={0.15} y={24}>
            {rows.map((r) => (
              <div key={r.t} className="grid grid-cols-[1fr_1.1fr] gap-6">
                <span className="flex items-center gap-2 text-[16px] font-medium tracking-[-0.02em] text-ink"><r.icon className="size-[18px] text-primary-text" strokeWidth={1.5} />{r.t}</span>
                <span className="text-[14px] font-medium leading-[1.5] text-muted">{r.d}</span>
              </div>
            ))}
          </Stagger>
        </div>
        <Parallax distance={60}><Reveal delay={0.15} y={80}><div aria-hidden className={`rounded-2xl p-6 ${panel}`}>
          <div className="flex gap-1 text-[12px]">{["Overview", "Strategies", "Sessions", "Calendar"].map((t, i) => <span key={t} className={`rounded-md px-2.5 py-1 ${i === 0 ? "bg-muted-bg text-ink" : "text-muted"}`}>{t}</span>)}</div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["Expectancy", "$42.10"], ["Avg R", "+0.38R"], ["Payoff", "1.72"], ["Recovery", "3.1"]].map(([l, v]) => (
              <div key={l} className="rounded-lg p-3 shadow-[0_0_0_1px_var(--line)]"><p className="text-[11px] text-muted">{l}</p><p className="mt-1 text-[17px] font-medium text-ink"><CountUp value={v} /></p></div>
            ))}
          </div>
          <div className="mt-5 rounded-lg p-4 shadow-[0_0_0_1px_var(--line)]">
            <p className="text-[12.5px] font-medium text-ink">Performance by session</p>
            <Stagger className="mt-4 space-y-3 text-[12px]" gap={0.12} y={10}>
              {([["London", 82, "bg-profit"], ["London / NY overlap", 64, "bg-profit"], ["New York", 38, "bg-profit"], ["Asian", 24, "bg-loss"]] as [string, number, string][]).map(([l, w, c]) => (
                <div key={l} className="grid grid-cols-[130px_1fr] items-center gap-3"><span className="text-ink-3">{l}</span><span className="h-2 overflow-hidden rounded-full bg-muted-bg"><GrowBar width={w} className={`block h-2 rounded-full ${c}`} /></span></div>
              ))}
            </Stagger>
          </div>
          <p className="mt-3 text-[11.5px] text-faint">Illustration with sample numbers.</p>
        </div></Reveal></Parallax>
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
    <section id="features" className="scroll-mt-20 border-t border-line bg-subtle py-24 lg:py-32">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8 lg:px-[52px]">
        <SectionHead eyebrow="Features" title={["Everything you need to", "trade with clarity."]} sub="From your first trade to a full performance review, Limus gives you professional tools without the spreadsheet." />
        <Stagger className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" gap={0.09} y={56} itemClassName="h-full">
          {items.map((f) => (
            <div key={f.t} className="lift group h-full rounded-xl bg-surface p-6 shadow-[0_0_0_1px_var(--line)]">
              <span className="flex size-11 items-center justify-center rounded-lg bg-primary-soft text-primary-text transition-transform duration-500 group-hover:scale-110 group-hover:rotate-[-6deg]"><f.icon className="size-5" strokeWidth={1.5} /></span>
              <p className="mt-6 text-[16px] font-medium tracking-[-0.02em] text-ink">{f.t}</p>
              <p className="mt-1.5 text-[14px] font-medium leading-[1.5] text-muted">{f.d}</p>
            </div>
          ))}
        </Stagger>
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
        <SectionHead eyebrow="Security" title={["Your trades stay yours."]} sub="Your trading history is sensitive. Limus is built so that nobody else can see it." />
        <Stagger className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" gap={0.1} y={40} itemClassName="h-full">
          {items.map((s) => (
            <div key={s.t} className="lift h-full rounded-xl bg-surface p-6 shadow-[0_0_0_1px_var(--line)]">
              <p className="flex items-center gap-2 text-[14px] font-medium text-ink"><s.icon className="size-4 text-primary-text" strokeWidth={1.5} />{s.t}</p>
              <p className="mt-2 text-[13px] font-medium leading-[1.5] text-muted">{s.d}</p>
            </div>
          ))}
        </Stagger>
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
    <section id="faq" className="scroll-mt-20 border-t border-line py-24 lg:py-32">
      <div className="mx-auto grid max-w-[1400px] gap-12 px-4 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:px-[52px]">
        <div>
          <MaskText lines={["Frequently", "asked questions."]} className="text-[34px] font-medium leading-[1.08] tracking-[-0.04em] text-ink sm:text-[46px]" />
          <Reveal delay={0.2}>
            <p className="mt-5 text-[16px] font-medium text-body">Have another question?</p>
            <Link href="/register" className="group mt-2 inline-flex items-center gap-1 text-[14px] font-medium text-ink">Try it with the demo account <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" /></Link>
          </Reveal>
        </div>
        <Stagger className="space-y-3" gap={0.1} y={32}>
          {qs.map(([q, a]) => (
            <details key={q} className="group rounded-xl bg-surface shadow-[0_0_0_1px_var(--line)] transition-shadow hover:shadow-[0_0_0_1px_var(--line-strong)] [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-medium tracking-[-0.02em] text-ink">{q}<ChevronDown className="size-4 shrink-0 text-muted transition-transform duration-300 group-open:rotate-180" /></summary>
              <p className="faq-answer px-5 pb-5 text-[14px] font-medium leading-[1.6] text-body">{a}</p>
            </details>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section className="relative overflow-hidden">
      <PixelMosaic className="absolute inset-0 h-full w-full" cols={40} rows={12} animated />
      <div className="relative mx-auto flex max-w-[1400px] flex-col items-center px-4 py-28 text-center sm:py-36">
        <MaskText lines={["Ready to trade", "with more clarity?"]} className="text-[34px] font-medium leading-[1.08] tracking-[-0.04em] text-ink sm:text-[52px]" />
        <Reveal delay={0.25}>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/register" className={`${btnPrimary} group`}>Start for free <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-1" /></Link>
            <a href="#features" className={btnSecondary}>See features</a>
          </div>
          <p className="mt-4 text-[12.5px] font-medium text-ink-3">No credit card required.</p>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line bg-[#111111] text-white">
      <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-8 lg:px-[52px]">
        <Reveal y={24}>
          <div className="flex flex-wrap items-center justify-between gap-6 border-b border-white/10 pb-10">
            <Logo inverted href="/" />
            <p className="text-[20px] font-medium tracking-[-0.03em] sm:text-[24px]">Your trades, illuminated.</p>
          </div>
        </Reveal>
        <Stagger className="grid grid-cols-2 gap-8 pt-10 text-[14px] sm:grid-cols-3" gap={0.08} y={16}>
          <div><p className="text-[13px] text-[#adadad]">Product</p><ul className="mt-4 space-y-2.5"><li><a href="#features" className="hover:text-[#80b9ff]">Features</a></li><li><a href="#how" className="hover:text-[#80b9ff]">How it works</a></li><li><a href="#faq" className="hover:text-[#80b9ff]">FAQ</a></li></ul></div>
          <div><p className="text-[13px] text-[#adadad]">Account</p><ul className="mt-4 space-y-2.5"><li><Link href="/register" className="hover:text-[#80b9ff]">Create account</Link></li><li><Link href="/login" className="hover:text-[#80b9ff]">Log in</Link></li><li><Link href="/forgot-password" className="hover:text-[#80b9ff]">Reset password</Link></li></ul></div>
          <div><p className="text-[13px] text-[#adadad]">Trust</p><ul className="mt-4 space-y-2.5"><li><a href="#security" className="hover:text-[#80b9ff]">Security</a></li></ul></div>
        </Stagger>
        <p className="mt-14 text-[12px] leading-relaxed text-[#8a8a8a]">Limus is a trading journal and analytics tool. It does not provide investment advice or execute trades. Trading involves risk of loss.</p>
      </div>
    </footer>
  );
}
