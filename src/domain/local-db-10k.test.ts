import { describe, expect, it } from "vitest";
import { resolveCatalogWork, searchCatalog } from "@/src/catalog/service";
import { getDomainStore } from "@/src/domain/repository";

const hasLocalDb = Boolean(process.env.DATABASE_URL && process.env.DEMO_MODE === "false");

describe.skipIf(!hasLocalDb)("local PostgreSQL database with 10k catalog", () => {
  it("searches 10k catalog across titles and authors", async () => {
    const store = getDomainStore();
    const duneBooks = await store.searchBooks("Dune", 10);
    expect(duneBooks.length).toBeGreaterThan(0);
    expect(duneBooks.some((b) => b.title.includes("Dune"))).toBe(true);

    const sandersonBooks = await store.searchBooks("Sanderson", 10);
    expect(sandersonBooks.length).toBeGreaterThan(0);
    expect(sandersonBooks.some((b) => b.authors.some((a) => a.includes("Sanderson")))).toBe(true);
  }, 15_000);

  it("retrieves a book by its slug", async () => {
    const store = getDomainStore();
    const book = await store.getBookBySlug("dune-ol46055w");
    expect(book).toBeDefined();
    expect(book?.title).toBe("Dune");
    expect(book?.authors).toContain("Frank Herbert");
    expect(book?.firstPublished).toBe(1965);
  }, 15_000);

  it("resolves catalog search through local catalog service", async () => {
    const result = await searchCatalog("Frank Herbert");
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results.some((b) => b.title.includes("Dune"))).toBe(true);
  }, 15_000);

  it("resolves catalog work by workId", async () => {
    const work = await resolveCatalogWork("OL46055W");
    expect(work).toBeDefined();
    expect(work?.title).toBe("Dune");
  }, 15_000);
});
