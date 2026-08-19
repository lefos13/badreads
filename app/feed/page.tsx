import { BookCard } from "@/components/BookCard";
import { FeedFilterBar } from "@/components/FeedFilterBar";
import { RoastCard } from "@/components/RoastCard";
import { FLAW_TAGS, type FlawTag } from "@/src/domain/core";
import { getDomainStore } from "@/src/domain/repository";
import type { ReactionState } from "@/src/domain/types";
import { getSession } from "@/src/lib/session";

export const metadata = {
  title: "The feed — Badreads",
  description: "Fresh, fair, and funny criticism from the bad side of the shelf.",
};

export const dynamic = "force-dynamic";
type FeedPageProps = {
  searchParams: Promise<{ flaw?: string; rating?: string }>;
};

export default async function FeedPage({ searchParams }: FeedPageProps) {
  const params = await searchParams;
  const rawFlaw = params.flaw?.toUpperCase();
  const flaw: FlawTag | undefined = rawFlaw && (FLAW_TAGS as readonly string[]).includes(rawFlaw)
    ? (rawFlaw as FlawTag)
    : undefined;
  const rating = params.rating && /^[1-5]$/.test(params.rating) ? Number(params.rating) : undefined;

  const session = await getSession();
  const store = getDomainStore();
  const [rawRoasts, sidebarCandidates] = await Promise.all([
    store.listFeed(session?.user?.id),
    store.listBooks(6),
  ]);

  let roasts = rawRoasts;
  if (flaw) {
    roasts = roasts.filter((r) => r.flawTags.includes(flaw));
  }
  if (rating) {
    roasts = roasts.filter((r) => r.rating === rating);
  }
  const roastBookIds = Array.from(new Set(roasts.map((r) => r.bookId)));
  // "Worst right now" shows the sidebar candidates, so summaries are fetched for
  // exactly the books that are rendered — in one grouped query, not one per book.
  const sidebarBooks = sidebarCandidates.slice(0, 3);
  const [feedBooks, summaries, reactionStates] = await Promise.all([
    store.getBooksByIds(roastBookIds),
    store.getBookSummaries(sidebarBooks.map((book) => book.id)),
    session?.user?.id ? store.getUserReactionStates(session.user.id, roasts.map((r) => r.id)) : Promise.resolve<Record<string, ReactionState>>({}),
  ]);
  const booksById = new Map([...feedBooks, ...sidebarCandidates].map((book) => [book.id, book] as const));

  return (
    <main className="page-width section">
      <div className="section-heading">
        <div>
          <span className="eyebrow mono">Following + discovery / live from the bad side</span>
          <h1 className="book-detail-title">The feed.</h1>
        </div>
        <p>Two from people you follow, one from the wider disaster. Fair and funny get separate buttons here.</p>
      </div>
      <FeedFilterBar currentFlaw={flaw} currentRating={rating} />
      <div className="feed-grid">
        <div className="roast-list">
          {roasts.length ? (
            roasts.map((roast) => {
              const book = booksById.get(roast.bookId);
              return book ? <RoastCard bookSlug={book.slug} bookTitle={book.title} key={roast.id} reactionState={reactionStates[roast.id]} roast={roast} /> : null;
            })
          ) : (
            <div className="empty-state">
              <h2>No roasts match this filter.</h2>
              <p>Try exploring other flaw tags or clear the filter.</p>
            </div>
          )}
        </div>
        <aside>
          <span className="eyebrow mono">Worst right now</span>
          <div className="roast-list roast-book-list">
            {sidebarBooks.map((book) => <BookCard key={book.id} book={book} average={summaries[book.id]?.average ?? null} roastCount={summaries[book.id]?.count ?? 0} />)}
          </div>
        </aside>
      </div>
    </main>
  );
}
