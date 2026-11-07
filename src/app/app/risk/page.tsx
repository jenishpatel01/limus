import { Suspense } from "react";
import type { Metadata } from "next";
import { RiskPage } from "@/components/risk/Risk";

export const metadata: Metadata = { title: "Risk Management" };

// Client-rendered behind auth; data loads in the browser, so navigations are not instant from the server.
export const instant = false;

export default function Page() {
  return (
    <Suspense>
      <RiskPage />
    </Suspense>
  );
}
