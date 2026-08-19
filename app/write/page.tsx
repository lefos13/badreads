import Link from "next/link";
import { redirect } from "next/navigation";
import { RoastForm } from "@/components/RoastForm";
import { getDomainStore } from "@/src/domain/repository";
import { getSession } from "@/src/lib/session";

type WritePageProps = {
  searchParams: Promise<{ book?: string; q?: string }>;
};

export const dynamic = "force-dynamic";

export default async function WritePage({ searchParams }: WritePageProps) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const store = getDomainStore();
  if (!(await store.getProfile(session.user.id))) redirect("/onboarding");

  const params = await searchParams;
  const target = params.book?.trim();
  const query = params.q?.trim() ?? "";

  // Fast direct resolution: slug and id lookups race in one round trip instead
  // of falling back serially, and the slug hit still wins when both resolve.
  const [bookBySlug, bookById] = target
    ? await Promise.all([store.getBookBySlug(target), store.getBook(target)])
    : [undefined, undefined];
  const book = bookBySlug ?? bookById;

  if (!book) {
    // Bounded search / curated targets: never dump thousands of books to the client
    let targetBooks = [];
    if (query.length > 0) {
      targetBooks = await store.searchBooks(query, 12);
    } else {
      const bottom100 = await store.listBottom100("badness");
      targetBooks = bottom100.slice(0, 12).map((item) => item.book);
      if (targetBooks.length === 0) {
        targetBooks = await store.listBooks(12);
      }
    }
    return (
      <main className="page-width section">
        <div className="form-shell">
          <span className="eyebrow mono">Step 01 / choose your target</span>
          <h1>Which book earned this?</h1>
          <p className="form-intro">
            Pick a book below to begin writing your roast. Use the filter to find any title instantly, or search the full catalog if it is not listed yet.
          </p>

          <form action="/write" className="write-filter-form" method="GET">
            <input
              aria-label="Filter target books"
              autoFocus
              className="search-input"
              defaultValue={query}
              name="q"
              placeholder="Filter by title or author..."
              type="search"
            />
            <button className="button button-primary" type="submit">
              Filter
            </button>
            {query ? (
              <Link className="button button-quiet" href="/write">
                Clear
              </Link>
            ) : null}
          </form>

          {targetBooks.length > 0 ? (
            <div className="roast-list write-book-list">
              {targetBooks.map((candidate) => (
                <Link
                  className="search-result"
                  href={`/write?book=${candidate.slug}`}
                  key={candidate.id}
                >
                  <span>
                    <strong>{candidate.title}</strong>
                    <span className="book-meta">{candidate.authors.join(", ")}</span>
                  </span>
                  <span className="mono search-arrow">→</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>No local books found matching &ldquo;{query}&rdquo;.</p>
              <div className="hero-actions" style={{ marginTop: "1rem" }}>
                <Link
                  className="button button-coral"
                  href={`/search?q=${encodeURIComponent(query)}`}
                >
                  Search Full Catalog for &ldquo;{query}&rdquo;
                </Link>
                <Link className="button button-quiet" href="/books/new">
                  Add Book to Catalog
                </Link>
              </div>
            </div>
          )}

          <div className="write-footer-actions">
            <Link className="button button-quiet" href="/search">
              Search Full Catalog
            </Link>
            <Link className="button button-quiet" href="/books/new">
              Add New Book
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-width section">
      <div className="form-shell">
        <span className="eyebrow mono">Step 02 / submit evidence</span>
        <h1>Roast {book.title}.</h1>
        <p className="form-intro">
          Your first roast goes through a quick human review. After that, you can publish immediately—provided you keep the receipts.
        </p>
        <RoastForm bookId={book.id} bookTitle={book.title} />
      </div>
    </main>
  );
}
