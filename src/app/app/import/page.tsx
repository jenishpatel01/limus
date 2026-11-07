import { Suspense } from "react";
import type { Metadata } from "next";
import { ImportPage } from "@/components/import/ImportWizard";

export const metadata: Metadata = { title: "Import trades" };

// Client-rendered behind auth; data loads in the browser, so navigations are not instant from the server.
export const instant = false;

export default function Page() {
  return (
    <Suspense>
      <ImportPage />
    </Suspense>
  );
}
