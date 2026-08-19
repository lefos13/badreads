import { getDomainStore } from "@/src/domain/repository";
import type { BookWork } from "@/src/domain/types";
import { OpenLibraryProvider, type CatalogResult, type CatalogSearchResult } from "./open-library";
const COVER_TONES = ["coral", "acid", "lavender", "ink"] as const;

function determineCoverTone(providerWorkId: string): (typeof COVER_TONES)[number] {
  let hash = 0;
  for (let i = 0; i < providerWorkId.length; i++) {
    hash = (hash * 31 + providerWorkId.charCodeAt(i)) >>> 0;
  }
  return COVER_TONES[hash % COVER_TONES.length];
}

function slugify(title: string, providerWorkId: string) {
  const titleSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
  return `${titleSlug || "book"}-${providerWorkId.toLowerCase()}`;
}

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
    coverUrl: book.coverUrl ?? null,
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

      const newUpstreamItems = upstream.results.filter(
        (item) => !localWorkIds.has(item.providerWorkId.toLowerCase()),
      );

      const enhancedUpstreamResults: EnhancedCatalogResult[] = newUpstreamItems.map((item) => ({
        ...item,
        slug: slugify(item.title, item.providerWorkId),
        localBookId: `book-${item.providerWorkId.toLowerCase()}`,
      }));

      // Silent background ingestion of upstream search results into domain store
      if (enhancedUpstreamResults.length > 0) {
        void Promise.allSettled(
          enhancedUpstreamResults.map((item) =>
            store.upsertBook({
              id: item.localBookId ?? `book-${item.providerWorkId.toLowerCase()}`,
              slug: item.slug ?? slugify(item.title, item.providerWorkId),
              title: item.title,
              authors: item.authors.length ? item.authors : ["Unknown author"],
              firstPublished: item.firstPublished,
              description: "Catalog record imported from Open Library. Add the first evidence-backed verdict.",
              coverTone: determineCoverTone(item.providerWorkId),
              sourceId: item.providerWorkId,
              coverUrl: item.coverUrl ?? undefined,
            }),
          ),
        ).catch(() => {
          // Non-blocking background task; swallow error
        });
      }

      const mergedResults: EnhancedCatalogResult[] = [
        ...localResults,
        ...enhancedUpstreamResults,
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
