import { Suspense } from "react";
import type { Metadata } from "next";
import { ReportsPage } from "@/components/reports/Reports";

export const metadata: Metadata = { title: "Reports" };

// Client-rendered behind auth; data loads in the browser, so navigations are not instant from the server.
export const instant = false;

export default function Page() {
  return (
    <Suspense>
      <ReportsPage />
    </Suspense>
  );
}
