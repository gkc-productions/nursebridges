import "./globals.css";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import AdminNavigation from "./admin-navigation";
import ThemeToggle from "./theme-toggle";

export const metadata = {
  title: "NurseBridges Operations",
  description: "Coordinate trusted care with clarity."
};

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={compact ? "brand mobile-brand" : "brand"} href="/" aria-label="NurseBridge operations home">
      <span className="brand-mark">
        <Image src="/brand/nursebridge-mark.png" alt="" width={50} height={50} priority />
      </span>
      <span><strong>NurseBridge</strong><small>Operations center</small></span>
    </Link>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div className="app-shell">
          <aside className="sidebar">
            <Brand />
            <AdminNavigation />
            <div className="sidebar-foot">
              <div className="live-pill"><i /> Systems connected</div>
              <Link href="/login">Account & access</Link>
            </div>
          </aside>
          <main>
            <header className="topbar">
              <Brand compact />
              <div className="topbar-title"><p className="eyebrow">NurseBridge workspace</p><h1>Operations</h1></div>
              <div className="topbar-tools">
                <span className="environment-badge"><i /> Closed beta</span>
                <ThemeToggle />
              </div>
            </header>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
