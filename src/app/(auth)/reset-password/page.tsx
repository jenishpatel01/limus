import type { Metadata } from "next";
import { ResetForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "New password" };

export default function Page() {
  return <ResetForm />;
}
