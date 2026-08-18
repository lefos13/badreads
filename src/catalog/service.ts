import { getDomainStore } from "@/src/domain/repository";
import type { BookWork } from "@/src/domain/types";
import { OpenLibraryProvider, type CatalogResult, type CatalogSearchResult } from "./open-library";

export type EnhancedCatalogResult = CatalogResult & {
  slug?: string;
  localBookId?: string;
};

export type SearchCatalogResult = Omit<CatalogSearchResult, "results"> & {
  results: EnhancedCatalogResult[];
};

function mapBookToCatalogResult(book: BookWork): EnhancedCatalogResult {
  return {
    provider: "openlibrary" as const,
    providerWorkId: book.sourceId ?? book.id,
    title: book.title,
    authors: book.authors,
    firstPublished: book.firstPublished,
    coverUrl: book.sourceId && book.sourceId.startsWith("OL")
      ? `https://covers.openlibrary.org/b/olid/${book.sourceId}-M.jpg`
      : null,
    identifiers: [],
    slug: book.slug,
    localBookId: book.id,
  };
}

export async function searchCatalog(
  query: string,
  cursor = "0",
): Promise<SearchCatalogResult> {
  const store = getDomainStore();
  const localBooks = await store.searchBooks(query, 20);
  const localResults = localBooks.map(mapBookToCatalogResult);

  if (process.env.OPEN_LIBRARY_LIVE === "true") {
    try {
      const provider = new OpenLibraryProvider({
        contactEmail: process.env.OPEN_LIBRARY_CONTACT_EMAIL,
      });
      const upstream = await provider.search(query, cursor);

      const localWorkIds = new Set(
        localResults.map((item) => item.providerWorkId.toLowerCase()),
      );
      const mergedResults: EnhancedCatalogResult[] = [
        ...localResults,
        ...upstream.results.filter(
          (item) => !localWorkIds.has(item.providerWorkId.toLowerCase()),
        ),
      ];

      return {
        total: localResults.length + upstream.total,
        results: mergedResults,
        nextCursor: upstream.nextCursor,
      };
    } catch (error) {
      if (localResults.length > 0) {
        return { total: localResults.length, results: localResults, nextCursor: null };
      }
      throw error;
    }
  }

  return { total: localResults.length, results: localResults, nextCursor: null };
}

export async function resolveCatalogWork(
  providerWorkId: string,
): Promise<EnhancedCatalogResult | null> {
  const store = getDomainStore();
  const books = await store.listBooks();
  const normalizedWorkId = providerWorkId.toLowerCase();
  const local = books.find(
    (book) =>
      (book.sourceId && book.sourceId.toLowerCase() === normalizedWorkId) ||
      book.id.toLowerCase() === normalizedWorkId,
  );
  if (local) return mapBookToCatalogResult(local);

  if (process.env.OPEN_LIBRARY_LIVE !== "true") return null;
  const provider = new OpenLibraryProvider({
    contactEmail: process.env.OPEN_LIBRARY_CONTACT_EMAIL,
  });
  const result = await provider.search(providerWorkId);
  return (
    result.results.find(
      (book) => book.providerWorkId.toLowerCase() === normalizedWorkId,
    ) ?? null
  );
}
