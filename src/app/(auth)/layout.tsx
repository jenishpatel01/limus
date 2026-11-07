import { Logo } from "@/components/brand/Logo";
import { PixelMosaic } from "@/components/brand/PixelMosaic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Logo />
        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[380px] animate-rise">{children}</div>
        </main>
        <p className="text-[12px] text-faint">Your trading data stays private to your account.</p>
      </div>
      <aside className="relative hidden overflow-hidden border-l border-line bg-subtle lg:block">
        <PixelMosaic className="absolute inset-0 h-full w-full" cols={24} rows={30} seed={11} />
        <div className="relative flex h-full flex-col justify-end p-12">
          <div className="max-w-md rounded-xl bg-white/85 p-6 shadow-pop backdrop-blur-sm">
            <p className="text-[13px] font-medium text-primary">Trading journal &amp; portfolio analytics</p>
            <p className="mt-2 text-[24px] font-medium leading-[1.15] tracking-[-0.04em] text-black">Turn your trades into decisions.</p>
            <p className="mt-3 text-[14px] leading-relaxed text-[#616161]">Log every trade, keep accounts separate, and see exactly where your edge comes from.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}
