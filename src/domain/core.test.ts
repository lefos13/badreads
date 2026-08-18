import { describe, expect, it } from "vitest";
import {
  BADNESS_LABELS,
  calculateBadnessSummary,
  composeFeed,
  validateRoastDraft,
} from "./core";

describe("Badreads product rules", () => {
  it("labels five stars as the worst possible rating", () => {
    expect(BADNESS_LABELS[5]).toBe("Catastrophic");
    expect(BADNESS_LABELS[1]).toBe("Barely Bad");
  });

  it("calculates a work summary from score-bearing roasts", () => {
    expect(
      calculateBadnessSummary([
        { rating: 5 },
        { rating: 3 },
        { rating: 4 },
      ]),
    ).toEqual({ average: 4, count: 3, worstCount: 1 });
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
});
