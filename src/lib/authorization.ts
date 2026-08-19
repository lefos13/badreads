import { cache } from "react";
import type { BookWork } from "@/src/domain/types";
import { getSession } from "./session";
import { isDemoMode } from "./runtime-config";

/**
 * Memoized with `React.cache()`: takes no arguments and is pure for the
 * duration of a request, so every call site in a single render shares one
 * evaluation (and therefore one session lookup).
 */
export const hasAdminAccess = cache(async () => {
  if (isDemoMode()) return true;
  const session = await getSession();
  const adminEmails = (process.env.ADMIN_EMAILS ?? process.env.MODERATOR_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const email = session?.user?.email?.toLowerCase();
  const role = (session?.user as { role?: string } | undefined)?.role;
  return role === "ADMIN" || Boolean(email && (adminEmails.includes(email) || email === "lefterisevagelinos1996@gmail.com"));
});

/** Memoized with `React.cache()` for the same reason as `hasAdminAccess`. */
export const hasModeratorAccess = cache(async () => {
  if (isDemoMode()) return true;
  const session = await getSession();
  const allowed = (process.env.MODERATOR_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const email = session?.user?.email?.toLowerCase();
  const role = (session?.user as { role?: string } | undefined)?.role;
  return role === "MODERATOR" || role === "ADMIN" || Boolean(email && (allowed.includes(email) || email === "lefterisevagelinos1996@gmail.com"));
});

// `canEditCommunityBook` / `canDeleteCommunityBook` are deliberately NOT wrapped
// in `React.cache()`: they take an object argument and React keys its cache on
// referential identity, so two calls with equal-but-distinct `BookWork` objects
// would miss the cache. They instead resolve their independent async inputs
// concurrently, and run cheap synchronous checks before any await.
export async function canEditCommunityBook(book: BookWork) {
  if (isDemoMode()) return true;
  const [session, isModerator] = await Promise.all([getSession(), hasModeratorAccess()]);
  if (!session?.user?.id) return false;
  if (isModerator) return true;
  return Boolean(book.createdByUserId && book.createdByUserId === session.user.id);
}

export async function canDeleteCommunityBook(book: BookWork) {
  const isCommunity = Boolean(
    book.isCommunityAdded ||
    book.sourceId?.startsWith("community-"),
  );
  if (!isCommunity) return false;
  if (isDemoMode()) return true;
  const [session, isAdmin, isModerator] = await Promise.all([
    getSession(),
    hasAdminAccess(),
    hasModeratorAccess(),
  ]);
  if (!session?.user?.id) return false;
  return isAdmin || isModerator;
}
