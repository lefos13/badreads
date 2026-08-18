import Link from "next/link";
import { BookCard } from "@/components/BookCard";
import { RoastCard } from "@/components/RoastCard";
import { getDomainStore } from "@/src/domain/repository";

/*
 * Public discovery reads through the same async domain store as mutations.
 * Demo mode resolves to the seeded memory adapter while production resolves
 * to Neon, so newly published content remains visible without page rewrites.
 */

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const store = getDomainStore();
  const [books, feed] = await Promise.all([store.listBooks(), store.listFeed()]);
  const summaries = new Map(await Promise.all(books.map(async (book) => [book.id, await store.getBookSummary(book.id)] as const)));

  return (
    <main>
      <section className="hero">
        <div className="page-width hero-grid">
          <div>
            <span className="eyebrow mono">The anti-shelf / honest reviews only</span>
            <h1>Books that let you down.</h1>
            <p className="hero-copy">
              Badreads is a home for the fair, funny, and devastating review. Find the book everyone loved. Explain exactly why you didn&apos;t.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/search">Find something to roast</Link>
              <Link className="button button-quiet" href="/feed">Read the feed</Link>
            </div>
          </div>
          <div aria-label="Badreads campaign poster" className="hero-poster">
            <span className="poster-stamp mono">5 STARS = WORST</span>
            <span className="poster-title">BE<br />HONEST.</span>
            <span className="poster-score mono">✳ no author attacks / just receipts</span>
          </div>
        </div>
      </section>

      <section className="section page-width">
        <div className="section-heading">
          <h2>Currently being dismantled</h2>
          <p>Popular books, unpopular opinions, and enough evidence to make the group chat pause.</p>
        </div>
        <div className="book-grid">
          {books.map((book) => {
            const summary = summaries.get(book.id) ?? { average: null, count: 0, worstCount: 0 };
            return <BookCard key={book.id} book={book} average={summary.average} roastCount={summary.count} />;
          })}
        </div>
      </section>

      <section className="section page-width">
        <div className="section-heading">
          <h2>From the bad side of the shelf</h2>
          <p>Sharp takes with receipts. Critique the work. Leave the people alone.</p>
        </div>
        <div className="feed-grid">
          <div className="roast-list">
            {feed.slice(0, 3).map((roast) => {
              const book = books.find((candidate) => candidate.id === roast.bookId);
              return book ? <RoastCard key={roast.id} roast={roast} bookSlug={book.slug} bookTitle={book.title} /> : null;
            })}
          </div>
          <aside className="side-note">
            <h3>What makes a good bad review?</h3>
            <p>Start with the line that made you put the book down. Then show us the page, pattern, or plot hole that earned it.</p>
            <Link className="button button-coral" href="/write">Write yours →</Link>
          </aside>
        </div>
      </section>
    </main>
  );
}
