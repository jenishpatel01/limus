import { Suspense } from "react";
import type { Metadata } from "next";
import { JournalPage } from "@/components/journal/JournalList";

export const metadata: Metadata = { title: "Trading Journal" };

export default function Page() {
  return (
    <Suspense>
      <JournalPage />
    </Suspense>
  );
}

// Client-rendered behind auth; data loads in the browser, so navigations are not instant from the server.
export const instant = false;
