import { describe, expect, it } from "vitest";
import {
  BADNESS_LABELS,
  calculateBadnessSummary,
  composeFeed,
  createCommunityBookSchema,
  isValidIsbn,
  normalizeIsbn,
  updateCommunityBookSchema,
  validateRoastDraft,
} from "./core";

describe("Badreads product rules", () => {
  it("labels five stars as the worst possible rating", () => {
    expect(BADNESS_LABELS[5]).toBe("Catastrophic");
    expect(BADNESS_LABELS[1]).toBe("Barely Bad");
  });

  it("calculates a work summary from score-bearing roasts with flaw tag counts", () => {
    const summary = calculateBadnessSummary([
      { rating: 5, flawTags: ["PROSE", "PACING"] },
      { rating: 3, flawTags: ["PROSE"] },
      { rating: 4, flawTags: ["PLOT"] },
    ]);

    expect(summary.average).toBe(4);
    expect(summary.count).toBe(3);
    expect(summary.worstCount).toBe(1);
    expect(summary.flawCounts.PROSE).toBe(2);
    expect(summary.flawCounts.PACING).toBe(1);
    expect(summary.flawCounts.PLOT).toBe(1);
    expect(summary.flawCounts.CHARACTERS).toBe(0);
  });

  it("requires a hook, evidence, rating, and flaw tag", () => {
    const result = validateRoastDraft({
      hook: "",
      body: "too short",
      rating: 5,
      flawTags: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toEqual(
        expect.arrayContaining(["Add a memorable hook.", "Add at least one flaw tag."]),
      );
    }
  });

  it("blends following posts two-to-one with discovery posts", () => {
    const result = composeFeed({
      following: ["following-1", "following-2", "following-3"],
      discovery: ["discovery-1", "discovery-2"],
    });

    expect(result).toEqual([
      "following-1",
      "following-2",
      "discovery-1",
      "following-3",
      "discovery-2",
    ]);
  });

  it("normalizes and validates ISBN-10 and ISBN-13 codes", () => {
    expect(normalizeIsbn(" 978-0-306-40615-7 ")).toBe("9780306406157");
    expect(normalizeIsbn("0-8044-2957-x")).toBe("080442957X");

    // Valid ISBN-10
    expect(isValidIsbn("0-306-40615-2")).toBe(true);
    expect(isValidIsbn("080442957X")).toBe(true);

    // Invalid ISBN-10
    expect(isValidIsbn("0-306-40615-3")).toBe(false);
    expect(isValidIsbn("080442957Y")).toBe(false);
    expect(isValidIsbn("123456789")).toBe(false);

    // Valid ISBN-13
    expect(isValidIsbn("978-0-306-40615-7")).toBe(true);
    expect(isValidIsbn("9780385504201")).toBe(true);

    // Invalid ISBN-13
    expect(isValidIsbn("978-0-306-40615-8")).toBe(false);
    expect(isValidIsbn("978038550420X")).toBe(false);
    expect(isValidIsbn("97803855042019")).toBe(false);
  });

  it("validates community book creation and update schemas", () => {
    const validCreate = createCommunityBookSchema.safeParse({
      title: "Untracked Masterpiece",
      authors: ["Unknown Author"],
      isbn: "9780385504201",
      firstPublished: 2024,
      description: "A completely custom untracked book.",
      coverTone: "acid",
      coverUrl: "data:image/png;base64,sampledata",
      createdByUserId: "user-123",
    });
    expect(validCreate.success).toBe(true);

    const invalidCreate = createCommunityBookSchema.safeParse({
      title: "",
      authors: [],
      isbn: "invalid-isbn",
      createdByUserId: "",
    });
    expect(invalidCreate.success).toBe(false);

    const validUpdate = updateCommunityBookSchema.safeParse({
      id: "book-123",
      title: "Updated Title",
      authors: ["New Author"],
      coverTone: "coral",
    });
    expect(validUpdate.success).toBe(true);
  });
});
