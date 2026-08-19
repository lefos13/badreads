import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "./auth";
import { isDemoMode } from "./runtime-config";
export type AppSessionUser = {
  id: string;
  email: string;
  name: string;
  role?: string;
};

export type AppSession = {
  user: AppSessionUser;
  session?: Record<string, unknown>;
} | null;

/**
 * Resolves the current viewer session.
 *
 * Memoized with `React.cache()` so that every call inside a single server
 * request (layout + page + authorization helpers + server actions) shares one
 * session lookup instead of issuing a database round trip per call site.
 * The cache is per-request only — React allocates a fresh cache scope for every
 * request, so sessions are never shared between viewers. Outside a React cache
 * scope (scripts, tests) `cache()` degrades to a plain pass-through call.
 */
export const getSession = cache(async (): Promise<AppSession> => {
  if (isDemoMode()) {
    return { user: { id: "profile-mara", email: "demo@badreads.local", name: "Mara Reads" } };
  }

  const session = await auth.api.getSession({ headers: await headers() });
  return session as AppSession;
});
