import { Suspense } from "react";
import type { Metadata } from "next";
import { TradeDetail } from "@/components/journal/TradeDetail";

export const metadata: Metadata = { title: "Trade" };

export default function Page() {
  return (
    <Suspense>
      <TradeDetail />
    </Suspense>
  );
}

// Client-rendered behind auth; data loads in the browser, so navigations are not instant from the server.
export const instant = false;
