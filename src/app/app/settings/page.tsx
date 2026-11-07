import { Suspense } from "react";
import type { Metadata } from "next";
import { SettingsPage } from "@/components/settings/Settings";

export const metadata: Metadata = { title: "Settings" };

// Client-rendered behind auth; data loads in the browser, so navigations are not instant from the server.
export const instant = false;

export default function Page() {
  return (
    <Suspense>
      <SettingsPage />
    </Suspense>
  );
}
