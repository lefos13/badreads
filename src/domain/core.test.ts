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
});
