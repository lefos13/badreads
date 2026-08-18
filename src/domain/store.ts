/*
 * The memory store powers local demos and tests while the Drizzle schema can
 * be enabled in deployment. Keeping the same domain operations here prevents
 * UI code from depending on a database implementation during early slices.
 */

import { calculateBadnessSummary, composeFeed, validateRoastDraft, type ReactionKind } from "./core";
import type {
  BookWork,
  ModerationAction,
  Profile,
  Report,
  ReportCategory,
  Roast,
  RoastStatus,
} from "./types";
import { demoBooks, demoProfiles, demoRoasts } from "@/src/data/demo";

export type RoastInput = {
  userId: string;
  bookId: string;
  hook: string;
  body: string;
  rating: number;
  flawTags: Roast["flawTags"];
  spoiler: boolean;
};

type StoreErrorCode = "VALIDATION_ERROR" | "CONFLICT" | "NOT_FOUND" | "FORBIDDEN";
type StoreFailure = { ok: false; code: StoreErrorCode; message: string };
type StoreSuccess<T> = { ok: true; data: T };
export type StoreResult<T> = StoreSuccess<T> | StoreFailure;

type MemoryState = {
  books: BookWork[];
  profiles: Profile[];
  roasts: Roast[];
  reports: Report[];
  moderationActions: ModerationAction[];
  reactions: Set<string>;
  follows: Set<string>;
  bookmarks: Set<string>;
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function reactionKey(roastId: string, userId: string, kind: ReactionKind) {
  return `${roastId}:${userId}:${kind}`;
}

function followKey(followerId: string, followeeId: string) {
  return `${followerId}:${followeeId}`;
}

function bookmarkKey(userId: string, roastId: string) {
  return `${userId}:${roastId}`;
}

export function createMemoryStore(options: { seed?: boolean } = { seed: true }) {
  const state: MemoryState = {
    books: options.seed === false ? [clone(demoBooks[0])] : clone(demoBooks),
    profiles: options.seed === false ? [] : clone(demoProfiles),
    roasts: options.seed === false ? [] : clone(demoRoasts),
    reports: [],
    moderationActions: [],
    reactions: new Set(),
    follows: new Set(),
    bookmarks: new Set(),
  };

  function getProfile(id: string) {
    return state.profiles.find((profile) => profile.id === id || profile.userId === id);
  }

  function getProfileByHandle(handle: string) {
    return state.profiles.find((profile) => profile.handle === handle);
  }

  function getBookBySlug(slug: string) {
    return state.books.find((book) => book.slug === slug);
  }

  function getBook(id: string) {
    return state.books.find((book) => book.id === id);
  }

  function getRoast(id: string) {
    return state.roasts.find((roast) => roast.id === id);
  }

  function listBooks() {
    return clone(state.books);
  }
  function searchBooks(query: string, limit = 20) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return clone(
      state.books
        .filter((book) =>
          [book.title, ...book.authors, book.slug, book.sourceId ?? ""].some((value) =>
            value.toLowerCase().includes(normalized),
          ),
        )
        .slice(0, limit),
    );
  }

  function upsertBook(input: BookWork) {
    const existing = state.books.find((book) => book.id === input.id || (input.sourceId && book.sourceId === input.sourceId));
    if (existing) {
      Object.assign(existing, input);
      return clone(existing);
    }
    state.books.push(clone(input));
    return clone(input);
  }

  function listRoasts() {
    return clone(state.roasts);
  }

  function listReports() {
    return clone(state.reports);
  }

  function createProfile(input: Omit<Profile, "id">) {
    if (state.profiles.some((profile) => profile.handle.toLowerCase() === input.handle.toLowerCase())) {
      return { ok: false as const, code: "CONFLICT" as const, message: "That handle is already taken." };
    }
    if (input.userId && state.profiles.some((profile) => profile.userId === input.userId)) {
      return { ok: false as const, code: "CONFLICT" as const, message: "This account already has a public profile." };
    }
    const profile: Profile = { ...input, id: createId("profile") };
    state.profiles.push(profile);
    return { ok: true as const, data: clone(profile) };
  }

  function createRoast(input: RoastInput): StoreResult<Roast> {
    const profile = getProfile(input.userId);
    const book = state.books.find((candidate) => candidate.id === input.bookId);
    if (!profile || !book) return { ok: false, code: "NOT_FOUND", message: "That book or profile was not found." };

    if (state.roasts.some((roast) => roast.authorId === profile.id && roast.bookId === input.bookId)) {
      return { ok: false, code: "CONFLICT", message: "You already roasted this book." };
    }

    const validation = validateRoastDraft(input);
    if (!validation.success) {
      return { ok: false, code: "VALIDATION_ERROR", message: validation.errors.join(" ") };
    }

    const hasApprovedRoast = state.roasts.some(
      (roast) => roast.authorId === profile.id && roast.status === "PUBLISHED",
    );
    const roast: Roast = {
      id: createId("roast"),
      bookId: input.bookId,
      authorId: profile.id,
      author: clone(profile),
      hook: validation.data.hook,
      body: validation.data.body,
      rating: validation.data.rating as Roast["rating"],
      flawTags: validation.data.flawTags,
      spoiler: input.spoiler,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fairCount: 0,
      funnyCount: 0,
      bookmarkCount: 0,
      status: hasApprovedRoast ? "PUBLISHED" : "PENDING_REVIEW",
    };

    state.roasts.unshift(roast);
    return { ok: true, data: clone(roast) };
  }

  function updateRoast(input: RoastInput & { roastId: string; expectedUpdatedAt?: string }) {
    const roast = getRoast(input.roastId);
    if (!roast) return { ok: false as const, code: "NOT_FOUND" as const, message: "That roast was not found." };
    const profile = getProfile(input.userId);
    if (!profile || roast.authorId !== profile.id) return { ok: false as const, code: "FORBIDDEN" as const, message: "You can only edit your own roast." };
    if (input.expectedUpdatedAt && roast.updatedAt !== input.expectedUpdatedAt) {
      return { ok: false as const, code: "CONFLICT" as const, message: "This roast changed in another tab. Reload it before editing." };
    }

    const validation = validateRoastDraft(input);
    if (!validation.success) {
      return { ok: false as const, code: "VALIDATION_ERROR" as const, message: validation.errors.join(" ") };
    }

    roast.hook = validation.data.hook;
    roast.body = validation.data.body;
    roast.rating = validation.data.rating as Roast["rating"];
    roast.flawTags = validation.data.flawTags;
    roast.spoiler = input.spoiler;
    roast.updatedAt = new Date().toISOString();
    return { ok: true as const, data: clone(roast) };
  }

  function setReaction(input: { roastId: string; userId: string; kind: ReactionKind; active: boolean }) {
    const roast = getRoast(input.roastId);
    if (!roast) return { ok: false as const, code: "NOT_FOUND" as const, message: "That roast was not found." };
    if (roast.status !== "PUBLISHED") return { ok: false as const, code: "FORBIDDEN" as const, message: "Only published roasts can receive reactions." };
    const profile = getProfile(input.userId);
    if (!profile) return { ok: false as const, code: "NOT_FOUND" as const, message: "That reviewer was not found." };
    const key = reactionKey(input.roastId, profile.id, input.kind);
    const isActive = state.reactions.has(key);
    if (input.active && !isActive) {
      state.reactions.add(key);
      if (input.kind === "FAIR") roast.fairCount += 1;
      if (input.kind === "FUNNY") roast.funnyCount += 1;
    }
    if (!input.active && isActive) {
      state.reactions.delete(key);
      if (input.kind === "FAIR") roast.fairCount = Math.max(0, roast.fairCount - 1);
      if (input.kind === "FUNNY") roast.funnyCount = Math.max(0, roast.funnyCount - 1);
    }
    return { ok: true as const, data: clone(roast) };
  }

  function setFollow(input: { followerId: string; followeeId: string; active: boolean }) {
    const follower = getProfile(input.followerId);
    const followee = getProfile(input.followeeId);
    if (!follower || !followee) return { ok: false as const, code: "NOT_FOUND" as const, message: "That reviewer was not found." };
    if (follower.id === followee.id) return { ok: false as const, code: "CONFLICT" as const, message: "You cannot follow yourself." };
    const key = followKey(follower.id, followee.id);
    if (input.active) state.follows.add(key);
    else state.follows.delete(key);
    return { ok: true as const, data: { active: state.follows.has(key) } };
  }

  function setBookmark(input: { userId: string; roastId: string; active: boolean }) {
    const roast = getRoast(input.roastId);
    if (!roast) return { ok: false as const, code: "NOT_FOUND" as const, message: "That roast was not found." };
    if (roast.status !== "PUBLISHED") return { ok: false as const, code: "FORBIDDEN" as const, message: "Only published roasts can be bookmarked." };
    const profile = getProfile(input.userId);
    if (!profile) return { ok: false as const, code: "NOT_FOUND" as const, message: "That reviewer was not found." };
    const key = bookmarkKey(profile.id, input.roastId);
    const isActive = state.bookmarks.has(key);
    if (input.active && !isActive) {
      state.bookmarks.add(key);
      roast.bookmarkCount += 1;
    }
    if (!input.active && isActive) {
      state.bookmarks.delete(key);
      roast.bookmarkCount = Math.max(0, roast.bookmarkCount - 1);
    }
    return { ok: true as const, data: clone(roast) };
  }

  function reportRoast(input: { roastId: string; reporterId: string; category: ReportCategory; note?: string }) {
    const roast = getRoast(input.roastId);
    if (!roast) return { ok: false as const, code: "NOT_FOUND" as const, message: "That roast was not found." };
    if (roast.status !== "PUBLISHED") return { ok: false as const, code: "FORBIDDEN" as const, message: "Only published roasts can be reported." };
    const profile = getProfile(input.reporterId);
    if (!profile) return { ok: false as const, code: "NOT_FOUND" as const, message: "That reviewer was not found." };
    if (state.reports.some((report) => report.roastId === input.roastId && report.reporterId === profile.id)) {
      return { ok: false as const, code: "CONFLICT" as const, message: "You already reported this roast." };
    }
    const report: Report = {
      id: createId("report"),
      roastId: input.roastId,
      reporterId: profile.id,
      category: input.category,
      note: input.note,
      status: "OPEN",
      createdAt: new Date().toISOString(),
    };
    state.reports.push(report);
    const openReports = state.reports.filter((candidate) => candidate.roastId === input.roastId && candidate.status === "OPEN");
    if (openReports.length >= 3) roast.status = "REMOVED";
    return { ok: true as const, data: clone(report) };
  }

  function moderateRoast(input: {
    roastId: string;
    moderatorId: string;
    decision: ModerationAction["decision"];
    note?: string;
  }) {
    const roast = getRoast(input.roastId);
    if (!roast) return { ok: false as const, code: "NOT_FOUND" as const, message: "That roast was not found." };
    const nextStatus: Record<ModerationAction["decision"], RoastStatus | null> = {
      APPROVE: "PUBLISHED",
      REJECT: "REJECTED",
      RESTORE: "PUBLISHED",
      REMOVE: "REMOVED",
      WARN: null,
      SUSPEND: null,
      BAN: null,
    };
    if (nextStatus[input.decision]) roast.status = nextStatus[input.decision] as RoastStatus;
    const action: ModerationAction = {
      id: createId("moderation"),
      roastId: input.roastId,
      moderatorId: input.moderatorId,
      decision: input.decision,
      note: input.note,
      createdAt: new Date().toISOString(),
    };
    state.moderationActions.push(action);
    return { ok: true as const, data: clone(roast) };
  }

  function resolveReport(input: { reportId: string; moderatorId: string; status: "UPHELD" | "DISMISSED"; note?: string }) {
    const report = state.reports.find((candidate) => candidate.id === input.reportId);
    if (!report) return { ok: false as const, code: "NOT_FOUND" as const, message: "That report was not found." };
    if (report.status !== "OPEN") return { ok: false as const, code: "CONFLICT" as const, message: "That report has already been resolved." };
    report.status = input.status;
    const action: ModerationAction = {
      id: createId("moderation"),
      roastId: report.roastId,
      moderatorId: input.moderatorId,
      decision: input.status === "UPHELD" ? "REMOVE" : "WARN",
      note: input.note,
      createdAt: new Date().toISOString(),
    };
    state.moderationActions.push(action);
    if (input.status === "UPHELD") {
      const roast = getRoast(report.roastId);
      if (roast) roast.status = "REMOVED";
    }
    return { ok: true as const, data: clone(report) };
  }

  function getBookSummary(bookId: string) {
    return calculateBadnessSummary(
      state.roasts.filter((roast) => roast.bookId === bookId && roast.status === "PUBLISHED"),
    );
  }

  function getRoastsForBook(bookId: string) {
    return clone(state.roasts.filter((roast) => roast.bookId === bookId && roast.status === "PUBLISHED"));
  }

  function exportProfile(userId: string) {
    const profile = getProfile(userId);
    if (!profile) return { ok: false as const, code: "NOT_FOUND" as const, message: "That profile was not found." };
    return {
      ok: true as const,
      data: {
        profile: clone(profile),
        roasts: clone(state.roasts.filter((roast) => roast.authorId === profile.id)),
      },
    };
  }

  function deleteProfile(userId: string) {
    const profile = getProfile(userId);
    if (!profile) return { ok: false as const, code: "NOT_FOUND" as const, message: "That profile was not found." };
    const roastIds = new Set(state.roasts.filter((roast) => roast.authorId === profile.id).map((roast) => roast.id));
    state.roasts = state.roasts.filter((roast) => !roastIds.has(roast.id));
    state.profiles = state.profiles.filter((candidate) => candidate.id !== profile.id);
    state.reports = state.reports.filter((report) => report.reporterId !== profile.id && !roastIds.has(report.roastId));
    state.moderationActions = state.moderationActions.filter((action) => !roastIds.has(action.roastId));
    for (const key of [...state.reactions]) if (roastIds.has(key.split(":")[0]) || key.split(":")[1] === profile.id) state.reactions.delete(key);
    for (const key of [...state.bookmarks]) if (roastIds.has(key.split(":")[1]) || key.split(":")[0] === profile.id) state.bookmarks.delete(key);
    for (const key of [...state.follows]) if (key.split(":")[0] === profile.id || key.split(":")[1] === profile.id) state.follows.delete(key);
    return { ok: true as const, data: { deleted: true } };
  }

  function listFeed(viewerId?: string) {
    const now = Date.now();
    const viewerProfileId = viewerId ? getProfile(viewerId)?.id : undefined;
    const followedAuthorIds = new Set(
      viewerProfileId
        ? [...state.follows]
            .filter((key) => key.startsWith(`${viewerProfileId}:`))
            .map((key) => key.slice(`${viewerProfileId}:`.length))
        : [],
    );
    const discovery = state.roasts
      .filter((roast) => roast.status === "PUBLISHED")
      .filter((roast) => !followedAuthorIds.has(roast.authorId))
      .filter((roast) => now - new Date(roast.createdAt).getTime() <= 14 * 24 * 60 * 60 * 1000)
      .slice()
      .sort((a, b) => {
        const score = (roast: Roast) => 2 * roast.fairCount + roast.funnyCount + 2 * roast.bookmarkCount;
        return score(b) - score(a) || b.createdAt.localeCompare(a.createdAt);
      });
    const following = state.roasts
      .filter((roast) => roast.status === "PUBLISHED" && followedAuthorIds.has(roast.authorId))
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return clone(composeFeed({ following, discovery }));
  }

  return {
    createProfile,
    createRoast,
    deleteProfile,
    exportProfile,
    getBook,
    getBookBySlug,
    getBookSummary,
    getProfile,
    getProfileByHandle,
    getRoast,
    getRoastsForBook,
    listBooks,
    listFeed,
    listReports,
    listRoasts,
    moderateRoast,
    reportRoast,
    resolveReport,
    setBookmark,
    setFollow,
    setReaction,
    searchBooks,
    upsertBook,
    updateRoast,
  };
}

const globalStore = globalThis as typeof globalThis & { __badreadsStore?: ReturnType<typeof createMemoryStore> };
export const memoryStore = globalStore.__badreadsStore
  && typeof globalStore.__badreadsStore.getBook === "function"
  && typeof globalStore.__badreadsStore.listReports === "function"
  && typeof globalStore.__badreadsStore.resolveReport === "function"
  ? globalStore.__badreadsStore
  : createMemoryStore();
globalStore.__badreadsStore = memoryStore;
