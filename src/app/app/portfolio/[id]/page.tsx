import { Suspense } from "react";
import type { Metadata } from "next";
import { AccountDetail } from "@/components/portfolio/Portfolio";

export const metadata: Metadata = { title: "Account" };

// Client-rendered behind auth; data loads in the browser, so navigations are not instant from the server.
export const instant = false;

export default function Page() {
  return (
    <Suspense>
      <AccountDetail />
    </Suspense>
  );
}
