import type { Metadata } from "next";
import { AppGate } from "@/components/app/AppShell";
import { Onboarding } from "@/components/onboarding/Onboarding";

export const metadata: Metadata = { title: "Welcome" };

export default function Page() {
  return (
    <AppGate bare>
      <Onboarding />
    </AppGate>
  );
}

// Client-rendered behind auth; data loads in the browser, so navigations are not instant from the server.
export const instant = false;
