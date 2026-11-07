import { Suspense } from "react";
import type { Metadata } from "next";
import { AnalyticsPage } from "@/components/analytics/Analytics";

export const metadata: Metadata = { title: "Analytics" };

// Client-rendered behind auth; data loads in the browser, so navigations are not instant from the server.
export const instant = false;

export default function Page() {
  return (
    <Suspense>
      <AnalyticsPage />
    </Suspense>
  );
}
