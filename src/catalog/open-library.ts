/*
 * Open Library is treated as an untrusted, low-volume discovery provider. The
 * adapter translates only the fields Badreads owns and fails closed when the
 * upstream response is missing required work metadata.
 */

import { z } from "zod";

const searchResponseSchema = z.object({
  numFound: z.number().int().nonnegative().optional().default(0),
  docs: z.array(z.record(z.unknown())).default([]),
});

export type CatalogResult = {
  provider: "openlibrary";
  providerWorkId: string;
  title: string;
  authors: string[];
  firstPublished: number | null;
  coverUrl: string | null;
  identifiers: Array<{ scheme: "ISBN"; value: string }>;
};

export type CatalogSearchResult = {
  total: number;
  results: CatalogResult[];
  nextCursor: string | null;
};

type ProviderOptions = {
  fetcher?: typeof fetch;
  contactEmail?: string;
};

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function normalizeWorkId(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/OL\d+W/);
  return match?.[0] ?? null;
}

export class OpenLibraryProvider {
  private readonly fetcher: typeof fetch;
  private readonly contactEmail: string;

  constructor(options: ProviderOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.contactEmail = options.contactEmail ?? "contact@badreads.example";
  }

  async search(query: string, cursor = "0", limit = 10): Promise<CatalogSearchResult> {
    const offset = Number.parseInt(cursor, 10);
    const safeOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;
    const url = new URL("https://openlibrary.org/search.json");
    url.searchParams.set("q", query.trim());
    url.searchParams.set("page", String(Math.floor(safeOffset / limit) + 1));
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("fields", "key,title,author_name,first_publish_year,cover_i,isbn");

    let response: Response;
    try {
      response = await this.fetcher(url.toString(), {
        headers: { "User-Agent": `Badreads/0.1 (${this.contactEmail})` },
        next: { revalidate: 86_400 },
      });
    } catch {
      throw new Error("Catalog search is temporarily unavailable.");
    }
    if (!response.ok) throw new Error("Catalog search is temporarily unavailable.");

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new Error("Catalog search is temporarily unavailable.");
    }

    const parsed = searchResponseSchema.safeParse(json);
    if (!parsed.success) throw new Error("Catalog search is temporarily unavailable.");

    const results = parsed.data.docs.flatMap((doc): CatalogResult[] => {
      const providerWorkId = normalizeWorkId(doc.key);
      const title = typeof doc.title === "string" ? doc.title.trim() : "";
      if (!providerWorkId || !title) return [];
      const coverId = typeof doc.cover_i === "number" ? doc.cover_i : null;
      const identifiers = stringArray(doc.isbn).slice(0, 5).map((value) => ({ scheme: "ISBN" as const, value }));
      return [{
        provider: "openlibrary",
        providerWorkId,
        title,
        authors: stringArray(doc.author_name).slice(0, 5),
        firstPublished: typeof doc.first_publish_year === "number" ? doc.first_publish_year : null,
        coverUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : null,
        identifiers,
      }];
    });

    const nextOffset = safeOffset + results.length;
    return {
      total: parsed.data.numFound,
      results,
      nextCursor: nextOffset < parsed.data.numFound ? String(nextOffset) : null,
    };
  }
}
