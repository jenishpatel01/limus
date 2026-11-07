import { Suspense } from "react";
import type { Metadata } from "next";
import { CalendarPage } from "@/components/calendar/Calendar";

export const metadata: Metadata = { title: "Calendar" };

// Client-rendered behind auth; data loads in the browser, so navigations are not instant from the server.
export const instant = false;

export default function Page() {
  return (
    <Suspense>
      <CalendarPage />
    </Suspense>
  );
}
