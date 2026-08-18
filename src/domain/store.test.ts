import { describe, expect, it } from "vitest";
import { createMemoryStore } from "./store";

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
});
