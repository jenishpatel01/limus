import { Suspense } from "react";
import type { Metadata } from "next";
import { ConfirmLink } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Confirm", robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <ConfirmLink />
    </Suspense>
  );
}
