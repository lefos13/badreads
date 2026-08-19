import Link from "next/link";
import { CONTRIBUTORS } from "@/src/data/contributors";

export const metadata = {
  title: "Contributors — Badreads",
  description: "Meet the readers building Badreads and learn how to contribute.",
};

export default function ContributorsPage() {
  return (
    <main className="page-width policy-page">
      <span className="eyebrow mono">Built by readers</span>
      <h1>The people keeping the receipts.</h1>
      <p className="hero-copy">
        Badreads is a community project for precise disappointment. The roster below is a starter roll call while the real contributor list grows.
      </p>

      <div className="stat-row">
        <div className="stat">
          <strong>5</strong>
          <span>badness levels</span>
        </div>
        <div className="stat">
          <strong>9</strong>
          <span>flaw tags</span>
        </div>
        <div className="stat">
          <strong>1</strong>
          <span>roast per book</span>
        </div>
        <div className="stat">
          <strong>100</strong>
          <span>Bottom 100 slots</span>
        </div>
      </div>

      <h2>Contributors</h2>
      <ul>
        {CONTRIBUTORS.map((contributor) => (
          <li key={contributor.handle}>
            <strong>{contributor.name}</strong> ({contributor.handle}) — {contributor.role}
          </li>
        ))}
      </ul>

      <section className="section">
        <h2>How to contribute</h2>
        <p>
          Write roasts with a memorable hook and receipts from the work. Make the flaw specific, choose the right tags, and mark spoilers when the evidence gives something away.
        </p>
        <p>
          Submit books from the community catalog when a title is missing, report violations when a roast crosses the line, and follow the <Link href="/community">house rules</Link> every time.
        </p>
        <Link className="button button-coral" href="/support">
          Support Badreads →
        </Link>
      </section>
    </main>
  );
}
