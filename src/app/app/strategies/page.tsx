import { Suspense } from "react";
import type { Metadata } from "next";
import { StrategiesPage } from "@/components/strategies/Strategies";

export const metadata: Metadata = { title: "Strategies" };

// Client-rendered behind auth; data loads in the browser, so navigations are not instant from the server.
export const instant = false;

export default function Page() {
  return (
    <Suspense>
      <StrategiesPage />
    </Suspense>
  );
}
