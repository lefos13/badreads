import { demoBooks, searchDemoBooks } from "@/src/data/demo";
import { OpenLibraryProvider, type CatalogSearchResult } from "./open-library";

function demoCatalogResult(book: (typeof demoBooks)[number]) {
  return {
    provider: "openlibrary" as const,
    providerWorkId: book.sourceId ?? book.id,
    title: book.title,
    authors: book.authors,
    firstPublished: book.firstPublished,
    coverUrl: null,
    identifiers: [],
    slug: book.slug,
    localBookId: book.id,
  };
}

export async function searchCatalog(query: string, cursor = "0"): Promise<CatalogSearchResult & { results: Array<CatalogSearchResult["results"][number] & { slug?: string; localBookId?: string }> }> {
  if (process.env.OPEN_LIBRARY_LIVE === "true") {
    const provider = new OpenLibraryProvider({ contactEmail: process.env.OPEN_LIBRARY_CONTACT_EMAIL });
    return provider.search(query, cursor);
  }

  const results = searchDemoBooks(query).map(demoCatalogResult);
  return { total: results.length, results, nextCursor: null };
}

export async function resolveCatalogWork(providerWorkId: string) {
  const local = demoBooks.find((book) => book.sourceId === providerWorkId);
  if (local) return demoCatalogResult(local);
  if (process.env.OPEN_LIBRARY_LIVE !== "true") return null;
  const provider = new OpenLibraryProvider({ contactEmail: process.env.OPEN_LIBRARY_CONTACT_EMAIL });
  const result = await provider.search(providerWorkId);
  return result.results.find((book) => book.providerWorkId === providerWorkId) ?? null;
}
