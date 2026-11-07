import type { Metadata } from "next";
import { AppGate } from "@/components/app/AppShell";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · Limus" } };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppGate>{children}</AppGate>;
}

// Client-rendered behind auth; data loads in the browser, so navigations are not instant from the server.
export const instant = false;
