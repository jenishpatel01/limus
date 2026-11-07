import type { Metadata } from "next";
import { NewTrade } from "@/components/journal/TradeDetail";

export const metadata: Metadata = { title: "New trade" };

export default function Page() {
  return <NewTrade />;
}

// Client-rendered behind auth; data loads in the browser, so navigations are not instant from the server.
export const instant = false;
