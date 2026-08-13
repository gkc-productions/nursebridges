"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavigationItem = {
  href: string;
  label: string;
  icon: "overview" | "requests" | "careTeam" | "people";
};

const navigationItems: NavigationItem[] = [
  { href: "/", label: "Overview", icon: "overview" },
  { href: "/jobs", label: "Care requests", icon: "requests" },
  { href: "/nurses", label: "Credentialing", icon: "careTeam" },
  { href: "/users", label: "People", icon: "people" }
];

function NavIcon({ name }: { name: NavigationItem["icon"] }) {
  const paths = {
    overview: <><path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z" /></>,
    requests: <><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    careTeam: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.5-4 2.3-6 5.5-6s5 2 5.5 6M17 7v6M14 10h6" /></>,
    people: <><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2.5 19c.5-4 2.3-6 5.5-6s5 2 5.5 6M14 14c3.8-.7 6.3 1 7 5" /></>
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
