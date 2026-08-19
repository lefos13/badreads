import type { Metadata } from "next";
import Link from "next/link";
import { getDomainStore } from "@/src/domain/repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Top Roasters — Badreads",
  description: "The Badreads profiles earning the most applause for their evidence-backed roasts.",
};

export default async function LeaderboardPage() {
  const store = getDomainStore();
  const roasters = await store.listTopRoasters();
  const totalRoasts = roasters.reduce((total, roaster) => total + roaster.roastCount, 0);
  const totalReactions = roasters.reduce((total, roaster) => total + roaster.totalReactions, 0);

  return (
    <main className="page-width">
      <header className="hero">
        <span className="eyebrow mono">Top Roasters / Applause from the community</span>
        <h1>The Roast Hall of Fame.</h1>
        <p className="hero-copy">
          The profiles whose precise disappointments earned the most Fair and Funny reactions from the readers.
        </p>

        <div className="stat-row">
          <div className="stat">
            <strong>{roasters.length}</strong>
            <span>top roasters</span>
          </div>
          <div className="stat">
            <strong>{totalRoasts}</strong>
            <span>published roasts</span>
          </div>
          <div className="stat">
            <strong>{totalReactions}</strong>
            <span>community reactions</span>
          </div>
        </div>
      </header>

      <section className="section" aria-label="Top roasters leaderboard">
        {roasters.length ? (
          <ol className="leaderboard">
            {roasters.map((roaster, index) => (
              <li className="leaderboard-row" key={roaster.profile.id}>
                <span className="leaderboard-rank mono">#{index + 1}</span>
                <Link className="roast-author" href={`/u/${roaster.profile.handle}`}>
                  @{roaster.profile.handle}
                </Link>
                <span className="mono">{roaster.roastCount} roasts</span>
                <span className="mono">{roaster.fairCount} fair</span>
                <span className="mono">{roaster.funnyCount} funny</span>
                <span className="mono">{roaster.totalReactions} reactions</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty-state">No roasts yet — be the first to make the list.</div>
        )}
      </section>
    </main>
  );
}
