import type { Metadata } from "next";
import { getSupportLinks, isSupportConfigured } from "@/src/lib/support-config";

export const metadata: Metadata = {
  title: "Support Badreads — Badreads",
  description: "Keep Badreads independent, free to read, and honest with community support.",
};

export default function SupportPage() {
  const links = getSupportLinks();

  return (
    <main className="page-width section">
      <span className="eyebrow mono">Community-funded / No ads ever</span>
      <h1>Fuel the roast.</h1>
      <p className="hero-copy">
        Badreads is independent, community-run, and free to read. {links.label} keeps the lights on without ads or
        pay-to-play verdicts; every roast stays honest, whether a book deserves one star or five.
      </p>

      <div className="stat-row">
        <div className="stat">
          <strong>No ads</strong>
          <span>ever</span>
        </div>
        <div className="stat">
          <strong>Community-run</strong>
          <span>by readers</span>
        </div>
        <div className="stat">
          <strong>100%</strong>
          <span>of donations fund the site</span>
        </div>
      </div>

      {isSupportConfigured(links) ? (
        <section aria-labelledby="support-options-title">
          <h2 id="support-options-title">Choose your support lane.</h2>
          <div className="support-cards">
            {links.bmcUrl ? (
              <article className="support-card">
                <h3>Buy Me a Coffee</h3>
                <p>A small coffee keeps the roast receipts sorted and the site online.</p>
                <a className="button button-primary" href={links.bmcUrl} rel="noopener noreferrer" target="_blank">
                  Support with Buy Me a Coffee
                </a>
              </article>
            ) : null}
            {links.kofiUrl ? (
              <article className="support-card">
                <h3>Ko-fi</h3>
                <p>Tip the tiny editorial machine that keeps bad books accountable.</p>
                <a className="button button-coral" href={links.kofiUrl} rel="noopener noreferrer" target="_blank">
                  Support with Ko-fi
                </a>
              </article>
            ) : null}
          </div>
        </section>
      ) : (
        <div className="empty-state">
          <h2>Support coming soon</h2>
          <p>We are setting up the community tip jar. The roasts remain free, independent, and ad-free in the meantime.</p>
        </div>
      )}
    </main>
  );
}
