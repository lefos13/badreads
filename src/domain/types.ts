import type { BadnessRating, FlawTag, ReactionKind } from "./core";

export type BookWork = {
  id: string;
  slug: string;
  title: string;
  authors: string[];
  firstPublished: number;
  description: string;
  coverTone: "coral" | "acid" | "lavender" | "ink";
  sourceId?: string;
};

export type Profile = {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
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

export type ReactionUpdate = {
  roastId: string;
  kind: ReactionKind;
  active: boolean;
};
