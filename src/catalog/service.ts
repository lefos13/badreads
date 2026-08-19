import { isValidIsbn, normalizeIsbn } from "@/src/domain/core";
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
  const titleSlug = title.toLowerCase().replace(/[^\p{L}\p{N}0-9]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 70);
  return `${titleSlug || "book"}-${providerWorkId.toLowerCase()}`;
}

export type EnhancedCatalogResult = CatalogResult & {
  slug?: string;
  localBookId?: string;
  isCommunityAdded?: boolean;
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
    identifiers: book.isbn ? [{ scheme: "ISBN", value: book.isbn }] : [],
    slug: book.slug,
    localBookId: book.id,
    isCommunityAdded: book.isCommunityAdded,
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
  const normalizedWorkId = providerWorkId.toLowerCase();
  const local = typeof store.getBookByProviderWorkId === "function"
    ? await store.getBookByProviderWorkId(providerWorkId)
    : (await store.listBooks(50)).find(
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

export type IsbnAvailabilityResult =
  | { status: "INVALID_ISBN"; message: string }
  | { status: "LOCAL_EXISTS"; book: BookWork; isbn: string }
  | { status: "OPEN_LIBRARY_EXISTS"; result: EnhancedCatalogResult; isbn: string }
  | { status: "AVAILABLE"; isbn: string };

export async function checkIsbnAvailability(
  rawIsbn: string,
): Promise<IsbnAvailabilityResult> {
  const cleanIsbn = normalizeIsbn(rawIsbn);
  if (!isValidIsbn(cleanIsbn)) {
    return {
      status: "INVALID_ISBN",
      message: "Please enter a valid 10- or 13-digit ISBN.",
    };
  }

  const store = getDomainStore();
  const localBook = typeof store.findBookByIsbn === "function"
    ? await store.findBookByIsbn(cleanIsbn)
    : (await store.listBooks()).find((b) => b.isbn && normalizeIsbn(b.isbn) === cleanIsbn);
  if (localBook) {
    return {
      status: "LOCAL_EXISTS",
      book: localBook,
      isbn: cleanIsbn,
    };
  }

  if (process.env.OPEN_LIBRARY_LIVE === "true") {
    try {
      const provider = new OpenLibraryProvider({
        contactEmail: process.env.OPEN_LIBRARY_CONTACT_EMAIL,
      });
      const upstream = await provider.search(cleanIsbn, "0", 5);
      if (upstream.results.length > 0) {
        const match = upstream.results[0];
        return {
          status: "OPEN_LIBRARY_EXISTS",
          result: {
            ...match,
            slug: slugify(match.title, match.providerWorkId),
            localBookId: `book-${match.providerWorkId.toLowerCase()}`,
          },
          isbn: cleanIsbn,
        };
      }
    } catch {
      // Upstream outage fallback
    }
  }

  return {
    status: "AVAILABLE",
    isbn: cleanIsbn,
  };
}
