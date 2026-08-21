"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavigationItem = {
  href: string;
  label: string;
  icon: "overview" | "requests" | "careTeam" | "people" | "operations" | "audit" | "finance" | "team" | "quality" | "continuity";
};

const navigationItems: NavigationItem[] = [
  { href: "/", label: "Overview", icon: "overview" },
  { href: "/jobs", label: "Care requests", icon: "requests" },
  { href: "/nurses", label: "Credentialing", icon: "careTeam" },
  { href: "/operations", label: "Operations", icon: "operations" },
  { href: "/quality", label: "Quality", icon: "quality" },
  { href: "/continuity", label: "Continuity", icon: "continuity" },
  { href: "/team", label: "Team", icon: "team" },
  { href: "/finance", label: "Finance", icon: "finance" },
  { href: "/users", label: "People", icon: "people" },
  { href: "/audit", label: "Audit", icon: "audit" }
];

function NavIcon({ name }: { name: NavigationItem["icon"] }) {
  const paths = {
    overview: <><path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z" /></>,
    requests: <><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    careTeam: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.5-4 2.3-6 5.5-6s5 2 5.5 6M17 7v6M14 10h6" /></>,
    people: <><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2.5 19c.5-4 2.3-6 5.5-6s5 2 5.5 6M14 14c3.8-.7 6.3 1 7 5" /></>,
    operations: <><path d="M4 5h16v5H4zM4 14h16v5H4z" /><path d="M8 7.5h8M8 16.5h8" /></>,
    audit: <><path d="M6 3h12v18H6z" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
    finance: <><circle cx="12" cy="12" r="9" /><path d="M15 8.5c-.8-.8-1.8-1.2-3-1.2-1.7 0-3 1-3 2.3 0 3.5 6 1.3 6 4.8 0 1.3-1.3 2.3-3 2.3-1.2 0-2.3-.4-3-1.2M12 5v14" /></>,
    team: <><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2.5 19c.5-4 2.3-6 5.5-6s5 2 5.5 6M14 14c3.8-.7 6.3 1 7 5" /></>,
    quality: <><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" /></>,
    continuity: <><path d="M7 7h10v10H7z" /><path d="M4 12a8 8 0 0 1 14-5M20 12a8 8 0 0 1-14 5M17 4v4h-4M7 20v-4h4" /></>
  };

  return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[name]}</svg>;
}

export default function AdminNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation">
      {navigationItems.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={active ? "active" : undefined}
            href={item.href}
            key={item.href}
          >
            <span><NavIcon name={item.icon} /></span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
