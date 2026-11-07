import {
  BarChart3, BookOpen, CalendarDays, FileText, Gauge, Layers, Settings, ShieldCheck, Upload, Wallet, type LucideIcon,
} from "lucide-react";

export interface NavItem { href: string; label: string; icon: LucideIcon; match?: (p: string) => boolean }

export const MAIN_NAV: NavItem[] = [
  { href: "/app", label: "Dashboard", icon: Gauge, match: (p) => p === "/app" },
  { href: "/app/journal", label: "Trading Journal", icon: BookOpen },
  { href: "/app/portfolio", label: "Portfolio", icon: Wallet },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/app/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/app/strategies", label: "Strategies", icon: Layers },
  { href: "/app/risk", label: "Risk Management", icon: ShieldCheck },
  { href: "/app/reports", label: "Reports", icon: FileText },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/app/import", label: "Import trades", icon: Upload },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function isActive(item: NavItem, path: string) {
  return item.match ? item.match(path) : path === item.href || path.startsWith(item.href + "/");
}
