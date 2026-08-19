import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/src/db";
import * as schema from "@/src/db/schema";
import { calculateBadnessSummary, FLAW_TAGS, type FlawTag } from "./core";
import { createPostgresDomainStore } from "./repository";
import { DISCOVERY_WINDOW_MS, feedEngagementScore, roundAverage, weightedBadnessScore } from "./store";
import type { BookSummary, Roast } from "./types";

/*
 * These tests run only against a configured PostgreSQL database. They compare
 * the SQL aggregates against the original JavaScript algorithm computed from
 * the raw rows, which is what proves the ranking semantics survived the move
 * into the query planner.
 */
const hasLocalDb = Boolean(process.env.DATABASE_URL && process.env.DEMO_MODE === "false" && db);

type PublishedRow = {
  id: string;
  bookWorkId: string;
  authorProfileId: string;
  handle: string;
  rating: number;
  flawTags: string[];
  fairCount: number;
  funnyCount: number;
  bookmarkCount: number;
  createdAt: Date;
};

async function loadPublishedRows(): Promise<PublishedRow[]> {
  if (!db) throw new Error("A database connection is required for this test.");
  return db
    .select({
      id: schema.roasts.id,
      bookWorkId: schema.roasts.bookWorkId,
      authorProfileId: schema.roasts.authorProfileId,
      handle: schema.profiles.handle,
      rating: schema.roasts.rating,
      flawTags: schema.roasts.flawTags,
      fairCount: schema.roasts.fairCount,
      funnyCount: schema.roasts.funnyCount,
      bookmarkCount: schema.roasts.bookmarkCount,
      createdAt: schema.roasts.createdAt,
    })
    .from(schema.roasts)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.roasts.authorProfileId))
    .where(eq(schema.roasts.status, "PUBLISHED"));
}

function naiveSummary(rows: PublishedRow[]): BookSummary {
  return calculateBadnessSummary(
    rows.map((row) => ({ rating: row.rating as Roast["rating"], flawTags: (row.flawTags as FlawTag[]) ?? [] })),
  );
}

function groupByBook(rows: PublishedRow[]) {
  const grouped = new Map<string, PublishedRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.bookWorkId) ?? [];
    list.push(row);
    grouped.set(row.bookWorkId, list);
  }
  return grouped;
}

describe.skipIf(!hasLocalDb)("postgres domain store aggregates", () => {
  function store() {
    if (!db) throw new Error("A database connection is required for this test.");
    return createPostgresDomainStore(db);
  }

  it("matches the JavaScript badness summary for a batch of books", async () => {
    const rows = await loadPublishedRows();
    const grouped = groupByBook(rows);
    const bookIds = [...grouped.keys()].slice(0, 25);
    expect(bookIds.length).toBeGreaterThan(0);

    const summaries = await store().getBookSummaries([...bookIds, "not-a-uuid"]);

    expect(Object.keys(summaries)).toHaveLength(bookIds.length + 1);
    expect(summaries["not-a-uuid"].count).toBe(0);
    for (const bookId of bookIds) {
      expect(summaries[bookId]).toEqual(naiveSummary(grouped.get(bookId) ?? []));
    }
  }, 30_000);

  it("returns the same single summary through getBookSummary", async () => {
    const rows = await loadPublishedRows();
    const grouped = groupByBook(rows);
    const [bookId] = [...grouped.keys()];
    const summary = await store().getBookSummary(bookId);
    expect(summary).toEqual(naiveSummary(grouped.get(bookId) ?? []));
    /* Flaw tallies come from count(*) filter (...), so at least one tag must be
     * non-zero for the histogram to be considered exercised. */
    expect(FLAW_TAGS.some((tag) => summary.flawCounts[tag] > 0)).toBe(true);
  }, 30_000);

  it("preserves the weighted score, qualified tiebreak, and receipt ordering", async () => {
    const rows = await loadPublishedRows();
    const grouped = groupByBook(rows);
    const naive = [...grouped.entries()]
      .map(([bookId, bookRows]) => {
        const count = bookRows.length;
        const average = roundAverage(bookRows.reduce((acc, row) => acc + row.rating, 0), count);
        return { bookId, count, average, weightedScore: weightedBadnessScore(count, average) };
      })
      .sort((a, b) => {
        const aQualified = a.count >= 3 ? 1 : 0;
        const bQualified = b.count >= 3 ? 1 : 0;
        if (aQualified !== bQualified) return bQualified - aQualified;
        return b.weightedScore - a.weightedScore || b.count - a.count;
      })
      .slice(0, 100);

    const items = await store().listBottom100("badness");

    expect(items.length).toBe(naive.length);
    expect(items.map((item) => item.rank)).toEqual(naive.map((_, index) => index + 1));
    /* Ties make individual positions ambiguous, so compare the score profile
     * of the selected page rather than the exact book order. */
    expect(items.map((item) => item.weightedScore).sort()).toEqual(naive.map((entry) => entry.weightedScore).sort());
    expect(items.map((item) => item.summary.count).sort()).toEqual(naive.map((entry) => entry.count).sort());

    for (const item of items) {
      const bookRows = grouped.get(item.book.id) ?? [];
      const expectedCount = bookRows.length;
      const expectedAverage = roundAverage(bookRows.reduce((acc, row) => acc + row.rating, 0), expectedCount);
      expect(item.summary.count).toBe(expectedCount);
      expect(item.summary.average).toBe(expectedAverage);
      expect(item.summary.worstCount).toBe(bookRows.filter((row) => row.rating === 5).length);
      expect(item.weightedScore).toBe(weightedBadnessScore(expectedCount, expectedAverage));
      expect(item.topRoasts.length).toBe(Math.min(5, expectedCount));
      expect(item.topRoasts.every((roast) => roast.bookId === item.book.id)).toBe(true);
      for (let index = 0; index < item.topRoasts.length - 1; index += 1) {
        const current = item.topRoasts[index];
        const next = item.topRoasts[index + 1];
        const currentScore = 2 * current.fairCount + current.funnyCount;
        const nextScore = 2 * next.fairCount + next.funnyCount;
        expect(currentScore >= nextScore).toBe(true);
        if (currentScore === nextScore) expect(current.rating >= next.rating).toBe(true);
      }
    }

    const qualifiedFlags = items.map((item) => (item.summary.count >= 3 ? 1 : 0));
    expect([...qualifiedFlags].sort((a, b) => b - a)).toEqual(qualifiedFlags);
  }, 60_000);

  it("keeps the alternate Bottom 100 sorts and the seeded shuffle", async () => {
    const domainStore = store();
    const [badness, byTitle, byRoasts, shuffledA, shuffledB] = await Promise.all([
      domainStore.listBottom100("badness"),
      domainStore.listBottom100("title"),
      domainStore.listBottom100("roasts"),
      domainStore.listBottom100("shuffle", { seed: 99 }),
      domainStore.listBottom100("shuffle", { seed: 99 }),
    ]);

    expect(byTitle).toHaveLength(badness.length);
    for (let index = 0; index < byTitle.length - 1; index += 1) {
      expect(byTitle[index].book.title.localeCompare(byTitle[index + 1].book.title)).toBeLessThanOrEqual(0);
    }
    for (let index = 0; index < byRoasts.length - 1; index += 1) {
      expect(byRoasts[index].summary.count).toBeGreaterThanOrEqual(byRoasts[index + 1].summary.count);
    }
    expect(shuffledA.map((item) => item.rank)).toEqual(shuffledB.map((item) => item.rank));
  }, 60_000);

  it("matches the JavaScript leaderboard aggregation", async () => {
    const rows = await loadPublishedRows();
    const roasters = new Map<string, { handle: string; roastCount: number; fairCount: number; funnyCount: number }>();
    for (const row of rows) {
      const current = roasters.get(row.authorProfileId) ?? { handle: row.handle, roastCount: 0, fairCount: 0, funnyCount: 0 };
      current.roastCount += 1;
      current.fairCount += row.fairCount;
      current.funnyCount += row.funnyCount;
      roasters.set(row.authorProfileId, current);
    }
    const naive = [...roasters.values()]
      .map((entry) => ({ ...entry, totalReactions: entry.fairCount + entry.funnyCount }))
      .sort((a, b) => b.totalReactions - a.totalReactions || b.roastCount - a.roastCount || a.handle.localeCompare(b.handle))
      .slice(0, 25);

    const leaderboard = await store().listTopRoasters(25);

    expect(leaderboard).toHaveLength(naive.length);
    expect(leaderboard.map((entry) => entry.totalReactions)).toEqual(naive.map((entry) => entry.totalReactions));
    expect(leaderboard.map((entry) => entry.roastCount).sort()).toEqual(naive.map((entry) => entry.roastCount).sort());
    for (const entry of leaderboard) {
      expect(entry.totalReactions).toBe(entry.fairCount + entry.funnyCount);
    }
  }, 30_000);

  it("bounds listRoasts and scopes listRoastsByAuthor", async () => {
    const domainStore = store();
    const page = await domainStore.listRoasts({ limit: 5 });
    expect(page).toHaveLength(5);
    for (let index = 0; index < page.length - 1; index += 1) {
      expect(page[index].createdAt >= page[index + 1].createdAt).toBe(true);
    }

    const secondPage = await domainStore.listRoasts({ limit: 5, offset: 5 });
    expect(secondPage.map((roast) => roast.id)).not.toEqual(page.map((roast) => roast.id));

    const published = await domainStore.listRoasts({ status: "PUBLISHED", limit: 10 });
    expect(published.every((roast) => roast.status === "PUBLISHED")).toBe(true);

    const authorRoasts = await domainStore.listRoastsByAuthor(page[0].authorId);
    expect(authorRoasts.length).toBeGreaterThan(0);
    expect(authorRoasts.every((roast) => roast.authorId === page[0].authorId)).toBe(true);
    expect(await domainStore.listRoastsByAuthor("not-a-uuid")).toEqual([]);

    const authorPublished = await domainStore.listRoastsByAuthor(page[0].authorId, { status: "PUBLISHED", limit: 2 });
    expect(authorPublished.length).toBeLessThanOrEqual(2);
    expect(authorPublished.every((roast) => roast.status === "PUBLISHED")).toBe(true);
  }, 30_000);

  it("returns a bounded feed inside the discovery window ordered by engagement", async () => {
    const feed = await store().listFeed(undefined, { limit: 10 });
    expect(feed.length).toBeLessThanOrEqual(10);
    const now = Date.now();
    for (const roast of feed) {
      expect(roast.status).toBe("PUBLISHED");
      expect(now - new Date(roast.createdAt).getTime()).toBeLessThanOrEqual(DISCOVERY_WINDOW_MS);
    }
    for (let index = 0; index < feed.length - 1; index += 1) {
      expect(feedEngagementScore(feed[index])).toBeGreaterThanOrEqual(feedEngagementScore(feed[index + 1]));
    }
  }, 30_000);
});
