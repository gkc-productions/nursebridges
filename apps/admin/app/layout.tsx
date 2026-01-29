import "./globals.css";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = {
  title: "NurseBridge Admin",
  description: "Admin dashboard"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>
          <header>
            <h1>NurseBridge Admin</h1>
            <p>Supabase-backed admin console for NurseBridge.</p>
            <nav>
              <Link href="/">Overview</Link>
              <Link href="/users">Users</Link>
              <Link href="/nurses">Nurses</Link>
              <Link href="/jobs">Jobs</Link>
              <Link href="/login">Login</Link>
            </nav>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
