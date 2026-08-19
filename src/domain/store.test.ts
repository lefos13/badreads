import { describe, expect, it } from "vitest";
import { createMemoryStore } from "./store";
import type { Roast } from "./types";

/*
 * These fixtures use normal store operations so ranking tests cover profile,
 * roast, reaction, and moderation state transitions together.
 */
type MemoryStore = ReturnType<typeof createMemoryStore>;

function createProfile(store: MemoryStore, handle: string) {
  const result = store.createProfile({ handle, displayName: handle, bio: "" });
  if (!result.ok) throw new Error(result.message);
  return result.data;
}

function createBook(store: MemoryStore, suffix: string) {
  const template = store.listBooks()[0];
  return store.upsertBook({
    ...template,
    id: `book-${suffix}`,
    slug: `book-${suffix}`,
    title: `Book ${suffix}`,
    sourceId: `source-${suffix}`,
  });
}

function createRoast(store: MemoryStore, authorId: string, bookId: string): Roast {
  const result = store.createRoast({
    userId: authorId,
    bookId,
    hook: "A premise that forgot to become a story.",
    body: "The book keeps announcing its ideas instead of letting the characters discover them. Every scene arrives with a conclusion already stapled to it.",
    rating: 4,
    flawTags: ["PROSE"],
    spoiler: false,
  });
  if (!result.ok) throw new Error(result.message);
  return result.data;
}

function createPublishedRoast(store: MemoryStore, authorId: string, bookId: string): Roast {
  const roast = createRoast(store, authorId, bookId);
  if (roast.status === "PENDING_REVIEW") {
    const moderation = store.moderateRoast({ roastId: roast.id, moderatorId: authorId, decision: "APPROVE" });
    if (!moderation.ok) throw new Error(moderation.message);
  }
  const published = store.getRoast(roast.id);
  if (!published) throw new Error("The roast was not found after publishing.");
  return published;
}

describe("memory product store", () => {
  it("holds a first roast for moderation until the reviewer is approved", () => {
    const store = createMemoryStore({ seed: false });
    const profileResult = store.createProfile({ handle: "new-reader", displayName: "New Reader", bio: "" });
    expect(profileResult.ok).toBe(true);
    if (!profileResult.ok) return;
    const profile = profileResult.data;
    const book = store.listBooks()[0];

    const submitted = store.createRoast({
      userId: profile.id,
      bookId: book.id,
      hook: "A premise that forgot to become a story.",
      body: "The book keeps announcing its ideas instead of letting the characters discover them. Every scene arrives with a conclusion already stapled to it.",
      rating: 4,
      flawTags: ["PROSE"],
      spoiler: false,
    });

    expect(submitted.ok).toBe(true);
    if (submitted.ok) expect(submitted.data.status).toBe("PENDING_REVIEW");
  });

  it("prevents a user from creating a second score-bearing roast for one book", () => {
    const store = createMemoryStore({ seed: false });
    const profileResult = store.createProfile({ handle: "single-verdict", displayName: "Single Verdict", bio: "" });
    expect(profileResult.ok).toBe(true);
    if (!profileResult.ok) return;
    const profile = profileResult.data;
    const book = store.listBooks()[0];
    const input = {
      userId: profile.id,
      bookId: book.id,
      hook: "A premise that forgot to become a story.",
      body: "The book keeps announcing its ideas instead of letting the characters discover them. Every scene arrives with a conclusion already stapled to it.",
      rating: 4 as const,
      flawTags: ["PROSE" as const],
      spoiler: false,
    };

    expect(store.createRoast(input).ok).toBe(true);
    expect(store.createRoast(input)).toEqual({ ok: false, code: "CONFLICT", message: "You already roasted this book." });
  });

  it("makes reactions idempotent and removes a roast after three reports", () => {
    const store = createMemoryStore({ seed: true });
    const roast = store.listRoasts()[0];
    const reporters = ["reporter-1", "reporter-2", "reporter-3"].map((handle) => {
      const result = store.createProfile({ handle, displayName: handle, bio: "" });
      if (!result.ok) throw new Error(result.message);
      return result.data.id;
    });

    expect(store.setReaction({ roastId: roast.id, userId: reporters[0], kind: "FAIR", active: true }).ok).toBe(true);
    expect(store.setReaction({ roastId: roast.id, userId: reporters[0], kind: "FAIR", active: true }).ok).toBe(true);
    expect(store.getRoast(roast.id)?.fairCount).toBe(roast.fairCount + 1);

    reporters.forEach((reporterId) => {
      store.reportRoast({ roastId: roast.id, reporterId, category: "PERSONAL_ATTACK" });
    });

    expect(store.getRoast(roast.id)?.status).toBe("REMOVED");
  });

  it("rejects stale roast edits with an optimistic concurrency check", () => {
    const store = createMemoryStore({ seed: false });
    const profileResult = store.createProfile({ handle: "stale-editor", displayName: "Stale Editor", bio: "" });
    expect(profileResult.ok).toBe(true);
    if (!profileResult.ok) return;
    const book = store.listBooks()[0];
    const submitted = store.createRoast({
      userId: profileResult.data.id,
      bookId: book.id,
      hook: "A premise that forgot to become a story.",
      body: "The book keeps announcing its ideas instead of letting the characters discover them. Every scene arrives with a conclusion already stapled to it.",
      rating: 4,
      flawTags: ["PROSE"],
      spoiler: false,
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;

    const update = store.updateRoast({
      roastId: submitted.data.id,
      expectedUpdatedAt: "not-the-current-version",
      userId: profileResult.data.id,
      bookId: book.id,
      hook: "A premise that forgot to become a story.",
      body: "The book keeps announcing its ideas instead of letting the characters discover them. Every scene arrives with a conclusion already stapled to it.",
      rating: 5,
      flawTags: ["PROSE"],
      spoiler: false,
    });
    expect(update).toMatchObject({ ok: false, code: "CONFLICT" });
  });

  it("exports then removes a profile and its public verdicts", () => {
    const store = createMemoryStore({ seed: false });
    const profileResult = store.createProfile({ handle: "leaving-reader", displayName: "Leaving Reader", bio: "" });
    expect(profileResult.ok).toBe(true);
    if (!profileResult.ok) return;
    const book = store.listBooks()[0];
    const roast = store.createRoast({
      userId: profileResult.data.id,
      bookId: book.id,
      hook: "A premise that forgot to become a story.",
      body: "The book keeps announcing its ideas instead of letting the characters discover them. Every scene arrives with a conclusion already stapled to it.",
      rating: 4,
      flawTags: ["PROSE"],
      spoiler: false,
    });
    expect(roast.ok).toBe(true);
    expect(store.exportProfile(profileResult.data.id).ok).toBe(true);
    expect(store.deleteProfile(profileResult.data.id)).toMatchObject({ ok: true });
    expect(store.getProfile(profileResult.data.id)).toBeUndefined();
    expect(store.listRoasts()).toHaveLength(0);
  });

  it("searches books by title, author, slug, and source ID", () => {
    const store = createMemoryStore({ seed: true });
    const alchemistMatches = store.searchBooks("Alchemist");
    expect(alchemistMatches.length).toBeGreaterThan(0);
    expect(alchemistMatches[0].title).toBe("The Alchemist");

    const authorMatches = store.searchBooks("Paulo");
    expect(authorMatches.length).toBeGreaterThan(0);
    expect(authorMatches[0].authors).toContain("Paulo Coelho");

    const emptyMatches = store.searchBooks("nonexistent-query-xyz");
    expect(emptyMatches).toHaveLength(0);

    const blankMatches = store.searchBooks("   ");
    expect(blankMatches).toHaveLength(0);
  });

  it("queries user reaction states, follow status, and bookmarked roasts", () => {
    const store = createMemoryStore({ seed: true });
    const roasts = store.listRoasts();
    const roast1 = roasts[0];
    const roast2 = roasts[1];
    const profile = store.createProfile({ handle: "active-reader", displayName: "Active", bio: "" });
    expect(profile.ok).toBe(true);
    if (!profile.ok) return;

    // Reactions and bookmarks
    store.setReaction({ roastId: roast1.id, userId: profile.data.id, kind: "FAIR", active: true });
    store.setBookmark({ userId: profile.data.id, roastId: roast1.id, active: true });

    const states = store.getUserReactionStates(profile.data.id, [roast1.id, roast2.id]);
    expect(states[roast1.id]).toEqual({ fair: true, funny: false, bookmarked: true });
    expect(states[roast2.id]).toEqual({ fair: false, funny: false, bookmarked: false });

    // Follows
    const authorId = roast1.authorId;
    expect(store.isFollowing(profile.data.id, authorId)).toBe(false);
    store.setFollow({ followerId: profile.data.id, followeeId: authorId, active: true });
    expect(store.isFollowing(profile.data.id, authorId)).toBe(true);
    store.setFollow({ followerId: profile.data.id, followeeId: authorId, active: false });
    expect(store.isFollowing(profile.data.id, authorId)).toBe(false);

    // List bookmarked roasts
    const bookmarked = store.listBookmarkedRoasts(profile.data.id);
    expect(bookmarked.map((r) => r.id)).toContain(roast1.id);
    expect(bookmarked.map((r) => r.id)).not.toContain(roast2.id);
  });

  it("ranks roasters by total reactions", () => {
    const store = createMemoryStore({ seed: false });
    const alice = createProfile(store, "alice");
    const bob = createProfile(store, "bob");
    const carol = createProfile(store, "carol");
    const book = store.listBooks()[0];
    const aliceRoast = createPublishedRoast(store, alice.id, book.id);
    const bobRoast = createPublishedRoast(store, bob.id, book.id);
    const carolRoast = createPublishedRoast(store, carol.id, book.id);

    store.setReaction({ roastId: aliceRoast.id, userId: bob.id, kind: "FAIR", active: true });
    store.setReaction({ roastId: aliceRoast.id, userId: carol.id, kind: "FAIR", active: true });
    store.setReaction({ roastId: aliceRoast.id, userId: bob.id, kind: "FUNNY", active: true });
    store.setReaction({ roastId: bobRoast.id, userId: alice.id, kind: "FAIR", active: true });
    store.setReaction({ roastId: bobRoast.id, userId: carol.id, kind: "FUNNY", active: true });
    store.setReaction({ roastId: carolRoast.id, userId: alice.id, kind: "FAIR", active: true });

    const roasters = store.listTopRoasters();

    expect(roasters.map((roaster) => roaster.profile.handle)).toEqual(["alice", "bob", "carol"]);
    expect(roasters[0]).toMatchObject({ roastCount: 1, fairCount: 2, funnyCount: 1, totalReactions: 3 });
  });

  it("counts only published roasts", () => {
    const store = createMemoryStore({ seed: false });
    const published = createProfile(store, "published");
    const pending = createProfile(store, "pending");
    const rejected = createProfile(store, "rejected");
    const removed = createProfile(store, "removed");
    const book = store.listBooks()[0];

    createPublishedRoast(store, published.id, book.id);
    createRoast(store, pending.id, book.id);
    const rejectedRoast = createRoast(store, rejected.id, book.id);
    const removedRoast = createRoast(store, removed.id, book.id);
    store.moderateRoast({ roastId: rejectedRoast.id, moderatorId: published.id, decision: "REJECT" });
    store.moderateRoast({ roastId: removedRoast.id, moderatorId: published.id, decision: "REMOVE" });

    const roasters = store.listTopRoasters();

    expect(roasters.map((roaster) => roaster.profile.handle)).toEqual(["published"]);
    expect(roasters[0]?.roastCount).toBe(1);
  });

  it("respects the requested leaderboard limit", () => {
    const store = createMemoryStore({ seed: false });
    const book = store.listBooks()[0];
    for (const handle of ["limit-a", "limit-b", "limit-c"]) {
      const profile = createProfile(store, handle);
      createPublishedRoast(store, profile.id, book.id);
    }

    const roasters = store.listTopRoasters(2);

    expect(roasters).toHaveLength(2);
    expect(roasters.map((roaster) => roaster.profile.handle)).toEqual(["limit-a", "limit-b"]);
  });

  it("breaks ties by roast count and then handle", () => {
    const store = createMemoryStore({ seed: false });
    const beta = createProfile(store, "beta");
    const alpha = createProfile(store, "alpha");
    const bravo = createProfile(store, "bravo");
    const charlie = createProfile(store, "charlie");
    const book = store.listBooks()[0];
    const secondBook = createBook(store, "second");
    const betaFirst = createPublishedRoast(store, beta.id, book.id);
    const betaSecond = createPublishedRoast(store, beta.id, secondBook.id);
    const alphaRoast = createPublishedRoast(store, alpha.id, book.id);
    const bravoRoast = createPublishedRoast(store, bravo.id, book.id);
    const charlieRoast = createPublishedRoast(store, charlie.id, book.id);

    store.setReaction({ roastId: betaFirst.id, userId: alpha.id, kind: "FAIR", active: true });
    store.setReaction({ roastId: betaSecond.id, userId: alpha.id, kind: "FAIR", active: true });
    store.setReaction({ roastId: alphaRoast.id, userId: beta.id, kind: "FAIR", active: true });
    store.setReaction({ roastId: alphaRoast.id, userId: beta.id, kind: "FUNNY", active: true });
    store.setReaction({ roastId: bravoRoast.id, userId: beta.id, kind: "FAIR", active: true });
    store.setReaction({ roastId: charlieRoast.id, userId: beta.id, kind: "FAIR", active: true });

    const roasters = store.listTopRoasters();

    expect(roasters.map((roaster) => roaster.profile.handle)).toEqual(["beta", "alpha", "bravo", "charlie"]);
  });

  it("creates, finds, and updates community-added books", () => {
    const store = createMemoryStore({ seed: false });
    const profile = store.createProfile({ handle: "book-curator", displayName: "Curator", bio: "" });
    expect(profile.ok).toBe(true);
    if (!profile.ok) return;

    // Create a community book with a valid ISBN
    const createResult = store.createCommunityBook({
      title: "The Silent Valley",
      authors: ["E. Vance"],
      isbn: "978-0-306-40615-7",
      firstPublished: 2023,
      description: "An overlooked mystery novel.",
      coverTone: "lavender",
      coverUrl: "data:image/png;base64,mockCover",
      createdByUserId: profile.data.id,
    });

    expect(createResult.ok).toBe(true);
    if (!createResult.ok) return;
    const created = createResult.data;
    expect(created.isCommunityAdded).toBe(true);
    expect(created.createdByUserId).toBe(profile.data.id);
    expect(created.isbn).toBe("9780306406157");
    expect(created.sourceId).toBe("community-9780306406157");

    // Find by ISBN
    const found = store.findBookByIsbn("9780306406157");
    expect(found).toBeDefined();
    expect(found?.id).toBe(created.id);

    // Reject duplicate ISBN
    const duplicateResult = store.createCommunityBook({
      title: "Another Book with Same ISBN",
      authors: ["Someone Else"],
      isbn: "0-306-40615-2", // Different format but same work / testing collision
      createdByUserId: profile.data.id,
    });
    // 978-0-306-40615-7 collision check
    const exactDuplicate = store.createCommunityBook({
      title: "Duplicate",
      authors: ["Someone Else"],
      isbn: "9780306406157",
      createdByUserId: profile.data.id,
    });
    expect(exactDuplicate.ok).toBe(false);
    if (!exactDuplicate.ok) expect(exactDuplicate.code).toBe("CONFLICT");

    // Update community book
    const updateResult = store.updateCommunityBook({
      id: created.id,
      title: "The Silent Valley (Revised Edition)",
      authors: ["E. Vance", "Co-Author"],
      description: "An updated synopsis.",
      coverTone: "coral",
      coverUrl: "data:image/png;base64,newCover",
    });

    expect(updateResult.ok).toBe(true);
    if (!updateResult.ok) return;
    expect(updateResult.data.title).toBe("The Silent Valley (Revised Edition)");
    expect(updateResult.data.authors).toEqual(["E. Vance", "Co-Author"]);
    expect(updateResult.data.coverTone).toBe("coral");
    expect(updateResult.data.isbn).toBe("9780306406157"); // immutable

    // Delete community book
    const deleteResult = store.deleteCommunityBook(created.id);
    expect(deleteResult.ok).toBe(true);
    expect(store.getBook(created.id)).toBeUndefined();
    expect(store.findBookByIsbn("9780306406157")).toBeUndefined();

    // Attempting to delete again returns NOT_FOUND
    const notFoundDelete = store.deleteCommunityBook(created.id);
    expect(notFoundDelete.ok).toBe(false);
    if (!notFoundDelete.ok) expect(notFoundDelete.code).toBe("NOT_FOUND");
  });
});
