import { describe, expect, it } from "vitest";
import { createMemoryStore } from "./store";

describe("memory product store", () => {
  it("holds a first roast for moderation until the reviewer is approved", () => {
    const store = createMemoryStore({ seed: false });
    const profile = store.createProfile({ handle: "new-reader", displayName: "New Reader", bio: "" });
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
    const profile = store.createProfile({ handle: "single-verdict", displayName: "Single Verdict", bio: "" });
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
    const reporters = ["reporter-1", "reporter-2", "reporter-3"];

    expect(store.setReaction({ roastId: roast.id, userId: reporters[0], kind: "FAIR", active: true }).ok).toBe(true);
    expect(store.setReaction({ roastId: roast.id, userId: reporters[0], kind: "FAIR", active: true }).ok).toBe(true);
    expect(store.getRoast(roast.id)?.fairCount).toBe(roast.fairCount + 1);

    reporters.forEach((reporterId) => {
      store.reportRoast({ roastId: roast.id, reporterId, category: "PERSONAL_ATTACK" });
    });

    expect(store.getRoast(roast.id)?.status).toBe("REMOVED");
  });
});
