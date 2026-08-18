import { describe, expect, it, vi } from "vitest";
import { OpenLibraryProvider } from "./open-library";

describe("OpenLibraryProvider", () => {
  it("normalizes work search results and preserves stable source IDs", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          numFound: 1,
          docs: [{
            key: "/works/OL123W",
            title: "A Difficult Book",
            author_name: ["A. Reader"],
            first_publish_year: 2022,
            cover_i: 987,
            isbn: ["978-1-2345-6789-0", "9781234567890"],
          }],
        }),
      ),
    );
    const provider = new OpenLibraryProvider({ fetcher: fetcher as typeof fetch, contactEmail: "hello@example.com" });

    const result = await provider.search("difficult book");

    expect(result).toEqual({
      total: 1,
      results: [{
        provider: "openlibrary",
        providerWorkId: "OL123W",
        title: "A Difficult Book",
        authors: ["A. Reader"],
        firstPublished: 2022,
        coverUrl: "https://covers.openlibrary.org/b/id/987-M.jpg",
        identifiers: [{ scheme: "ISBN", value: "9781234567890" }],
      }],
      nextCursor: null,
    });
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("https://openlibrary.org/search.json"),
      expect.objectContaining({ headers: expect.objectContaining({ "User-Agent": expect.stringContaining("hello@example.com") }) }),
    );
  });

  it("returns an upstream error instead of rendering untrusted malformed data", async () => {
    const provider = new OpenLibraryProvider({ fetcher: vi.fn().mockResolvedValue(new Response("not-json", { status: 502 })) as typeof fetch });

    await expect(provider.search("broken")).rejects.toThrow("Catalog search is temporarily unavailable.");
  });

  it("deduplicates repeated provider works", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      numFound: 2,
      docs: [
        { key: "/works/OL123W", title: "A Difficult Book" },
        { key: "/works/OL123W", title: "A Difficult Book" },
      ],
    })));
    const provider = new OpenLibraryProvider({ fetcher: fetcher as typeof fetch });
    const result = await provider.search("difficult book");
    expect(result.results).toHaveLength(1);
  });
});
