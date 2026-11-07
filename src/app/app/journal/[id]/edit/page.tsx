import { Suspense } from "react";
import type { Metadata } from "next";
import { EditTrade } from "@/components/journal/TradeDetail";

export const metadata: Metadata = { title: "Edit trade" };

export default function Page() {
  return (
    <Suspense>
      <EditTrade />
    </Suspense>
  );
}

// Client-rendered behind auth; data loads in the browser, so navigations are not instant from the server.
export const instant = false;
