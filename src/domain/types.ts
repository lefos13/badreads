/*
 * These records are the domain boundary shared by server components, actions,
 * tests, and the future HTTP service. Keeping persistence details out of them
 * lets a Postgres repository replace the local demo store without rewriting UI.
 */

import type { BadnessRating, FlawTag, ReactionKind } from "./core";

export type BookWork = {
  id: string;
  slug: string;
  title: string;
  authors: string[];
  firstPublished: number | null;
  description: string;
  coverTone: "coral" | "acid" | "lavender" | "ink";
  sourceId?: string;
  coverUrl?: string | null;
};

export type Profile = {
  id: string;
  userId?: string;
  handle: string;
  displayName: string;
  bio: string;
  ageConfirmedAt?: string;
};

export type Roast = {
  id: string;
  bookId: string;
  authorId: string;
  author: Profile;
  hook: string;
  body: string;
  rating: BadnessRating;
  flawTags: FlawTag[];
  spoiler: boolean;
  createdAt: string;
  updatedAt: string;
  fairCount: number;
  funnyCount: number;
  bookmarkCount: number;
  status: "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "REMOVED";
  source?: "following" | "discovery";
};

export type ReactionState = {
  fair: boolean;
  funny: boolean;
  bookmarked: boolean;
};

export type BookSummary = {
  average: number | null;
  count: number;
  worstCount: number;
  flawCounts: Record<FlawTag, number>;
};

export type ReactionUpdate = {
  roastId: string;
  kind: ReactionKind;
  active: boolean;
};

export type RoastStatus = "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "REMOVED";

export type ReportCategory = "PERSONAL_ATTACK" | "HATE" | "SPOILER" | "SPAM" | "COPYRIGHT" | "OTHER";

export type Report = {
  id: string;
  roastId: string;
  reporterId: string;
  category: ReportCategory;
  note?: string;
  status: "OPEN" | "UPHELD" | "DISMISSED";
  createdAt: string;
};

export type ReportWithContext = Report & {
  roast?: {
    hook: string;
    body: string;
    rating: BadnessRating;
    spoiler: boolean;
    authorHandle: string;
    bookTitle: string;
    bookSlug?: string;
    status: RoastStatus;
  };
};

export type ModerationAction = {
  id: string;
  roastId: string;
  moderatorId: string;
  decision: "APPROVE" | "REJECT" | "RESTORE" | "REMOVE" | "WARN" | "SUSPEND" | "BAN";
  note?: string;
  createdAt: string;
};

export type Bottom100SortOption = "shuffle" | "badness" | "roasts" | "title";

export type Bottom100Item = {
  rank: number;
  book: BookWork;
  summary: {
    average: number | null;
    count: number;
    worstCount: number;
  };
  weightedScore: number;
  topRoasts: Roast[];
};
