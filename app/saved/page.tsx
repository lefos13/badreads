import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RoastCard } from "@/components/RoastCard";
import { getDomainStore } from "@/src/domain/repository";
import { getSession } from "@/src/lib/session";

export const metadata: Metadata = {
  title: "Saved receipts — Badreads",
  description: "Your collection of bookmarked verdicts and receipts.",
};

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const store = getDomainStore();
  const roasts = await store.listBookmarkedRoasts(session.user.id);
  const bookIds = Array.from(new Set(roasts.map((r) => r.bookId)));
  const [books, reactionStates] = await Promise.all([
    store.getBooksByIds(bookIds),
    store.getUserReactionStates(
      session.user.id,
      roasts.map((r) => r.id),
    ),
  ]);
  const booksById = new Map(books.map((book) => [book.id, book] as const));

  return (
    <main className="page-width section">
      <div className="section-heading">
        <div>
          <span className="eyebrow mono">Personal archive / saved receipts</span>
          <h1 className="book-detail-title">Saved receipts.</h1>
        </div>
        <p>Evidence and verdicts you have bookmarked for the group chat.</p>
      </div>

      <div className="feed-grid">
        <div className="roast-list">
          {roasts.length ? (
            roasts.map((roast) => {
              const book = booksById.get(roast.bookId);
              return book ? (
                <RoastCard
                  bookSlug={book.slug}
                  bookTitle={book.title}
                  key={roast.id}
                  reactionState={reactionStates[roast.id]}
                  roast={roast}
                />
              ) : null;
            })
          ) : (
            <div className="empty-state">
              <h2>No saved receipts yet.</h2>
              <p>Hit &quot;Save&quot; on any roast in the feed to pin it here.</p>
              <div className="hero-actions">
                <Link className="button button-primary" href="/feed">Explore the feed</Link>
                <Link className="button button-quiet" href="/search">Find a book</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
