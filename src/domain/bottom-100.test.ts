import { describe, expect, it } from "vitest";
import { getDomainStore } from "./repository";
import { createMemoryStore } from "./store";

describe("Bottom 100 domain ranking & displacement", () => {
  it("lists bottom 100 books with summaries and top receipts", () => {
    const store = createMemoryStore({ seed: true });
    const items = store.listBottom100("badness");

    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(100);

    const first = items[0];
    expect(first.rank).toBe(1);
    expect(first.book).toBeDefined();
    expect(first.summary.count).toBeGreaterThanOrEqual(1);
    expect(first.summary.average).toBeGreaterThanOrEqual(1);
    expect(first.topRoasts.length).toBeGreaterThan(0);
  });

  it("supports sorting by badness, roasts, and title", () => {
    const store = createMemoryStore({ seed: true });

    const byBadness = store.listBottom100("badness");
    for (let i = 0; i < byBadness.length - 1; i++) {
      expect(byBadness[i].weightedScore).toBeGreaterThanOrEqual(byBadness[i + 1].weightedScore);
    }

    const byTitle = store.listBottom100("title");
    for (let i = 0; i < byTitle.length - 1; i++) {
      expect(byTitle[i].book.title.localeCompare(byTitle[i + 1].book.title)).toBeLessThanOrEqual(0);
    }

    const byRoasts = store.listBottom100("roasts");
    for (let i = 0; i < byRoasts.length - 1; i++) {
      expect(byRoasts[i].summary.count).toBeGreaterThanOrEqual(byRoasts[i + 1].summary.count);
    }
  });

  it("shuffles entries when sort=shuffle", () => {
    const store = createMemoryStore({ seed: true });
    const shuffledA = store.listBottom100("shuffle");
    const byBadness = store.listBottom100("badness");

    expect(shuffledA.length).toBe(byBadness.length);
  });

  it("dynamically displaces books when new catastrophic roasts are added", () => {
    const store = createMemoryStore({ seed: false });

    // Create a new book
    const book = store.upsertBook({
      id: "book-disaster-candidate",
      slug: "disaster-candidate",
      title: "The Ultimate Disaster",
      authors: ["Disaster Author"],
      firstPublished: 2024,
      description: "A disastrous book",
      coverTone: "coral",
    });

    const reviewerA = store.createProfile({ handle: "rev_a", displayName: "A", bio: "" });
    const reviewerB = store.createProfile({ handle: "rev_b", displayName: "B", bio: "" });
    const reviewerC = store.createProfile({ handle: "rev_c", displayName: "C", bio: "" });
    if (!reviewerA.ok || !reviewerB.ok || !reviewerC.ok) return;

    // Before roasts: 0 books in bottom 100
    expect(store.listBottom100("badness")).toHaveLength(0);

    // Add 3 five-star catastrophic roasts
    store.createRoast({
      userId: reviewerA.data.id,
      bookId: book.id,
      hook: "Disaster hook 1: absolutely unreadable manuscript.",
      body: "Evidence that this book is completely broken, poorly edited, and catastrophic across every single chapter of the narrative.",
      rating: 5,
      flawTags: ["PLOT"],
      spoiler: false,
    });
    store.createRoast({
      userId: reviewerB.data.id,
      bookId: book.id,
      hook: "Disaster hook 2: pacing so bad it defies comprehension.",
      body: "More evidence that this book is completely broken, bloated, and unreadable with cardboard dialogue and repetitive scenes.",
      rating: 5,
      flawTags: ["PROSE"],
      spoiler: false,
    });
    store.createRoast({
      userId: reviewerC.data.id,
      bookId: book.id,
      hook: "Disaster hook 3: zero redeeming qualities found.",
      body: "Final evidence that this book deserves the #1 worst rank on the entire site because the ending undoes any remaining logic.",
      rating: 5,
      flawTags: ["ENDING"],
      spoiler: false,
    });

    // Approve the roasts
    const roasts = store.listRoasts().filter((r) => r.bookId === book.id);
    roasts.forEach((r) => store.moderateRoast({ roastId: r.id, moderatorId: "mod", decision: "APPROVE" }));

    const bottomList = store.listBottom100("badness");
    expect(bottomList.length).toBe(1);
    expect(bottomList[0].book.id).toBe(book.id);
    expect(bottomList[0].summary.average).toBe(5.0);
    expect(bottomList[0].summary.count).toBe(3);
  });

  it("is accessible via domain store in async repository", async () => {
    const store = getDomainStore();
    const items = await store.listBottom100("badness");
    expect(items.length).toBeGreaterThan(0);
  });
});
