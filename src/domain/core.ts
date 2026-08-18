/*
 * These pure rules keep Badreads' inverted rating and feed behavior independent
 * from Next.js, the database, and external catalog providers. That makes the
 * product contract easy to test and safe to reuse if an API service is added.
 */

import { z } from "zod";

export const BADNESS_LABELS = {
  1: "Barely Bad",
  2: "Disappointing",
  3: "Painful",
  4: "Awful",
  5: "Catastrophic",
} as const;

export type BadnessRating = keyof typeof BADNESS_LABELS;
export type ReactionKind = "FAIR" | "FUNNY";

export const FLAW_TAGS = [
  "PACING",
  "PROSE",
  "PLOT",
  "CHARACTERS",
  "ARGUMENTS",
  "WORLD_BUILDING",
  "ENDING",
  "EDITING",
  "OTHER",
] as const;

export type FlawTag = (typeof FLAW_TAGS)[number];

export const profileDraftSchema = z.object({
  handle: z.string().trim().min(3, "Your handle needs at least three characters.").max(24, "Keep your handle under 24 characters.").regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers, or underscores only."),
  displayName: z.string().trim().min(1, "Add a display name.").max(60, "Keep your display name under 60 characters."),
  bio: z.string().trim().max(160, "Keep your bio under 160 characters."),
  ageConfirmed: z.literal(true, { errorMap: () => ({ message: "You must confirm that you are 16 or older." }) }),
});

export type ProfileDraft = z.input<typeof profileDraftSchema>;

export type RoastSummaryInput = { rating: BadnessRating };

export function calculateBadnessSummary(roasts: RoastSummaryInput[]) {
  if (roasts.length === 0) {
    return { average: null, count: 0, worstCount: 0 };
  }

  const total = roasts.reduce((sum, roast) => sum + roast.rating, 0);
  return {
    average: Number((total / roasts.length).toFixed(1)),
    count: roasts.length,
    worstCount: roasts.filter((roast) => roast.rating === 5).length,
  };
}

const roastDraftSchema = z.object({
  hook: z.string().trim().min(10, "Add a memorable hook.").max(140),
  body: z.string().trim().min(80, "Give readers evidence from the book.").max(3000),
  rating: z.number().int().min(1).max(5),
  flawTags: z.array(z.enum(FLAW_TAGS)).min(1, "Add at least one flaw tag.").max(3),
});

export type RoastDraft = z.input<typeof roastDraftSchema>;

export function validateRoastDraft(input: RoastDraft) {
  const parsed = roastDraftSchema.safeParse(input);
  if (parsed.success) return { success: true as const, data: parsed.data };

  return {
    success: false as const,
    errors: parsed.error.issues.map((issue) => issue.message),
  };
}

export function composeFeed<T>({ following, discovery }: { following: T[]; discovery: T[] }) {
  const result: T[] = [];
  let followingIndex = 0;
  let discoveryIndex = 0;

  while (followingIndex < following.length || discoveryIndex < discovery.length) {
    for (let slot = 0; slot < 2 && followingIndex < following.length; slot += 1) {
      result.push(following[followingIndex]);
      followingIndex += 1;
    }

    if (discoveryIndex < discovery.length) {
      result.push(discovery[discoveryIndex]);
      discoveryIndex += 1;
    }

    if (followingIndex >= following.length) {
      while (discoveryIndex < discovery.length) {
        result.push(discovery[discoveryIndex]);
        discoveryIndex += 1;
      }
    }

    if (discoveryIndex >= discovery.length) {
      while (followingIndex < following.length) {
        result.push(following[followingIndex]);
        followingIndex += 1;
      }
    }
  }

  return result;
}
