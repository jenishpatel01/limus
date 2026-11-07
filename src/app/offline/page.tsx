import type { Metadata } from "next";
import { LogoMark } from "@/components/brand/Logo";

export const metadata: Metadata = { title: "Offline" };

export default function Offline() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <LogoMark size={36} />
      <h1 className="mt-6 text-[26px] font-medium tracking-[-0.04em]">You&apos;re offline</h1>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-muted">Limus needs a connection to load and save your trades. Reconnect and try again.</p>
      <a href="/app" className="mt-6 inline-flex h-10 items-center rounded-md bg-primary px-4 font-button text-[14px] font-semibold text-white">Try again</a>
    </main>
  );
}
