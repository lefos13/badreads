/*
 * This small result envelope is the stable seam between the modular monolith
 * and a future Express service. Server actions can keep their UI messages,
 * while extracted handlers reuse the same machine-readable error vocabulary.
 */

export type ActionErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UPSTREAM_UNAVAILABLE";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ActionErrorCode; message: string } };

export type BadnessRating = 1 | 2 | 3 | 4 | 5;
export type RoastStatus = "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "REMOVED";
export type ReactionKind = "FAIR" | "FUNNY";
