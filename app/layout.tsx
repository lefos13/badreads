import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { resolveAppUrl } from "@/src/lib/url-config";
import "./globals.css";

export const metadata: Metadata = {
  title: "Badreads — books that let you down",
  description: "A sharp, evidence-based place to say exactly why a book failed you.",
  metadataBase: resolveAppUrl(process.env.NEXT_PUBLIC_SITE_URL),
  openGraph: {
    title: "Badreads — books that let you down",
    description: "The home of the fair, funny, and devastating book roast.",
    type: "website",
  },
};
function SiteHeaderFallback() {
  return (
    <header className="site-header">
      <Link className="brand" href="/">
        <span className="brand-mark">✳</span>badreads
      </Link>
      <nav aria-label="Primary navigation" className="header-nav">
        <Link className="header-link" href="/search">Find a book</Link>
        <Link className="header-link" href="/bottom-100">Bottom 100</Link>
        <Link className="header-link" href="/feed">The feed</Link>
        <Link className="button button-primary" href="/write">Write a roast</Link>
      </nav>
    </header>
  );
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="site-shell">
          <Suspense fallback={<SiteHeaderFallback />}>
            <SiteHeader />
          </Suspense>
          {children}
          <footer className="footer">
            <div className="page-width footer-inner">
              <span className="mono">BADREADS / A HOME FOR HONEST DISAPPOINTMENT</span>
              <span className="footer-links">
                <Link href="/community">Community</Link>
                <Link href="/about">About</Link>
                <Link href="/faq">FAQ</Link>
                <Link href="/contributors">Contributors</Link>
                <Link href="/leaderboard">Top roasters</Link>
                <Link href="/support">Support</Link>
                <Link href="/privacy">Privacy</Link>
                <Link href="/terms">Terms</Link>
                <a href="/feed.xml" title="RSS Feed">RSS</a>
              </span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
