import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <LogoMark size={36} />
      <p className="mt-6 text-[13px] font-medium text-primary-text">404</p>
      <h1 className="mt-1 text-[28px] font-medium tracking-[-0.04em]">Page not found</h1>
      <p className="mt-2 max-w-sm text-[14px] text-muted">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <div className="mt-6 flex gap-2">
        <Link href="/app" className="inline-flex h-9 items-center rounded-md bg-primary px-3 font-button text-[14px] font-semibold text-white">Go to dashboard</Link>
        <Link href="/" className="inline-flex h-9 items-center rounded-md px-3 text-[14px] shadow-[0_0_0_1px_var(--line-strong)]">Home</Link>
      </div>
    </main>
  );
}
