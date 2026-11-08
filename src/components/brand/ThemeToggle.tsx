"use client";

import { Moon, Sun } from "lucide-react";
import { applyThemeAnimated } from "@/components/app/theme";

/** Sun / moon switch. Icons swap with CSS (dark: variant) so server and client markup always match. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      onClick={(e) => applyThemeAnimated(document.documentElement.dataset.theme === "dark" ? "light" : "dark", { x: e.clientX, y: e.clientY })}
      className={`group relative inline-flex size-9 items-center justify-center overflow-hidden rounded-md text-ink-3 transition-colors hover:bg-muted-bg hover:text-ink ${className}`}
    >
      <Moon className="size-[18px] transition-transform duration-500 group-hover:-rotate-12 dark:hidden" strokeWidth={1.75} />
      <Sun className="hidden size-[18px] transition-transform duration-500 group-hover:rotate-45 dark:block" strokeWidth={1.75} />
    </button>
  );
}
