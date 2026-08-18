/*
 * The memory store powers local demos and tests while the Drizzle schema can
 * be enabled in deployment. Keeping the same domain operations here prevents
 * UI code from depending on a database implementation during early slices.
 */

import { calculateBadnessSummary, validateRoastDraft, type ReactionKind } from "./core";
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

type RoastInput = {
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
    return state.profiles.find((profile) => profile.id === id);
  }

  function getRoast(id: string) {
    return state.roasts.find((roast) => roast.id === id);
  }

  function listBooks() {
    return clone(state.books);
  }

  function listRoasts() {
    return clone(state.roasts);
  }

  function createProfile(input: Omit<Profile, "id">) {
    const profile: Profile = { ...input, id: createId("profile") };
    state.profiles.push(profile);
    return clone(profile);
  }

  function createRoast(input: RoastInput): StoreResult<Roast> {
    const profile = getProfile(input.userId);
    const book = state.books.find((candidate) => candidate.id === input.bookId);
    if (!profile || !book) return { ok: false, code: "NOT_FOUND", message: "That book or profile was not found." };

    if (state.roasts.some((roast) => roast.authorId === input.userId && roast.bookId === input.bookId)) {
      return { ok: false, code: "CONFLICT", message: "You already roasted this book." };
    }

    const validation = validateRoastDraft(input);
    if (!validation.success) {
      return { ok: false, code: "VALIDATION_ERROR", message: validation.errors.join(" ") };
    }

    const hasApprovedRoast = state.roasts.some(
      (roast) => roast.authorId === input.userId && roast.status === "PUBLISHED",
    );
    const roast: Roast = {
      id: createId("roast"),
      bookId: input.bookId,
      authorId: input.userId,
      author: clone(profile),
      hook: validation.data.hook,
      body: validation.data.body,
      rating: validation.data.rating as Roast["rating"],
      flawTags: validation.data.flawTags,
      spoiler: input.spoiler,
      createdAt: new Date().toISOString(),
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
    if (roast.authorId !== input.userId) return { ok: false as const, code: "FORBIDDEN" as const, message: "You can only edit your own roast." };

    const validation = validateRoastDraft(input);
    if (!validation.success) {
      return { ok: false as const, code: "VALIDATION_ERROR" as const, message: validation.errors.join(" ") };
    }

    roast.hook = validation.data.hook;
    roast.body = validation.data.body;
    roast.rating = validation.data.rating as Roast["rating"];
    roast.flawTags = validation.data.flawTags;
    roast.spoiler = input.spoiler;
    return { ok: true as const, data: clone(roast) };
  }

  function setReaction(input: { roastId: string; userId: string; kind: ReactionKind; active: boolean }) {
    const roast = getRoast(input.roastId);
    if (!roast) return { ok: false as const, code: "NOT_FOUND" as const, message: "That roast was not found." };
    const key = reactionKey(input.roastId, input.userId, input.kind);
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
    const key = followKey(input.followerId, input.followeeId);
    if (input.active) state.follows.add(key);
    else state.follows.delete(key);
    return { ok: true as const, data: { active: state.follows.has(key) } };
  }

  function setBookmark(input: { userId: string; roastId: string; active: boolean }) {
    const roast = getRoast(input.roastId);
    if (!roast) return { ok: false as const, code: "NOT_FOUND" as const, message: "That roast was not found." };
    const key = bookmarkKey(input.userId, input.roastId);
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
    if (state.reports.some((report) => report.roastId === input.roastId && report.reporterId === input.reporterId)) {
      return { ok: false as const, code: "CONFLICT" as const, message: "You already reported this roast." };
    }
    const report: Report = {
      id: createId("report"),
      roastId: input.roastId,
      reporterId: input.reporterId,
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

  function getBookSummary(bookId: string) {
    return calculateBadnessSummary(
      state.roasts.filter((roast) => roast.bookId === bookId && roast.status === "PUBLISHED"),
    );
  }

  return {
    createProfile,
    createRoast,
    getBookSummary,
    getProfile,
    getRoast,
    listBooks,
    listRoasts,
    moderateRoast,
    reportRoast,
    setBookmark,
    setFollow,
    setReaction,
    updateRoast,
  };
}

const globalStore = globalThis as typeof globalThis & { __badreadsStore?: ReturnType<typeof createMemoryStore> };
export const memoryStore = globalStore.__badreadsStore ?? createMemoryStore();
globalStore.__badreadsStore = memoryStore;
