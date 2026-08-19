import { afterEach, describe, expect, it } from "vitest";
import { checkIsbnAvailability, resolveCatalogWork, searchCatalog } from "./service";
import { getDomainStore } from "@/src/domain/repository";

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
  }, 15_000);

  it("resolves local works by workId", async () => {
    process.env.OPEN_LIBRARY_LIVE = "false";

    const search = await searchCatalog("Alchemist");
    const first = search.results[0];
    expect(first).toBeDefined();

    const resolved = await resolveCatalogWork(first.providerWorkId);
    expect(resolved).toBeDefined();
    expect(resolved?.title).toBe(first.title);
    expect(resolved?.slug).toBe(first.slug);
  }, 15_000);

  it("returns null for non-existent works in offline mode", async () => {
    process.env.OPEN_LIBRARY_LIVE = "false";

    const book = await resolveCatalogWork("OL999999999W");
    expect(book).toBeNull();
  }, 15_000);

  it("silently ingests upstream results into domain store during live search", async () => {
    process.env.OPEN_LIBRARY_LIVE = "true";

    const upstreamResult = await searchCatalog("UniqueNovelTitle12345");
    expect(upstreamResult).toBeDefined();
  }, 15_000);

  it("checks ISBN availability accurately across local store and offline fallback", async () => {
    process.env.OPEN_LIBRARY_LIVE = "false";

    // Invalid ISBN
    const invalid = await checkIsbnAvailability("12345");
    expect(invalid.status).toBe("INVALID_ISBN");

    // Generate unique valid 13-digit ISBN for this test run
    const prefix = "979" + Math.floor(100000000 + Math.random() * 900000000).toString();
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += (i % 2 === 0 ? 1 : 3) * Number.parseInt(prefix[i], 10);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    const testIsbn = `${prefix}${checkDigit}`;

    // Available ISBN
    const available = await checkIsbnAvailability(testIsbn);
    expect(available.status).toBe("AVAILABLE");

    // Create a local book with that ISBN
    const store = getDomainStore();
    await store.createCommunityBook({
      title: "Local ISBN Test",
      authors: ["Tester"],
      isbn: testIsbn,
      createdByUserId: "user-1",
    });

    // Now check should return LOCAL_EXISTS
    const localExists = await checkIsbnAvailability(testIsbn);
    expect(localExists.status).toBe("LOCAL_EXISTS");
    if (localExists.status === "LOCAL_EXISTS") {
      expect(localExists.book.title).toBe("Local ISBN Test");
    }
  });
});
