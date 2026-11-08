import { Logo } from "@/components/brand/Logo";
import { Orbs } from "@/components/brand/Backdrops";
import { PixelMosaic } from "@/components/brand/PixelMosaic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="relative flex flex-col overflow-hidden px-5 py-6 sm:px-10">
        <Orbs variant={0} />
        <div className="relative z-10"><Logo /></div>
        <main className="relative z-10 flex flex-1 items-center justify-center py-10">
          <div className="glass w-full max-w-[380px] animate-rise rounded-2xl p-6 sm:p-8">{children}</div>
        </main>
        <p className="relative z-10 text-[12px] text-faint">Your trading data stays private to your account.</p>
      </div>
      <aside className="relative hidden overflow-hidden border-l border-line bg-subtle lg:block">
        <PixelMosaic className="absolute inset-0 h-full w-full" cols={24} rows={30} seed={11} animated />
        <div className="relative flex h-full flex-col justify-end p-12">
          <div className="glass-strong max-w-md rounded-xl p-6">
            <p className="text-[13px] font-medium text-primary">Trading journal &amp; portfolio analytics</p>
            <p className="mt-2 text-[24px] font-medium leading-[1.15] tracking-[-0.04em] text-ink">Turn your trades into decisions.</p>
            <p className="mt-3 text-[14px] leading-relaxed text-body">Log every trade, keep accounts separate, and see exactly where your edge comes from.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
