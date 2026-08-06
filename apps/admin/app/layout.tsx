import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";
import ThemeToggle from "./theme-toggle";

export const metadata = {
  title: "NurseBridges Operations",
  description: "Coordinate trusted care with clarity."
};

function NavIcon({ name }: { name: "overview" | "requests" | "careTeam" | "people" }) {
  const paths = {
    overview: <><path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z" /></>,
    requests: <><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    careTeam: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.5-4 2.3-6 5.5-6s5 2 5.5 6M17 7v6M14 10h6" /></>,
    people: <><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2.5 19c.5-4 2.3-6 5.5-6s5 2 5.5 6M14 14c3.8-.7 6.3 1 7 5" /></>
  };

  return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[name]}</svg>;
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="app-shell">
          <aside className="sidebar">
            <Link className="brand" href="/" aria-label="NurseBridges home">
              <span className="brand-mark"><img src="/brand/nursebridge-mark.png" alt="" /></span>
              <span><strong>NurseBridges</strong><small>Operations center</small></span>
            </Link>
            <nav aria-label="Primary navigation">
              <Link href="/"><span><NavIcon name="overview" /></span>Overview</Link>
              <Link href="/jobs"><span><NavIcon name="requests" /></span>Care requests</Link>
              <Link href="/nurses"><span><NavIcon name="careTeam" /></span>Credentialing</Link>
              <Link href="/users"><span><NavIcon name="people" /></span>People</Link>
            </nav>
            <div className="sidebar-foot">
              <div className="live-pill"><i /> Systems connected</div>
              <Link href="/login">Account & access</Link>
            </div>
          </aside>
          <main>
            <header className="topbar">
              <div><p className="eyebrow">Closed beta · Operations</p><h1>Good morning.</h1></div>
              <ThemeToggle />
            </header>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
