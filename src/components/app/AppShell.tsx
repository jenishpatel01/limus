"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Bell, Check, ChevronDown, ChevronsUpDown, FlaskConical, LogOut, Menu as MenuIcon, Moon, Plus, Search, Wallet, X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { PageTransition } from "@/components/motion";
import { EASE } from "@/components/motion/variants";
import { supabase } from "@/lib/supabase/client";
import { api } from "@/lib/data/api";
import { DataProvider, useData } from "@/lib/data/store";
import { Logo } from "@/components/brand/Logo";
import { Badge, Button, ButtonLink, cx, IconButton, Menu, MenuItem, Skeleton, Toaster, Toggle } from "@/components/ui";
import { MAIN_NAV, SECONDARY_NAV, isActive, type NavItem } from "./nav";
import { Orbs } from "@/components/brand/Backdrops";
import { applyThemeAnimated, useTheme } from "./theme";
import { relativeTime } from "@/lib/format";

/** Loads the session, then the user's data, then renders the shell. */
export function AppGate({ children, bare = false }: { children: ReactNode; bare?: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    const sb = supabase();
    sb.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace("/login?next=" + encodeURIComponent(location.pathname));
      setUser(data.user ?? null);
    });
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") router.replace("/login");
      else if (session?.user) setUser((u) => (u?.id === session.user.id ? u : session.user));
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  if (!user) return bare ? <div className="flex min-h-dvh items-center justify-center"><Skeleton className="h-64 w-full max-w-lg" /></div> : <ShellSkeleton />;
  return (
    <DataProvider user={user}>
      {bare ? <>{children}<Toaster /></> : <Shell>{children}</Shell>}
    </DataProvider>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh">
      <div className="hidden w-[248px] shrink-0 border-r border-line p-4 lg:block">
        <Skeleton className="h-12 w-full" />
        <div className="mt-6 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
      </div>
      <div className="flex-1 p-6 lg:p-8">
        <Skeleton className="h-8 w-56" />
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="mt-6 h-72 w-full" />
      </div>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { ready, error, profile, reload, user } = useData();
  const router = useRouter();
  const path = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(path);
  // Close the mobile menu after navigating (derived state, no effect needed).
  if (menuPath !== path) { setMenuPath(path); setMobileOpen(false); }
  useEffect(() => {
    if (!(ready && !error && profile && !profile.onboarded_at)) return;
    // Right after finishing onboarding, this screen can still hold the profile from before the final
    // save (it arrives a moment ahead of the fresh copy). So confirm with the database before sending
    // anyone back to the start, otherwise the click looks stuck until a refresh.
    let cancelled = false;
    api.getProfile(user.id).then(
      (fresh) => { if (cancelled) return; if (fresh?.onboarded_at) void reload(); else router.replace("/onboarding"); },
      () => { if (!cancelled) router.replace("/onboarding"); },
    );
    return () => { cancelled = true; };
  }, [ready, error, profile, router, reload, user.id]);

  return (
    <div className="flex min-h-dvh bg-bg">
      <Orbs variant={1} fixed />
      <aside className="glass-bar sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-line lg:flex">
        <SidebarContent />
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-[var(--overlay)]" onClick={() => setMobileOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
            <motion.aside className="glass-strong absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col"
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ duration: 0.32, ease: EASE }}>
              <div className="flex justify-end px-3 pt-3"><IconButton label="Close menu" onClick={() => setMobileOpen(false)}><X className="size-4" /></IconButton></div>
              <SidebarContent />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div aria-hidden className="app-ambient" />
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main className="relative z-[1] mx-auto w-full max-w-[1400px] flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-7">
          {!ready ? <PageSkeleton /> : error ? (
            <div className="mx-auto max-w-md py-20 text-center">
              <p className="text-[15px] font-medium">We couldn&apos;t load your data</p>
              <p className="mt-1 text-[13px] text-muted">{error}</p>
              <Button className="mt-5" onClick={() => void reload()}>Try again</Button>
            </div>
          ) : !profile?.onboarded_at ? <PageSkeleton /> : (
            <PageTransition routeKey={path}>{children}</PageTransition>
          )}
        </main>
      </div>

      <MobileTabs onMore={() => setMobileOpen(true)} />
      <Toaster />
    </div>
  );
}

function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-60" />
      <Skeleton className="mt-2 h-4 w-80" />
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3"><Skeleton className="h-72 lg:col-span-2" /><Skeleton className="h-72" /></div>
    </div>
  );
}

function initials(name: string) {
  return name.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "L";
}

function SidebarContent() {
  const { user, profile, signOut } = useData();
  const path = usePathname();
  const { resolved } = useTheme();
  const name = profile?.display_name || user.email?.split("@")[0] || "Trader";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-4 pb-3 pt-4">
        <Logo href="/app" />
      </div>
      <div className="px-3">
        <Menu align="start" className="w-[224px]" trigger={({ toggle, open }) => (
          <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted-bg">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy text-[12px] font-medium text-white">{initials(name)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium text-ink">{name}</span>
              <span className="block truncate text-[12px] text-muted">{user.email}</span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted" />
          </button>
        )}>
          {(close) => (
            <>
              <MenuItem href="/app/settings" onClick={close}>Profile &amp; preferences</MenuItem>
              <MenuItem danger icon={<LogOut />} onClick={() => { close(); void signOut(); }}>Sign out</MenuItem>
            </>
          )}
        </Menu>
      </div>
      <div className="mx-4 my-3 h-px bg-line" />
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 scrollbar-thin">
        <ul className="flex flex-col gap-0.5">{MAIN_NAV.map((item) => <NavLink key={item.href} item={item} active={isActive(item, path)} />)}</ul>
      </nav>
      <div className="px-3 pb-4 pt-2">
        <ul className="flex flex-col gap-0.5">{SECONDARY_NAV.map((item) => <NavLink key={item.href} item={item} active={isActive(item, path)} />)}</ul>
        <div className="mt-0.5 flex h-9 items-center justify-between rounded-lg px-2.5 text-[14px] text-ink-3">
          <span className="flex items-center gap-2.5"><Moon className="size-[17px]" strokeWidth={1.5} />Dark mode</span>
          <Toggle label="Dark mode" checked={resolved === "dark"} onChange={(v) => applyThemeAnimated(v ? "dark" : "light")} />
        </div>
        <button type="button" onClick={() => void signOut()} className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[14px] text-ink-3 transition-colors hover:bg-muted-bg hover:text-ink">
          <LogOut className="size-[17px]" strokeWidth={1.5} />Log out
        </button>
      </div>
    </div>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <li>
      <Link href={item.href} aria-current={active ? "page" : undefined}
        className={cx("group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[14px] transition-colors",
          active ? "font-medium text-ink" : "text-ink-3 hover:bg-subtle hover:text-ink")}>
        {active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-lg bg-muted-bg" transition={{ type: "spring", stiffness: 480, damping: 38 }} />}
        <Icon className="relative size-[17px] shrink-0 transition-transform duration-200 group-hover:scale-110" strokeWidth={1.5} />
        <span className="relative">{item.label}</span>
      </Link>
    </li>
  );
}

export function AccountSwitcher({ compact = false }: { compact?: boolean }) {
  const { accounts, scope, setScope, hasDemo, scopedAccounts } = useData();
  const real = accounts.filter((a) => !a.is_demo);
  const demo = accounts.filter((a) => a.is_demo);
  const label = scope.kind === "real" ? "All real accounts" : scope.kind === "demo" ? "Demo account" : scopedAccounts[0]?.name ?? "Account";

  return (
    <Menu align="start" className="w-72" trigger={({ toggle, open }) => (
      <button type="button" onClick={toggle} aria-expanded={open} aria-label="Switch account"
        className="flex h-9 max-w-[260px] items-center gap-2 rounded-md bg-[var(--glass-input)] px-2.5 text-[13.5px] shadow-[0_0_0_1px_var(--line-strong)] transition-colors hover:bg-[var(--glass-strong)]">
        {scope.kind === "demo" ? <FlaskConical className="size-4 shrink-0 text-warn" /> : <Wallet className="size-4 shrink-0 text-muted" />}
        <span className={cx("truncate font-medium", compact && "max-w-[120px]")}>{label}</span>
        {scope.kind === "demo" && <Badge tone="warn">Demo</Badge>}
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted" />
      </button>
    )}>
      {(close) => (
        <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
          <ScopeItem active={scope.kind === "real"} onClick={() => { setScope({ kind: "real" }); close(); }} title="All real accounts" sub={`${real.length} account${real.length === 1 ? "" : "s"} combined`} />
          {real.length > 0 && <p className="px-2.5 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-wider text-faint">Accounts</p>}
          {real.map((a) => (
            <ScopeItem key={a.id} active={scope.kind === "account" && scope.id === a.id} onClick={() => { setScope({ kind: "account", id: a.id }); close(); }} title={a.name} sub={`${a.broker ? a.broker + " · " : ""}${a.currency}${a.status !== "active" ? " · " + a.status : ""}`} />
          ))}
          {hasDemo && (
            <>
              <p className="px-2.5 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-wider text-faint">Demo (sample data)</p>
              {demo.map((a) => (
                <ScopeItem key={a.id} active={scope.kind === "demo" || (scope.kind === "account" && scope.id === a.id)} onClick={() => { setScope({ kind: "demo" }); close(); }} title={a.name} sub="Sample trades, kept separate" demo />
              ))}
            </>
          )}
          <div className="mt-1 border-t border-line pt-1">
            <MenuItem href="/app/portfolio?new=1" onClick={close} icon={<Plus />}>New account</MenuItem>
          </div>
        </div>
      )}
    </Menu>
  );
}

function ScopeItem({ active, onClick, title, sub, demo }: { active: boolean; onClick: () => void; title: string; sub: string; demo?: boolean }) {
  return (
    <button type="button" role="menuitemradio" aria-checked={active} onClick={onClick} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left hover:bg-muted-bg">
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 truncate text-[13.5px] font-medium text-ink">{title}{demo && <Badge tone="warn">Demo</Badge>}</span>
        <span className="block truncate text-[12px] text-muted">{sub}</span>
      </span>
      {active && <Check className="size-4 text-primary-text" />}
    </button>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const { scope } = useData();
  return (
    <header className="glass-bar sticky top-0 z-30 border-b border-line">
      {scope.kind === "demo" && (
        <div className="flex items-center justify-center gap-2 bg-warn-soft px-4 py-1.5 text-[12.5px] text-ink-3">
          <FlaskConical className="size-3.5 text-warn" />You&apos;re viewing the demo account. Its sample trades are never mixed with your real accounts.
        </div>
      )}
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2 px-4 sm:px-6 lg:px-8">
        <IconButton label="Open menu" className="lg:hidden" onClick={onMenu}><MenuIcon className="size-5" /></IconButton>
        <div className="lg:hidden"><Logo href="/app" size="sm" /></div>
        <div className="hidden sm:block lg:ml-0"><AccountSwitcher /></div>
        <form className="ml-auto hidden md:block" role="search" onSubmit={(e) => { e.preventDefault(); router.push(`/app/journal?q=${encodeURIComponent(q.trim())}`); }}>
          <label className="relative block">
            <span className="sr-only">Search trades</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search symbol, tag, setup…"
              className="h-9 w-64 rounded-md bg-[var(--glass-input)] pl-8 pr-3 text-[13.5px] shadow-[0_0_0_1px_var(--line)] outline-none placeholder:text-faint focus:bg-[var(--glass-strong)] focus:shadow-[0_0_0_1px_var(--primary),0_0_0_4px_var(--primary-soft)]" />
          </label>
        </form>
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <IconButton label="Search" className="md:hidden" onClick={() => router.push("/app/journal?focus=search")}><Search className="size-[18px]" strokeWidth={1.5} /></IconButton>
          <Notifications />
          <ButtonLink href="/app/journal/new" variant="primary" icon={<Plus className="size-4" />} className="hidden sm:inline-flex">New trade</ButtonLink>
        </div>
      </div>
      <div className="border-t border-line px-4 py-2 sm:hidden"><AccountSwitcher compact /></div>
    </header>
  );
}

function Notifications() {
  const { notifications, markRead } = useData();
  const unread = notifications.filter((n) => !n.read_at);
  return (
    <Menu className="w-80" trigger={({ toggle, open }) => (
      <IconButton label={unread.length ? `Notifications (${unread.length} unread)` : "Notifications"} onClick={toggle} aria-expanded={open} className="relative">
        <Bell className="size-[18px]" strokeWidth={1.5} />
        {unread.length > 0 && <span className="ping absolute right-2 top-2 size-2 rounded-full bg-primary ring-2 ring-bg" />}
      </IconButton>
    )}>
      {(close) => (
        <div>
          <div className="flex items-center justify-between px-2.5 py-2">
            <p className="text-[13.5px] font-medium">Notifications</p>
            {unread.length > 0 && <button type="button" className="text-[12px] text-primary-text hover:underline" onClick={() => void markRead(unread.map((n) => n.id))}>Mark all read</button>}
          </div>
          <div className="max-h-80 overflow-y-auto scrollbar-thin">
            {notifications.length === 0 ? (
              <p className="px-2.5 pb-4 pt-2 text-[13px] text-muted">You&apos;re all caught up. Risk alerts and import results appear here.</p>
            ) : notifications.slice(0, 20).map((n) => (
              <Link key={n.id} href={n.link ?? "/app"} onClick={() => { close(); if (!n.read_at) void markRead([n.id]); }}
                className="flex gap-2.5 rounded-md px-2.5 py-2 hover:bg-muted-bg">
                <span className={cx("mt-1.5 size-1.5 shrink-0 rounded-full", n.read_at ? "bg-transparent" : n.kind === "risk" ? "bg-loss" : "bg-primary")} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-ink">{n.title}</span>
                  {n.body && <span className="mt-0.5 block text-[12px] leading-snug text-muted">{n.body}</span>}
                  <span className="mt-1 block text-[11px] text-faint">{relativeTime(n.created_at)}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </Menu>
  );
}

function MobileTabs({ onMore }: { onMore: () => void }) {
  const path = usePathname();
  const tabs = [MAIN_NAV[0], MAIN_NAV[1], null, MAIN_NAV[3]] as (NavItem | null)[];
  return (
    <nav aria-label="Quick navigation" className="glass-bar fixed inset-x-0 bottom-0 z-40 border-t border-line safe-bottom lg:hidden">
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
        {tabs.map((t, i) => t === null ? (
          <li key="add" className="flex justify-center">
            <Link href="/app/journal/new" aria-label="Add trade" className="flex size-11 items-center justify-center rounded-full bg-primary text-white shadow-[0_6px_20px_-6px_var(--primary)] transition-transform active:scale-90"><Plus className="size-5" /></Link>
          </li>
        ) : (
          <li key={t.href}>
            <Link href={t.href} aria-current={isActive(t, path) ? "page" : undefined} className={cx("relative flex flex-col items-center gap-1 pt-1 text-[10.5px] transition-colors", isActive(t, path) ? "text-ink" : "text-muted")}>
              {isActive(t, path) && <motion.span layoutId="tab-dot" className="absolute -top-1.5 h-0.5 w-6 rounded-full bg-primary" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
              <t.icon className="size-5" strokeWidth={1.5} />{i === 1 ? "Journal" : t.label}
            </Link>
          </li>
        ))}
        <li>
          <button type="button" onClick={onMore} className="flex w-full flex-col items-center gap-1 text-[10.5px] text-muted">
            <MenuIcon className="size-5" strokeWidth={1.5} />More
          </button>
        </li>
      </ul>
    </nav>
  );
}
