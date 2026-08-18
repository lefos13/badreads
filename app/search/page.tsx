import Link from "next/link";
import { searchCatalog } from "@/src/catalog/service";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  let result = null;
  let upstreamError = false;
  if (query.length >= 2) {
    try {
      result = await searchCatalog(query);
    } catch {
      upstreamError = true;
    }
  }

  return (
    <main className="page-width search-shell">
      <span className="eyebrow mono">Open the file / find the target</span>
      <h1>Find a book to blame.</h1>
      <p className="hero-copy">Search the catalog, pick the work that disappointed you, and give the group chat the evidence.</p>
      <form className="search-form" method="get">
        <label className="sr-only" htmlFor="book-search">Search books</label>
        <input className="text-input" defaultValue={query} id="book-search" name="q" placeholder="Try The Alchemist, Fourth Wing…" type="search" />
        <button className="button button-primary" type="submit">Search</button>
      </form>
      {query && !result && !upstreamError ? <p className="form-error">Search for at least two characters.</p> : null}
      {upstreamError ? <p className="form-error" role="alert">The catalog is taking a break. Try again in a moment.</p> : null}
      {result ? (
        <div aria-live="polite" className="search-results">
          {result.results.length ? result.results.map((book) => {
            const localSlug = "slug" in book ? book.slug : undefined;
            return (
            <Link className="search-result" href={localSlug ? `/books/${localSlug}` : `/catalog/choose?providerWorkId=${encodeURIComponent(book.providerWorkId)}`} key={book.providerWorkId}>
              <span aria-hidden="true" className="search-result-cover" />
              <span>
                <h2>{book.title}</h2>
                <span className="book-meta">{book.authors.join(", ")} · {book.firstPublished ?? "Unknown year"}</span>
              </span>
              <span className="mono search-arrow">→</span>
            </Link>
          );
          }) : <div className="empty-state">No books found. Try a title, author, or a slightly less exact complaint.</div>}
        </div>
      ) : (
        <div className="empty-state search-empty">Search results will land here. The books are not ready.</div>
      )}
    </main>
  );
}
