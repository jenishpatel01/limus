"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <h1 className="text-[26px] font-medium tracking-[-0.04em]">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-[14px] text-muted">An unexpected error occurred. Your saved data is safe.</p>
      <div className="mt-6 flex gap-2">
        <button type="button" onClick={reset} className="inline-flex h-9 items-center rounded-md bg-primary px-3 font-button text-[14px] font-semibold text-white">Try again</button>
        <a href="/app" className="inline-flex h-9 items-center rounded-md px-3 text-[14px] shadow-[0_0_0_1px_var(--line-strong)]">Dashboard</a>
      </div>
    </main>
  );
}
