import { BookCard } from "@/components/BookCard";
import { RoastCard } from "@/components/RoastCard";
import { getDomainStore } from "@/src/domain/repository";
import { getSession } from "@/src/lib/session";

export const metadata = {
  title: "The feed — Badreads",
  description: "Fresh, fair, and funny criticism from the bad side of the shelf.",
};

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const session = await getSession();
  const store = getDomainStore();
  const [roasts, unsortedBooks] = await Promise.all([store.listFeed(session?.user?.id), store.listBooks()]);
  const summaries = new Map(await Promise.all(unsortedBooks.map(async (book) => [book.id, await store.getBookSummary(book.id)] as const)));
  const books = unsortedBooks.sort((a, b) => (summaries.get(b.id)?.average ?? 0) - (summaries.get(a.id)?.average ?? 0));

  return (
    <main className="page-width section">
      <div className="section-heading">
        <div>
          <span className="eyebrow mono">Following + discovery / live from the bad side</span>
          <h1 className="book-detail-title">The feed.</h1>
        </div>
        <p>Two from people you follow, one from the wider disaster. Fair and funny get separate buttons here.</p>
      </div>
      <div className="feed-grid">
        <div className="roast-list">
          {roasts.map((roast) => {
            const book = books.find((candidate) => candidate.id === roast.bookId);
            return book ? <RoastCard key={roast.id} roast={roast} bookSlug={book.slug} bookTitle={book.title} /> : null;
          })}
        </div>
        <aside>
          <span className="eyebrow mono">Worst right now</span>
          <div className="roast-list roast-book-list">
            {books.slice(0, 3).map((book) => <BookCard key={book.id} book={book} average={summaries.get(book.id)?.average ?? null} roastCount={summaries.get(book.id)?.count ?? 0} />)}
          </div>
        </aside>
      </div>
    </main>
  );
}
