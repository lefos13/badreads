import Link from "next/link";
import { searchCatalog } from "@/src/catalog/service";
import { getDomainStore } from "@/src/domain/repository";
import { BADNESS_LABELS } from "@/src/domain/core";
export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  let result = null;
  let upstreamError = false;
  const store = getDomainStore();
  let summaries = new Map<string, { average: number | null; count: number; worstCount: number }>();

  if (query.length >= 2) {
    try {
      result = await searchCatalog(query);
      const localBookIds = result.results
        .map((b) => b.localBookId)
        .filter((id): id is string => Boolean(id));
      if (localBookIds.length > 0) {
        const summaryList = await Promise.all(
          localBookIds.map(async (id) => [id, await store.getBookSummary(id)] as const),
        );
        summaries = new Map(summaryList);
      }
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
              {book.coverUrl ? (
                <img
                  alt=""
                  aria-hidden="true"
                  className="search-result-cover-image"
                  loading="lazy"
                  src={book.coverUrl}
                />
              ) : (
                <span aria-hidden="true" className="search-result-cover" />
              )}
              <span>
                <h2>{book.title}</h2>
                <span className="book-meta">{book.authors.join(", ")} · {book.firstPublished ?? "Unknown year"}</span>
                {book.localBookId && summaries.has(book.localBookId) ? (
                  <span className="search-result-stats">
                    {summaries.get(book.localBookId)!.count > 0 ? (
                      <>
                        <span className="badness-stars">
                          {"★".repeat(Math.round(summaries.get(book.localBookId)!.average ?? 0))}
                        </span>
                        <span className="mono"> {summaries.get(book.localBookId)!.average}/5 ({summaries.get(book.localBookId)!.count} {summaries.get(book.localBookId)!.count === 1 ? "roast" : "roasts"})</span>
                      </>
                    ) : (
                      <span className="mono text-muted">✳ Unroasted / be the first</span>
                    )}
                  </span>
                ) : null}
              </span>
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
