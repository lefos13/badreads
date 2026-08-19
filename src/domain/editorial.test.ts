import { describe, expect, it } from "vitest";
import type { Roast } from "./types";
import { selectWorstOfWeek } from "./editorial";

const author = {
  id: "profile-reader",
  handle: "reader",
  displayName: "Reader",
  bio: "",
};

function makeRoast(overrides: Partial<Roast> = {}): Roast {
  return {
    id: "roast-default",
    bookId: "book-default",
    authorId: author.id,
    author,
    hook: "A premise that forgot to become a story.",
    body: "The book keeps announcing its ideas instead of letting the characters discover them. Every scene arrives with a conclusion already stapled to it.",
    rating: 3,
    flawTags: ["PLOT"],
    spoiler: false,
    createdAt: "2026-08-18T12:00:00.000Z",
    updatedAt: "2026-08-18T12:00:00.000Z",
    fairCount: 1,
    funnyCount: 1,
    bookmarkCount: 0,
    status: "PUBLISHED",
    ...overrides,
  };
}

describe("selectWorstOfWeek", () => {
  const now = new Date("2026-08-19T12:00:00.000Z");

  it("picks the top-scoring roast within the seven-day window", () => {
    const outsideWindow = makeRoast({
      id: "roast-outside-window",
      createdAt: "2026-08-11T12:00:00.000Z",
      fairCount: 100,
      funnyCount: 100,
    });
    const recentTop = makeRoast({
      id: "roast-recent-top",
      createdAt: "2026-08-18T12:00:00.000Z",
      fairCount: 4,
      funnyCount: 4,
    });
    const recentTieBreaker = makeRoast({
      id: "roast-recent-tie-breaker",
      createdAt: "2026-08-19T10:00:00.000Z",
      fairCount: 4,
      funnyCount: 4,
    });

    const result = selectWorstOfWeek([outsideWindow, recentTop, recentTieBreaker], now);

    expect(result).toEqual({ roast: recentTieBreaker, score: 8 });
  });

  it("falls back to the all-time best when no roast is in the window", () => {
    const result = selectWorstOfWeek(
      [
        makeRoast({ id: "roast-lower-score", createdAt: "2026-07-01T12:00:00.000Z", fairCount: 2, funnyCount: 1 }),
        makeRoast({ id: "roast-all-time-best", createdAt: "2026-08-01T12:00:00.000Z", fairCount: 6, funnyCount: 5 }),
      ],
      now,
    );

    expect(result).toEqual({ roast: expect.objectContaining({ id: "roast-all-time-best" }), score: 11 });
  });

  it("ignores roasts that are not published", () => {
    const result = selectWorstOfWeek(
      [
        makeRoast({ id: "roast-pending", fairCount: 100, funnyCount: 100, status: "PENDING_REVIEW" }),
        makeRoast({ id: "roast-published", fairCount: 2, funnyCount: 3 }),
      ],
      now,
    );

    expect(result).toEqual({ roast: expect.objectContaining({ id: "roast-published" }), score: 5 });
  });

  it("returns undefined when the input is empty", () => {
    expect(selectWorstOfWeek([], now)).toBeUndefined();
  });
});
