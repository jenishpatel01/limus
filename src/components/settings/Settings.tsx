"use client";

import { useState, type ReactNode } from "react";
import { Download, FlaskConical, Settings as SettingsIcon } from "lucide-react";
import { useData, useLookups } from "@/lib/data/store";
import { api } from "@/lib/data/api";
import { supabase } from "@/lib/supabase/client";
import { createDemoData, removeDemoData } from "@/lib/demo/actions";
import { ASSET_CLASSES, ASSET_CLASS_LABEL, CURRENCIES, type AssetClass } from "@/lib/engine/instruments";
import { browserTimezone, dayKey } from "@/lib/dates";
import { download, toCsv, tradesToRows } from "@/lib/reports/csv";
import { Button, Card, ChipGroup, ConfirmDialog, Field, Input, Notice, PageHeader, Segmented, Select, toast } from "@/components/ui";
import { useTheme, type ThemePref } from "@/components/app/theme";

function Section({ id, title, description, children }: { id?: string; title: string; description?: string; children: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-24">
      <div className="grid gap-6 p-5 md:grid-cols-[260px_minmax(0,1fr)] md:p-6">
        <div><h2 className="text-[15px] font-medium tracking-[-0.02em]">{title}</h2>{description && <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p>}</div>
        <div className="min-w-0">{children}</div>
      </div>
    </Card>
  );
}

function zones(): string[] {
  try {
    const l = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone");
    if (l?.length) return l;
  } catch { /* ignore */ }
  return ["UTC", "Europe/London", "America/New_York", "Asia/Kolkata", "Asia/Singapore"];
}

export function SettingsPage() {
  const data = useData();
  const { profile, user, updateProfile, accounts, strategies, trades, attachments, tz, hasDemo, reload, setScope } = data;
  const lookups = useLookups();
  const { pref, set: setTheme } = useTheme();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [zone, setZone] = useState(profile?.timezone ?? browserTimezone());
  const [cur, setCur] = useState(profile?.base_currency ?? "USD");
  const [classes, setClasses] = useState<AssetClass[]>(profile?.asset_classes ?? []);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [confirmDemo, setConfirmDemo] = useState(false);

  const run = async (key: string, fn: () => Promise<void>, ok: string) => {
    setBusy(key);
    try { await fn(); toast(ok); } catch (e) { toast(e instanceof Error ? e.message : "Something went wrong", "error"); } finally { setBusy(null); }
  };

  return (
    <>
      <PageHeader title="Settings" icon={<SettingsIcon />} description="Your profile, preferences and data." />
      <div className="space-y-4">
        <Section title="Profile" description="Your timezone decides which day a trade belongs to in the calendar and reports.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="st-name"><Input id="st-name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Email" htmlFor="st-email"><Input id="st-email" value={user.email ?? ""} disabled /></Field>
            <Field label="Timezone" htmlFor="st-tz"><Select id="st-tz" value={zone} onChange={(e) => setZone(e.target.value)}>{zones().map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}</Select></Field>
            <Field label="Base currency" htmlFor="st-cur" hint="Combined totals include accounts in this currency."><Select id="st-cur" value={cur} onChange={(e) => setCur(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <Field label="Markets you trade" className="sm:col-span-2"><ChipGroup options={ASSET_CLASSES.map((c) => ({ value: c, label: ASSET_CLASS_LABEL[c] }))} value={classes} onChange={setClasses} /></Field>
          </div>
          <div className="mt-5 flex justify-end">
            <Button variant="primary" loading={busy === "profile"} onClick={() => run("profile", async () => { await updateProfile({ display_name: name.trim() || null, timezone: zone, base_currency: cur, asset_classes: classes }); }, "Profile saved")}>Save profile</Button>
          </div>
        </Section>

        <Section title="Appearance" description="Stored on this device.">
          <Segmented size="md" ariaLabel="Theme" value={pref} onChange={(v: ThemePref) => { setTheme(v); void updateProfile({ theme: v }).catch(() => undefined); }} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "System" }]} />
        </Section>

        <Section id="demo" title="Demo account" description="A separate, clearly labelled account with sample trades. It's never included in your real totals.">
          {hasDemo ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button icon={<FlaskConical className="size-4" />} onClick={() => { setScope({ kind: "demo" }); toast("Switched to the demo account"); }}>View demo account</Button>
              <Button variant="ghost" className="text-loss" onClick={() => setConfirmDemo(true)}>Remove demo data</Button>
            </div>
          ) : (
            <Button icon={<FlaskConical className="size-4" />} loading={busy === "demo"} onClick={() => run("demo", async () => { await createDemoData(user.id, tz, strategies); await reload(); setScope({ kind: "demo" }); }, "Demo account created")}>Load demo account</Button>
          )}
        </Section>

        <Section title="Export your data" description="All trades across every account, including journal fields, as CSV.">
          <Button icon={<Download className="size-4" />} disabled={!trades.length} onClick={() => {
            download(`limus-all-trades-${dayKey(new Date(), tz)}.csv`, toCsv(tradesToRows([...trades].sort((a, b) => a.entry_at.localeCompare(b.entry_at)), lookups.account, lookups.strategy, lookups.journalByTrade, tz)));
            toast(`Exported ${trades.length} trades`);
          }}>Export all trades ({trades.length})</Button>
        </Section>

        <Section title="Password" description="At least 8 characters.">
          <div className="flex max-w-md flex-wrap gap-2">
            <Input type="password" autoComplete="new-password" aria-label="New password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} className="min-w-0 flex-1" />
            <Button loading={busy === "pw"} disabled={pw.length < 8} onClick={() => run("pw", async () => { const { error } = await supabase().auth.updateUser({ password: pw }); if (error) throw error; setPw(""); }, "Password updated")}>Update</Button>
          </div>
        </Section>

        <Section title="Delete trading data" description="Permanently deletes every account, trade, journal note, strategy, screenshot, import, report and notification. Your login stays.">
          <Button variant="danger" onClick={() => setConfirmWipe(true)}>Delete all my data</Button>
          <Notice className="mt-4">To close your login entirely, contact support. Account removal needs a server-side admin step, which Limus doesn&apos;t expose in the browser.</Notice>
        </Section>
      </div>

      <ConfirmDialog open={confirmDemo} onClose={() => setConfirmDemo(false)} loading={busy === "rmdemo"} title="Remove demo data?" description="Deletes the demo account, its sample trades and the demo strategies. Your real data isn't touched."
        onConfirm={() => run("rmdemo", async () => { await removeDemoData(accounts, strategies); setScope({ kind: "real" }); await reload(); setConfirmDemo(false); }, "Demo data removed")} />
      <ConfirmDialog open={confirmWipe} onClose={() => setConfirmWipe(false)} loading={busy === "wipe"} confirmLabel="Delete everything" title="Delete all trading data?"
        description={`This permanently deletes ${accounts.length} accounts, ${trades.length} trades and ${attachments.length} screenshots. It can't be undone.`}
        onConfirm={() => run("wipe", async () => { await api.deleteAllData(user.id, attachments); setScope({ kind: "real" }); await updateProfile({ onboarded_at: null }); await reload(); setConfirmWipe(false); }, "All data deleted")} />
    </>
  );
}
