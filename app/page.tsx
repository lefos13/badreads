import Link from "next/link";
import { BookCard } from "@/components/BookCard";
import { RoastCard } from "@/components/RoastCard";
import { selectWorstOfWeek } from "@/src/domain/editorial";
import { getDomainStore } from "@/src/domain/repository";
import type { ReactionState } from "@/src/domain/types";
import { getSession } from "@/src/lib/session";

/*
 * Public discovery reads through the same async domain store as mutations.
 * Demo mode resolves to the seeded memory adapter while production resolves
 * to Neon, so newly published content remains visible without page rewrites.
 */

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const store = getDomainStore();
  // The bottom-100 board does not depend on the viewer, so it starts before the
  // session is awaited instead of queueing behind it.
  const bottom100Promise = store.listBottom100("badness");
  const session = await getSession();
  const [bottom100, feed] = await Promise.all([
    bottom100Promise,
    store.listFeed(session?.user?.id),
  ]);
  const worst = selectWorstOfWeek(feed);
  const previewRoasts = feed.slice(0, 3);
  const featuredItems = bottom100.slice(0, 8);
  const featuredBooks = featuredItems.map((item) => item.book);
  const previewBookIds = Array.from(new Set([
    ...previewRoasts.map((roast) => roast.bookId),
    ...(worst ? [worst.roast.bookId] : []),
  ]));
  const previewRoastIds = Array.from(new Set([
    ...previewRoasts.map((roast) => roast.id),
    ...(worst ? [worst.roast.id] : []),
  ]));
  const [previewBooks, reactionStates] = await Promise.all([
    store.getBooksByIds(previewBookIds),
    session?.user?.id
      ? store.getUserReactionStates(session.user.id, previewRoastIds)
      : Promise.resolve<Record<string, ReactionState>>({}),
  ]);
  const allBooks = [...featuredBooks, ...previewBooks];
  const booksById = new Map(allBooks.map((book) => [book.id, book] as const));
  const worstBook = worst ? booksById.get(worst.roast.bookId) : undefined;
  const summaries = new Map(featuredItems.map((item) => [item.book.id, item.summary]));
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
          {featuredBooks.map((book) => {
            const summary = summaries.get(book.id) ?? { average: null, count: 0, worstCount: 0 };
            return <BookCard key={book.id} book={book} average={summary.average} roastCount={summary.count} />;
          })}
        </div>
      </section>

      {worst ? (
        <section className="section page-width">
          <div className="worst-of-week">
            <span className="eyebrow mono">Worst of the week / The most-applauded letdown</span>
            <h2>This week&apos;s most-applauded letdown.</h2>
            {worstBook ? (
              <RoastCard
                bookSlug={worstBook.slug}
                bookTitle={worstBook.title}
                reactionState={reactionStates[worst.roast.id]}
                roast={worst.roast}
              />
            ) : null}
            <Link className="button button-quiet" href="/feed">More from the feed →</Link>
          </div>
        </section>
      ) : null}

      <section className="section page-width">
        <div className="section-heading">
          <h2>From the bad side of the shelf</h2>
          <p>Sharp takes with receipts. Critique the work. Leave the people alone.</p>
        </div>
        <div className="feed-grid">
          <div className="roast-list">
            {previewRoasts.map((roast) => {
              const book = booksById.get(roast.bookId);
              return book ? <RoastCard bookSlug={book.slug} bookTitle={book.title} key={roast.id} reactionState={reactionStates[roast.id]} roast={roast} /> : null;
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
