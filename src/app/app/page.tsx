import { Dashboard } from "@/components/dashboard/Dashboard";

export default function Page() {
  return <Dashboard />;
}

// Client-rendered behind auth; data loads in the browser, so navigations are not instant from the server.
export const instant = false;
