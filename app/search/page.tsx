import Image from "next/image";
import Link from "next/link";
import { SearchForm } from "@/components/SearchForm";
import { searchCatalog } from "@/src/catalog/service";
import { getDomainStore } from "@/src/domain/repository";
import { isValidIsbn, normalizeIsbn } from "@/src/domain/core";

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
        // One grouped aggregate query for every local hit instead of one per result.
        summaries = new Map(Object.entries(await store.getBookSummaries(localBookIds)));
      }
    } catch {
      upstreamError = true;
    }
  }

  return (
    <main className="page-width search-shell">
      <span className="eyebrow mono">Open the file / find the target</span>
      <h1>Find a book to blame.</h1>
      <p className="hero-copy">
        Search the catalog, pick the work that disappointed you, and give the group chat the evidence.
      </p>
      <SearchForm initialQuery={query} />
      {query && !result && !upstreamError ? (
        <p className="form-error">Search for at least two characters.</p>
      ) : null}
      {upstreamError ? (
        <p className="form-error" role="alert">
          The catalog is taking a break. Try again in a moment.
        </p>
      ) : null}
      {result ? (
        <div aria-live="polite" className="search-results">
          {result.results.length ? (
            result.results.map((book) => {
              const localSlug = "slug" in book ? book.slug : undefined;
              const summary = book.localBookId ? summaries.get(book.localBookId) : undefined;
              return (
                <Link
                  className="search-result"
                  href={
                    localSlug
                      ? `/books/${localSlug}`
                      : `/catalog/choose?providerWorkId=${encodeURIComponent(book.providerWorkId)}`
                  }
                  key={book.providerWorkId}
                >
                  {book.coverUrl ? (
                    <Image
                      alt=""
                      aria-hidden="true"
                      className="search-result-cover-image"
                      height={80}
                      src={book.coverUrl}
                      width={55}
                    />
                  ) : (
                    <span aria-hidden="true" className="search-result-cover" />
                  )}
                  <span>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <h2>{book.title}</h2>
                      {book.isCommunityAdded ? (
                        <span className="community-badge mono">✳ Community Added</span>
                      ) : null}
                    </div>
                    <span className="book-meta">
                      {book.authors.join(", ")} · {book.firstPublished ?? "Unknown year"}
                    </span>
                    {summary ? (
                      <span className="search-result-stats">
                        {summary.count > 0 ? (
                          <>
                            <span className="badness-stars">
                              {"★".repeat(Math.round(summary.average ?? 0))}
                            </span>
                            <span className="mono">
                              {" "}
                              {summary.average}/5 ({summary.count}{" "}
                              {summary.count === 1 ? "roast" : "roasts"})
                            </span>
                          </>
                        ) : (
                          <span className="mono text-muted">✳ Unroasted / be the first</span>
                        )}
                      </span>
                    ) : null}
                  </span>
                </Link>
              );
            })
          ) : isValidIsbn(query) ? (
            <div className="empty-state search-empty-action">
              <p style={{ fontSize: "1.1rem", fontWeight: 600 }}>
                No books found matching ISBN <span className="mono">{query}</span>.
              </p>
              <p className="hero-copy" style={{ margin: "0.5rem 0 1rem" }}>
                This work is not tracked in our database or Open Library yet. You can add it manually to open the file.
              </p>
              <Link
                href={`/books/new?isbn=${encodeURIComponent(normalizeIsbn(query))}`}
                className="button button-primary"
              >
                ➕ Add this book manually
              </Link>
            </div>
          ) : (
            <div className="empty-state">
              <p>No books found. Try a title, author, or a slightly less exact complaint.</p>
              <p style={{ marginTop: "0.75rem" }}>
                Have the book in hand?{" "}
                <Link href="/books/new" className="mono" style={{ textDecoration: "underline" }}>
                  Add an untracked book manually &rarr;
                </Link>
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="empty-state search-empty">Search results will land here. The books are not ready.</div>
      )}
    </main>
  );
}
