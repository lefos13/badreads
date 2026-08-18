import { BookCard } from "@/components/BookCard";
import { RoastCard } from "@/components/RoastCard";
import { demoBooks, getBookSummary, getDemoFeed } from "@/src/data/demo";

export const metadata = {
  title: "The feed — Badreads",
  description: "Fresh, fair, and funny criticism from the bad side of the shelf.",
};

export default function FeedPage() {
  const roasts = getDemoFeed();
  const books = demoBooks.slice().sort((a, b) => (getBookSummary(b.id).average ?? 0) - (getBookSummary(a.id).average ?? 0));

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
            const book = demoBooks.find((candidate) => candidate.id === roast.bookId);
            return book ? <RoastCard key={roast.id} roast={roast} bookSlug={book.slug} bookTitle={book.title} /> : null;
          })}
        </div>
        <aside>
          <span className="eyebrow mono">Worst right now</span>
          <div className="roast-list roast-book-list">
            {books.slice(0, 3).map((book) => <BookCard key={book.id} book={book} average={getBookSummary(book.id).average} roastCount={getBookSummary(book.id).count} />)}
          </div>
        </aside>
      </div>
    </main>
  );
}
