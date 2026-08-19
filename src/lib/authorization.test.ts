import { describe, expect, it, vi, afterAll, beforeEach } from "vitest";
import { canDeleteCommunityBook, canEditCommunityBook, hasAdminAccess, hasModeratorAccess } from "./authorization";
import type { BookWork } from "../domain/types";

// Vitest resolves the browser build of React, whose `cache()` is a pass-through
// (`fn => (...args) => fn(...args)`). Only the `react-server` build memoizes, so
// we swap it in here to exercise the real production behaviour of `React.cache`.
// Without a cache dispatcher installed it still behaves as a pass-through, which
// keeps the per-scenario tests below independent of one another.
vi.mock("react", async () => {
  const serverReact = await vi.importActual<Record<string, unknown>>(
    "../../node_modules/react/cjs/react.react-server.development.js",
  );
  return (serverReact.default ?? serverReact) as Record<string, unknown>;
});

vi.mock("./session", () => ({
  getSession: vi.fn(),
}));

vi.mock("./runtime-config", () => ({
  isDemoMode: vi.fn(),
}));
import { getSession, type AppSession } from "./session";
import { isDemoMode } from "./runtime-config";
describe("authorization rules", () => {
  const mockBook: BookWork = {
    id: "book-comm-1",
    slug: "custom-book",
    title: "Custom Book",
    authors: ["Custom Author"],
    firstPublished: 2024,
    description: "Synopsis",
    coverTone: "acid",
    isCommunityAdded: true,
    createdByUserId: "user-creator-1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("grants full access in demo mode", async () => {
    vi.mocked(isDemoMode).mockReturnValue(true);

    expect(await hasAdminAccess()).toBe(true);
    expect(await hasModeratorAccess()).toBe(true);
    expect(await canEditCommunityBook(mockBook)).toBe(true);
    expect(await canDeleteCommunityBook(mockBook)).toBe(true);
  });
  it("allows moderators to edit any community book", async () => {
    vi.mocked(isDemoMode).mockReturnValue(false);
    const modSession: AppSession = {
      user: { id: "user-mod-1", email: "mod@badreads.com", role: "MODERATOR", name: "Mod" },
    };
    vi.mocked(getSession).mockResolvedValue(modSession);
    expect(await canEditCommunityBook(mockBook)).toBe(true);
  });
  it("allows lefterisevagelinos1996@gmail.com as moderator", async () => {
    vi.mocked(isDemoMode).mockReturnValue(false);
    const lefterisSession: AppSession = {
      user: { id: "seed-user-lefteris", email: "lefterisevagelinos1996@gmail.com", role: "ADMIN", name: "Lefteris Evagelinos" },
    };
    vi.mocked(getSession).mockResolvedValue(lefterisSession);
    expect(await hasModeratorAccess()).toBe(true);
    expect(await canEditCommunityBook(mockBook)).toBe(true);
  });

  it("allows the original creator to edit their community book", async () => {
    const creatorSession: AppSession = {
      user: { id: "user-creator-1", email: "creator@example.com", role: "MEMBER", name: "Creator" },
    };
    vi.mocked(getSession).mockResolvedValue(creatorSession);
    expect(await canEditCommunityBook(mockBook)).toBe(true);
  });

  it("denies edit access to a different regular user", async () => {
    const otherSession: AppSession = {
      user: { id: "user-other-2", email: "other@example.com", role: "MEMBER", name: "Other" },
    };
    vi.mocked(getSession).mockResolvedValue(otherSession);
    expect(await canEditCommunityBook(mockBook)).toBe(false);
  });

  it("denies delete access to non-community books even for admins", async () => {
    const standardBook: BookWork = {
      ...mockBook,
      isCommunityAdded: false,
      sourceId: "OL12345W",
    };
    const adminSession: AppSession = {
      user: { id: "admin-1", email: "admin@badreads.com", role: "ADMIN", name: "Admin" },
    };
    vi.mocked(getSession).mockResolvedValue(adminSession);
    expect(await canDeleteCommunityBook(standardBook)).toBe(false);
  });

  it("allows admins to delete community-added books", async () => {
    vi.mocked(isDemoMode).mockReturnValue(false);
    const adminSession: AppSession = {
      user: { id: "admin-1", email: "admin@badreads.com", role: "ADMIN", name: "Admin" },
    };
    vi.mocked(getSession).mockResolvedValue(adminSession);
    expect(await hasAdminAccess()).toBe(true);
    expect(await canDeleteCommunityBook(mockBook)).toBe(true);
  });

  it("denies delete access to regular users for community books", async () => {
    vi.mocked(isDemoMode).mockReturnValue(false);
    const memberSession: AppSession = {
      user: { id: "member-1", email: "member@example.com", role: "MEMBER", name: "Member" },
    };
    vi.mocked(getSession).mockResolvedValue(memberSession);
    expect(await hasAdminAccess()).toBe(false);
    expect(await canDeleteCommunityBook(mockBook)).toBe(false);
  });

  it("denies edit and delete access to unauthenticated users", async () => {
    vi.mocked(isDemoMode).mockReturnValue(false);
    vi.mocked(getSession).mockResolvedValue(null);

    expect(await hasAdminAccess()).toBe(false);
    expect(await hasModeratorAccess()).toBe(false);
    expect(await canEditCommunityBook(mockBook)).toBe(false);
    expect(await canDeleteCommunityBook(mockBook)).toBe(false);
  });
});

type CacheDispatcher = { getCacheForType: (create: () => unknown) => unknown };

/**
 * Runs `run()` inside a fresh React cache scope, the way the RSC renderer wraps
 * a single server request. Each invocation gets its own scope, so memoized
 * values never leak between "requests".
 */
async function withRequestScope<T>(run: () => Promise<T>): Promise<T> {
  const react = (await import("react")) as unknown as Record<string, { A: CacheDispatcher | null }>;
  const internals = react.__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const previous = internals.A;
  const scope = new Map<() => unknown, unknown>();
  internals.A = {
    getCacheForType: (create) => {
      if (!scope.has(create)) scope.set(create, create());
      return scope.get(create);
    },
  };
  try {
    return await run();
  } finally {
    internals.A = previous;
  }
}

describe("per-request session deduplication", () => {
  const communityBook: BookWork = {
    id: "book-comm-1",
    slug: "custom-book",
    title: "Custom Book",
    authors: ["Custom Author"],
    firstPublished: 2024,
    description: "Synopsis",
    coverTone: "acid",
    isCommunityAdded: true,
    createdByUserId: "user-creator-1",
  };

  /**
   * Loads the real (unmocked) `./session` module on top of a stubbed
   * `auth.api.getSession`, so we can count actual session lookups rather than
   * calls to a `getSession` test double.
   */
  async function loadAuthorizationWithRealSession() {
    const authApiGetSession = vi.fn(async () => ({
      user: { id: "user-mod-1", email: "mod@badreads.com", name: "Mod", role: "MODERATOR" },
    }));

    vi.resetModules();
    vi.doUnmock("./session");
    vi.doMock("./auth", () => ({ auth: { api: { getSession: authApiGetSession } } }));
    vi.doMock("next/headers", () => ({
      headers: async () => new Headers({ cookie: "better-auth.session_token=abc" }),
    }));
    vi.doMock("./runtime-config", () => ({ isDemoMode: () => false }));

    return { authApiGetSession };
  }

  afterAll(() => {
    vi.doUnmock("./auth");
    vi.doUnmock("next/headers");
    vi.resetModules();
  });

  it("looks the session up exactly once across every authorization helper in one request", async () => {
    const { authApiGetSession } = await loadAuthorizationWithRealSession();

    await withRequestScope(async () => {
      const authz = await import("./authorization");

      // Mirrors one production render of /books/[slug]: SiteHeader, the page,
      // and the per-book capability checks, which together reach the session
      // through eight separate call sites.
      const { getSession: readSession } = await import("./session");

      await readSession(); // SiteHeader
      await authz.hasModeratorAccess(); // SiteHeader moderator badge
      await readSession(); // the page component itself
      const [isModerator, isAdmin, canEdit, canDelete] = await Promise.all([
        authz.hasModeratorAccess(),
        authz.hasAdminAccess(),
        authz.canEditCommunityBook(communityBook),
        authz.canDeleteCommunityBook(communityBook),
      ]);

      expect(isModerator).toBe(true);
      expect(isAdmin).toBe(false);
      expect(canEdit).toBe(true);
      expect(canDelete).toBe(true);
      expect(authApiGetSession).toHaveBeenCalledTimes(1);
    });
  });

  it("re-reads the session for a new request instead of reusing the previous one", async () => {
    const { authApiGetSession } = await loadAuthorizationWithRealSession();
    const authz = await import("./authorization");

    await withRequestScope(async () => {
      expect(await authz.hasModeratorAccess()).toBe(true);
      expect(await authz.hasAdminAccess()).toBe(false);
    });
    await withRequestScope(async () => {
      expect(await authz.hasModeratorAccess()).toBe(true);
      expect(await authz.hasAdminAccess()).toBe(false);
    });

    expect(authApiGetSession).toHaveBeenCalledTimes(2);
  });
});
