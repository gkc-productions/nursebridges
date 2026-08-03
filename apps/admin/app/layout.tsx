import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";
import ThemeToggle from "./theme-toggle";

export const metadata = {
  title: "NurseBridges Dispatch",
  description: "Coordinate trusted care with clarity."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="app-shell">
          <aside className="sidebar">
            <Link className="brand" href="/" aria-label="NurseBridges home">
              <span className="brand-mark"><img src="/brand/nursebridge-mark.png" alt="" /></span>
              <span><strong>NurseBridges</strong><small>Care operations</small></span>
            </Link>
            <nav aria-label="Primary navigation">
              <Link href="/"><span>⌂</span>Overview</Link>
              <Link href="/jobs"><span>↗</span>Care requests</Link>
              <Link href="/nurses"><span>✦</span>Care team</Link>
              <Link href="/users"><span>◎</span>People</Link>
            </nav>
            <div className="sidebar-foot">
              <div className="live-pill"><i /> Systems connected</div>
              <Link href="/login">Account & access</Link>
            </div>
          </aside>
          <main>
            <header className="topbar">
              <div><p className="eyebrow">Closed beta · Dispatch</p><h1>Care, clearly coordinated.</h1></div>
              <ThemeToggle />
            </header>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
