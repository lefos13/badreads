import { beforeEach, describe, expect, it, vi } from "vitest";

// Vitest resolves the browser build of React, whose `cache()` is a pass-through
// (`fn => (...args) => fn(...args)`). Only the `react-server` build memoizes, so
// we swap it in here to exercise the real production behaviour of `React.cache`.
vi.mock("react", async () => {
  const serverReact = await vi.importActual<Record<string, unknown>>(
    "../../node_modules/react/cjs/react.react-server.development.js",
  );
  return (serverReact.default ?? serverReact) as Record<string, unknown>;
});

const { getSessionFromAuth } = vi.hoisted(() => ({ getSessionFromAuth: vi.fn() }));

vi.mock("./auth", () => ({
  auth: { api: { getSession: getSessionFromAuth } },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ cookie: "better-auth.session_token=abc" })),
}));

vi.mock("./runtime-config", () => ({
  isDemoMode: vi.fn(),
}));

import { getSession } from "./session";
import { isDemoMode } from "./runtime-config";

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

describe("getSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the demo viewer without touching the auth database in demo mode", async () => {
    vi.mocked(isDemoMode).mockReturnValue(true);

    const session = await withRequestScope(() => getSession());

    expect(session?.user).toEqual({
      id: "profile-mara",
      email: "demo@badreads.local",
      name: "Mara Reads",
    });
    expect(getSessionFromAuth).not.toHaveBeenCalled();
  });

  it("hits the auth database once per request no matter how many callers ask", async () => {
    vi.mocked(isDemoMode).mockReturnValue(false);
    getSessionFromAuth.mockResolvedValue({
      user: { id: "user-1", email: "reader@example.com", name: "Reader", role: "MEMBER" },
    });

    const sessions = await withRequestScope(async () =>
      Promise.all([getSession(), getSession(), getSession(), getSession()]),
    );

    expect(getSessionFromAuth).toHaveBeenCalledTimes(1);
    expect(sessions[0]?.user.id).toBe("user-1");
    // Memoization must hand back the identical value, not a re-fetched copy.
    expect(sessions[1]).toBe(sessions[0]);
    expect(sessions[3]).toBe(sessions[0]);
  });

  it("does not share a memoized session between separate requests", async () => {
    vi.mocked(isDemoMode).mockReturnValue(false);
    getSessionFromAuth.mockResolvedValueOnce({
      user: { id: "user-1", email: "first@example.com", name: "First" },
    });
    getSessionFromAuth.mockResolvedValueOnce({
      user: { id: "user-2", email: "second@example.com", name: "Second" },
    });

    const first = await withRequestScope(() => getSession());
    const second = await withRequestScope(() => getSession());

    expect(getSessionFromAuth).toHaveBeenCalledTimes(2);
    expect(first?.user.id).toBe("user-1");
    expect(second?.user.id).toBe("user-2");
  });
});
