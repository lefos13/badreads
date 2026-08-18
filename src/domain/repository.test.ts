import { afterEach, describe, expect, it } from "vitest";
import { getDomainStore } from "./repository";

/*
 * These tests exercise the runtime seam without opening a database connection.
 * Demo mode must remain deterministic even when local development has a valid
 * DATABASE_URL, because email delivery is intentionally optional at this stage.
 */
describe("domain store runtime selection", () => {
  const originalDemoMode = process.env.DEMO_MODE;

  afterEach(() => {
    if (originalDemoMode === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = originalDemoMode;
  });

  it("keeps the seeded memory experience in demo mode even with Neon configured", async () => {
    process.env.DEMO_MODE = "true";

    const store = getDomainStore();
    const [books, feed] = await Promise.all([store.listBooks(), store.listFeed()]);

    expect(books.some((book) => book.slug === "the-alchemist")).toBe(true);
    expect(feed.length).toBeGreaterThan(0);
  });

  it("exposes async methods while retaining the memory store contract", async () => {
    process.env.DEMO_MODE = "true";

    const store = getDomainStore();
    const book = (await store.listBooks())[0];
    const summary = await store.getBookSummary(book.id);

    expect(summary).toMatchObject({ count: expect.any(Number), worstCount: expect.any(Number) });
  });
});
