import type { Metadata } from "next";
import Link from "next/link";
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="site-shell">
          <SiteHeader />
          {children}
          <footer className="footer">
            <div className="page-width footer-inner">
              <span className="mono">BADREADS / A HOME FOR HONEST DISAPPOINTMENT</span>
              <span className="footer-links">
                <Link href="/community">Community</Link>
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
