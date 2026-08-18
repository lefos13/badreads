import { afterEach, describe, expect, it } from "vitest";
import { resolveCatalogWork, searchCatalog } from "./service";

describe("catalog service local-first search", () => {
  const originalLive = process.env.OPEN_LIBRARY_LIVE;

  afterEach(() => {
    if (originalLive === undefined) delete process.env.OPEN_LIBRARY_LIVE;
    else process.env.OPEN_LIBRARY_LIVE = originalLive;
  });

  it("finds local books without upstream queries in offline mode", async () => {
    process.env.OPEN_LIBRARY_LIVE = "false";

    const result = await searchCatalog("Alchemist");

    expect(result.results.length).toBeGreaterThan(0);
    const alchemist = result.results.find((b) => b.title === "The Alchemist");
    expect(alchemist).toBeDefined();
    expect(alchemist?.slug).toBeDefined();
    expect(alchemist?.providerWorkId).toBeDefined();
  });

  it("resolves local works by workId", async () => {
    process.env.OPEN_LIBRARY_LIVE = "false";

    const search = await searchCatalog("Alchemist");
    const first = search.results[0];
    expect(first).toBeDefined();

    const resolved = await resolveCatalogWork(first.providerWorkId);
    expect(resolved).toBeDefined();
    expect(resolved?.title).toBe(first.title);
    expect(resolved?.slug).toBe(first.slug);
  });

  it("returns null for non-existent works in offline mode", async () => {
    process.env.OPEN_LIBRARY_LIVE = "false";

    const book = await resolveCatalogWork("OL999999999W");
    expect(book).toBeNull();
  });
});
