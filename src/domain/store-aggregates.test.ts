import { afterEach, describe, expect, it, vi } from "vitest";
import { getDomainStore } from "./repository";
import { createMemoryStore, weightedBadnessScore } from "./store";
import type { BookWork, Profile, Roast } from "./types";

/*
 * These tests pin the ranking rules that moved into SQL for the Postgres store:
 * the Bayesian weighted score, the qualified tiebreak, the receipt ordering,
 * the feed window, and the bounded/batched read methods. Both DomainStore
 * implementations must agree on every number asserted here.
 */
type MemoryStore = ReturnType<typeof createMemoryStore>;

function makeBook(store: MemoryStore, suffix: string): BookWork {
  return store.upsertBook({
    id: `book-${suffix}`,
    slug: `book-${suffix}`,
    title: `Book ${suffix}`,
    authors: [`Author ${suffix}`],
    firstPublished: 2020,
    description: "",
    coverTone: "acid",
    sourceId: `source-${suffix}`,
  });
}

function makeReviewer(store: MemoryStore, handle: string): Profile {
  const result = store.createProfile({ handle, displayName: handle, bio: "" });
  if (!result.ok) throw new Error(result.message);
  return result.data;
}

function publishRoast(
  store: MemoryStore,
  input: { authorId: string; bookId: string; rating: number; flawTags?: Roast["flawTags"] },
): Roast {
  const created = store.createRoast({
    userId: input.authorId,
    bookId: input.bookId,
    hook: "A premise that forgot to become a story.",
    body: "The book keeps announcing its ideas instead of letting the characters discover them. Every scene arrives with a conclusion already stapled to it.",
    rating: input.rating,
    flawTags: input.flawTags ?? ["PROSE"],
    spoiler: false,
  });
  if (!created.ok) throw new Error(created.message);
  if (created.data.status !== "PUBLISHED") {
    const approved = store.moderateRoast({ roastId: created.data.id, moderatorId: "moderator", decision: "APPROVE" });
    if (!approved.ok) throw new Error(approved.message);
  }
  const published = store.getRoast(created.data.id);
  if (!published) throw new Error("The roast disappeared after publishing.");
  return published;
}

describe("bottom 100 ranking semantics", () => {
  it("applies the Bayesian weighted score with a prior of two votes at 3.0", () => {
    expect(weightedBadnessScore(1, 5)).toBe(3.67);
    expect(weightedBadnessScore(3, 5)).toBe(4.2);
    expect(weightedBadnessScore(3, 4)).toBe(3.6);
    expect(weightedBadnessScore(0, null)).toBe(0);
  });

  it("rounds the average to one decimal and the weighted score to two", () => {
    const store = createMemoryStore({ seed: false });
    const book = makeBook(store, "rounding");
    const reviewers = ["round_a", "round_b", "round_c"].map((handle) => makeReviewer(store, handle));
    [4, 5, 5].forEach((rating, index) => {
      publishRoast(store, { authorId: reviewers[index].id, bookId: book.id, rating });
    });

    const [entry] = store.listBottom100("badness");
    expect(entry.summary.average).toBe(4.7);
    expect(entry.summary.count).toBe(3);
    expect(entry.summary.worstCount).toBe(2);
    expect(entry.weightedScore).toBe(4.02);
  });

  it("ranks books with three or more roasts ahead of a higher-scoring unqualified book", () => {
    const store = createMemoryStore({ seed: false });
    const qualified = makeBook(store, "qualified");
    const unqualified = makeBook(store, "unqualified");

    ["q_a", "q_b", "q_c"].forEach((handle) => {
      publishRoast(store, { authorId: makeReviewer(store, handle).id, bookId: qualified.id, rating: 4 });
    });
    publishRoast(store, { authorId: makeReviewer(store, "u_a").id, bookId: unqualified.id, rating: 5 });

    const ranked = store.listBottom100("badness");
    expect(ranked.map((item) => item.book.id)).toEqual([qualified.id, unqualified.id]);
    expect(ranked[0].weightedScore).toBe(3.6);
    expect(ranked[1].weightedScore).toBe(3.67);
    expect(ranked[0].weightedScore).toBeLessThan(ranked[1].weightedScore);
    expect(ranked[0].rank).toBe(1);
  });

  it("orders receipts by 2*fair + funny and caps them at five", () => {
    const store = createMemoryStore({ seed: false });
    const book = makeBook(store, "receipts");
    const authors = ["r1", "r2", "r3", "r4", "r5", "r6"].map((handle) => makeReviewer(store, handle));
    const roasts = authors.map((author) => publishRoast(store, { authorId: author.id, bookId: book.id, rating: 4 }));
    const voters = ["v1", "v2", "v3"].map((handle) => makeReviewer(store, handle));

    /* Give the last roast two FAIR votes (score 4) and the first roast one
     * FUNNY vote (score 1) so ranking cannot fall back on insertion order. */
    store.setReaction({ roastId: roasts[5].id, userId: voters[0].id, kind: "FAIR", active: true });
    store.setReaction({ roastId: roasts[5].id, userId: voters[1].id, kind: "FAIR", active: true });
    store.setReaction({ roastId: roasts[0].id, userId: voters[2].id, kind: "FUNNY", active: true });

    const [entry] = store.listBottom100("badness");
    expect(entry.topRoasts).toHaveLength(5);
    expect(entry.topRoasts[0].id).toBe(roasts[5].id);
    expect(entry.topRoasts[1].id).toBe(roasts[0].id);
  });

  it("keeps the shuffle stable for a seeded request and shuffles the same entries", () => {
    const store = createMemoryStore({ seed: true });
    const badness = store.listBottom100("badness");

    const seededA = store.listBottom100("shuffle", { seed: 42 });
    const seededB = store.listBottom100("shuffle", { seed: 42 });
    const seededC = store.listBottom100("shuffle", { seed: 7 });

    expect(seededA.map((item) => item.rank)).toEqual(seededB.map((item) => item.rank));
    expect([...seededA].sort((a, b) => a.rank - b.rank).map((item) => item.book.id))
      .toEqual(badness.map((item) => item.book.id));
    expect(seededC).toHaveLength(badness.length);
  });
});

describe("batched and scoped reads", () => {
  it("returns one summary per requested book id in a single call", () => {
    const store = createMemoryStore({ seed: false });
    const first = makeBook(store, "batch-a");
    const second = makeBook(store, "batch-b");
    const reviewers = ["b_a", "b_b"].map((handle) => makeReviewer(store, handle));
    publishRoast(store, { authorId: reviewers[0].id, bookId: first.id, rating: 5, flawTags: ["ENDING"] });
    publishRoast(store, { authorId: reviewers[1].id, bookId: first.id, rating: 3, flawTags: ["ENDING", "PACING"] });

    const summaries = store.getBookSummaries([first.id, second.id, "book-missing"]);

    expect(Object.keys(summaries).sort()).toEqual([first.id, second.id, "book-missing"].sort());
    expect(summaries[first.id]).toEqual(store.getBookSummary(first.id));
    expect(summaries[first.id].average).toBe(4);
    expect(summaries[first.id].count).toBe(2);
    expect(summaries[first.id].worstCount).toBe(1);
    expect(summaries[first.id].flawCounts.ENDING).toBe(2);
    expect(summaries[first.id].flawCounts.PACING).toBe(1);
    expect(summaries[second.id]).toEqual({ average: null, count: 0, worstCount: 0, flawCounts: expect.any(Object) });
    expect(summaries["book-missing"].count).toBe(0);
  });

  it("lists one author's roasts without scanning every roast", () => {
    const store = createMemoryStore({ seed: false });
    const bookOne = makeBook(store, "author-a");
    const bookTwo = makeBook(store, "author-b");
    const author = makeReviewer(store, "scoped_author");
    const other = makeReviewer(store, "other_author");

    publishRoast(store, { authorId: author.id, bookId: bookOne.id, rating: 4 });
    publishRoast(store, { authorId: other.id, bookId: bookOne.id, rating: 4 });
    const removed = publishRoast(store, { authorId: author.id, bookId: bookTwo.id, rating: 5, flawTags: ["PLOT"] });
    expect(store.moderateRoast({ roastId: removed.id, moderatorId: "moderator", decision: "REMOVE" }).ok).toBe(true);

    const all = store.listRoastsByAuthor(author.id);
    expect(all).toHaveLength(2);
    expect(all.every((roast) => roast.authorId === author.id)).toBe(true);

    const published = store.listRoastsByAuthor(author.id, { status: "PUBLISHED" });
    expect(published).toHaveLength(1);
    expect(published[0].bookId).toBe(bookOne.id);

    expect(store.listRoastsByAuthor(author.id, { limit: 1 })).toHaveLength(1);
    expect(store.listRoastsByAuthor("profile-does-not-exist")).toEqual([]);
  });

  it("bounds listRoasts with status, limit, and offset while keeping the no-argument contract", () => {
    const store = createMemoryStore({ seed: false });
    const book = makeBook(store, "bounded");
    const authors = ["l1", "l2", "l3", "l4"].map((handle) => makeReviewer(store, handle));
    authors.forEach((author) => publishRoast(store, { authorId: author.id, bookId: book.id, rating: 4 }));
    const extraBook = makeBook(store, "bounded-extra");
    /* A brand new reviewer keeps this roast in the moderation queue, because an
     * author with an approved roast is published immediately. */
    const newcomer = makeReviewer(store, "l5");
    const pending = store.createRoast({
      userId: newcomer.id,
      bookId: extraBook.id,
      hook: "A pending verdict waiting on the moderation queue.",
      body: "Held for review so the status filter can prove that it excludes anything that has not been published by a moderator yet.",
      rating: 5,
      flawTags: ["EDITING"],
      spoiler: false,
    });
    expect(pending.ok).toBe(true);

    expect(store.listRoasts()).toHaveLength(5);
    expect(store.listRoasts({ limit: 2 })).toHaveLength(2);
    expect(store.listRoasts({ status: "PUBLISHED" })).toHaveLength(4);
    expect(store.listRoasts({ status: "PENDING_REVIEW" })).toHaveLength(1);

    const firstPage = store.listRoasts({ limit: 2 });
    const secondPage = store.listRoasts({ limit: 2, offset: 2 });
    expect(secondPage.map((roast) => roast.id)).not.toEqual(firstPage.map((roast) => roast.id));
    expect(store.listRoasts({ offset: 5 })).toEqual([]);
  });
});

describe("feed composition and bounds", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the 2:1 following to discovery blend", () => {
    const store = createMemoryStore({ seed: false });
    const books = ["f1", "f2", "f3", "f4", "f5"].map((suffix) => makeBook(store, suffix));
    const followed = makeReviewer(store, "followed_author");
    const stranger = makeReviewer(store, "stranger_author");
    const viewer = makeReviewer(store, "feed_viewer");

    books.slice(0, 3).forEach((book) => publishRoast(store, { authorId: followed.id, bookId: book.id, rating: 4 }));
    books.slice(3).forEach((book) => publishRoast(store, { authorId: stranger.id, bookId: book.id, rating: 4 }));
    expect(store.setFollow({ followerId: viewer.id, followeeId: followed.id, active: true }).ok).toBe(true);

    const feed = store.listFeed(viewer.id);
    expect(feed).toHaveLength(5);
    expect(feed.slice(0, 2).every((roast) => roast.authorId === followed.id)).toBe(true);
    expect(feed[2].authorId).toBe(stranger.id);
    expect(feed[3].authorId).toBe(followed.id);
    expect(feed[4].authorId).toBe(stranger.id);
  });

  it("drops discovery roasts older than the fourteen day window", () => {
    const store = createMemoryStore({ seed: true });
    expect(store.listFeed().length).toBeGreaterThan(0);

    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
    expect(store.listFeed()).toEqual([]);
  });

  it("caps the feed at the requested limit", () => {
    const store = createMemoryStore({ seed: true });
    expect(store.listFeed(undefined, { limit: 2 })).toHaveLength(2);
    expect(store.listFeed(undefined, { limit: 0 }).length).toBeGreaterThan(0);
  });

  it("sorts discovery by 2*fair + funny + 2*bookmark", () => {
    const store = createMemoryStore({ seed: false });
    const books = ["d1", "d2"].map((suffix) => makeBook(store, suffix));
    const author = makeReviewer(store, "discovery_author");
    const quiet = publishRoast(store, { authorId: author.id, bookId: books[0].id, rating: 4 });
    const loud = publishRoast(store, { authorId: author.id, bookId: books[1].id, rating: 4 });
    const voter = makeReviewer(store, "discovery_voter");

    store.setReaction({ roastId: quiet.id, userId: voter.id, kind: "FUNNY", active: true });
    store.setBookmark({ userId: voter.id, roastId: loud.id, active: true });

    const feed = store.listFeed();
    expect(feed[0].id).toBe(loud.id);
    expect(feed[1].id).toBe(quiet.id);
  });
});

describe("async domain store surface", () => {
  it("exposes the batched and scoped reads through getDomainStore", async () => {
    process.env.DEMO_MODE = "true";
    const store = getDomainStore();
    const books = await store.listBooks(2);
    const summaries = await store.getBookSummaries(books.map((book) => book.id));

    expect(Object.keys(summaries)).toHaveLength(books.length);
    for (const book of books) {
      expect(summaries[book.id]).toEqual(await store.getBookSummary(book.id));
    }

    const bounded = await store.listRoasts({ limit: 1 });
    expect(bounded).toHaveLength(1);
    const byAuthor = await store.listRoastsByAuthor(bounded[0].authorId);
    expect(byAuthor.every((roast) => roast.authorId === bounded[0].authorId)).toBe(true);
  });
});
