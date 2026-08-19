/*
 * The memory store powers local demos and tests while the Drizzle schema can
 * be enabled in deployment. Keeping the same domain operations here prevents
 * UI code from depending on a database implementation during early slices.
 */

import {
  calculateBadnessSummary,
  composeFeed,
  createCommunityBookSchema,
  isValidIsbn,
  normalizeIsbn,
  updateCommunityBookSchema,
  validateRoastDraft,
  type ReactionKind,
} from "./core";
import type {
  BookSummary,
  BookSummaryMap,
  BookWork,
  Bottom100Item,
  Bottom100Options,
  Bottom100SortOption,
  CreateCommunityBookInput,
  ListFeedOptions,
  ListRoastsByAuthorOptions,
  ListRoastsOptions,
  ModerationAction,
  Profile,
  Report,
  ReportCategory,
  Roast,
  RoastStatus,
  TopRoaster,
  UpdateCommunityBookInput,
} from "./types";
import { demoBooks, demoProfiles, demoRoasts } from "@/src/data/demo";

/*
 * The ranking constants and comparators below are exported so the Postgres
 * store can reuse the exact same semantics it now pushes into SQL. Keeping one
 * definition per rule is what stops the two DomainStore implementations from
 * drifting apart.
 */
export const DISCOVERY_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
export const DEFAULT_FEED_LIMIT = 100;
export const BOTTOM_100_LIMIT = 100;
export const BOTTOM_100_QUALIFIED_MIN_ROASTS = 3;
export const BOTTOM_100_TOP_ROASTS = 5;
const BOTTOM_100_PRIOR_WEIGHT = 2;
const BOTTOM_100_PRIOR_RATING = 3.0;

/* The Bayesian-style prior keeps a single catastrophic verdict from beating a
 * book that many readers agreed was awful. */
export function roundAverage(total: number, count: number): number | null {
  if (count <= 0) return null;
  return Number((total / count).toFixed(1));
}

export function weightedBadnessScore(count: number, average: number | null): number {
  if (average === null) return 0;
  return Number((
    (count * average + BOTTOM_100_PRIOR_WEIGHT * BOTTOM_100_PRIOR_RATING)
    / (count + BOTTOM_100_PRIOR_WEIGHT)
  ).toFixed(2));
}

export function feedEngagementScore(roast: Pick<Roast, "fairCount" | "funnyCount" | "bookmarkCount">): number {
  return 2 * roast.fairCount + roast.funnyCount + 2 * roast.bookmarkCount;
}

export function compareTopRoasts(a: Roast, b: Roast): number {
  return (2 * b.fairCount + b.funnyCount) - (2 * a.fairCount + a.funnyCount)
    || b.rating - a.rating
    || b.createdAt.localeCompare(a.createdAt);
}

export function compareBottom100Candidates(
  a: { summary: { count: number }; weightedScore: number },
  b: { summary: { count: number }; weightedScore: number },
): number {
  const aQualified = a.summary.count >= BOTTOM_100_QUALIFIED_MIN_ROASTS ? 1 : 0;
  const bQualified = b.summary.count >= BOTTOM_100_QUALIFIED_MIN_ROASTS ? 1 : 0;
  if (aQualified !== bQualified) return bQualified - aQualified;
  return b.weightedScore - a.weightedScore || b.summary.count - a.summary.count;
}

/* A seeded generator lets a page shuffle once per request instead of once per
 * call, while an absent seed keeps the previous Math.random behaviour. */
function createRandom(seed?: number): () => number {
  if (typeof seed !== "number" || !Number.isFinite(seed)) return Math.random;
  let state = Math.floor(Math.abs(seed)) % 4294967296 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function applyBottom100Sort(
  ranked: Bottom100Item[],
  sort: Bottom100SortOption,
  options?: Bottom100Options,
): Bottom100Item[] {
  if (sort === "badness") return ranked;
  if (sort === "roasts") return [...ranked].sort((a, b) => b.summary.count - a.summary.count || a.rank - b.rank);
  if (sort === "title") return [...ranked].sort((a, b) => a.book.title.localeCompare(b.book.title));

  const random = createRandom(options?.seed);
  const shuffled = [...ranked];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/* A row cap is always a non-negative whole number so `slice` in the memory
 * store and `LIMIT` in Postgres return the same rows for the same argument. */
export function normalizeRowCap(limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return 0;
  return Math.floor(limit);
}

export function resolveListLimit(limit: number | undefined, fallback?: number): number | undefined {
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) return Math.floor(limit);
  return fallback;
}

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
  function listBooks(limit?: number) {
    const all = clone(state.books);
    return typeof limit === "number" && limit > 0 ? all.slice(0, limit) : all;
  }

  function getBooksByIds(ids: string[]): BookWork[] {
    const idSet = new Set(ids);
    return clone(state.books.filter((book) => idSet.has(book.id)));
  }

  function getBookByProviderWorkId(providerWorkId: string): BookWork | undefined {
    const clean = providerWorkId.toLowerCase();
    const found = state.books.find((b) => (b.sourceId && b.sourceId.toLowerCase() === clean) || b.id.toLowerCase() === clean);
    return found ? clone(found) : undefined;
  }

  function findBookByIsbn(isbn: string): BookWork | undefined {
    const normalized = normalizeIsbn(isbn);
    if (!normalized) return undefined;
    return state.books.find((book) => {
      if (book.isbn && normalizeIsbn(book.isbn) === normalized) return true;
      if (book.sourceId && normalizeIsbn(book.sourceId).includes(normalized)) return true;
      if (book.id && normalizeIsbn(book.id).includes(normalized)) return true;
      return false;
    });
  }

  function createCommunityBook(input: CreateCommunityBookInput): StoreResult<BookWork> {
    const parsed = createCommunityBookSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid book details." };
    }
    const cleanIsbn = normalizeIsbn(input.isbn);
    const existing = findBookByIsbn(cleanIsbn);
    if (existing) {
      return { ok: false, code: "CONFLICT", message: "A book with this ISBN already exists." };
    }

    const titleSlug = input.title.toLowerCase().replace(/[^\p{L}\p{N}0-9]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 70) || "book";
    let slug = `${titleSlug}-community-${cleanIsbn.toLowerCase()}`;
    let counter = 1;
    while (state.books.some((b) => b.slug === slug)) {
      slug = `${titleSlug}-community-${cleanIsbn.toLowerCase()}-${counter}`;
      counter++;
    }

    const book: BookWork = {
      id: createId("book-community"),
      slug,
      title: input.title.trim(),
      authors: input.authors.map((a) => a.trim()).filter(Boolean),
      firstPublished: input.firstPublished ?? null,
      description: input.description?.trim() ?? "",
      coverTone: input.coverTone ?? "acid",
      coverUrl: input.coverUrl ?? null,
      sourceId: `community-${cleanIsbn}`,
      isCommunityAdded: true,
      createdByUserId: input.createdByUserId,
      isbn: cleanIsbn,
    };

    state.books.push(clone(book));
    return { ok: true, data: clone(book) };
  }

  function updateCommunityBook(input: UpdateCommunityBookInput): StoreResult<BookWork> {
    const parsed = updateCommunityBookSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid book details." };
    }
    const existing = state.books.find((book) => book.id === input.id);
    if (!existing) {
      return { ok: false, code: "NOT_FOUND", message: "Book not found." };
    }

    existing.title = input.title.trim();
    existing.authors = input.authors.map((a) => a.trim()).filter(Boolean);
    existing.firstPublished = input.firstPublished ?? null;
    existing.description = input.description?.trim() ?? "";
    if (input.coverTone) existing.coverTone = input.coverTone;
    if (input.coverUrl !== undefined) existing.coverUrl = input.coverUrl;

    return { ok: true, data: clone(existing) };
  }

  function deleteCommunityBook(id: string): StoreResult<{ id: string }> {
    const bookIndex = state.books.findIndex((book) => book.id === id);
    if (bookIndex === -1) {
      return { ok: false, code: "NOT_FOUND", message: "Book not found." };
    }
    const [deletedBook] = state.books.splice(bookIndex, 1);
    const deletedRoastIds = new Set(
      state.roasts.filter((r) => r.bookId === id).map((r) => r.id),
    );
    state.roasts = state.roasts.filter((r) => r.bookId !== id);
    state.reports = state.reports.filter((rep) => !deletedRoastIds.has(rep.roastId));
    return { ok: true, data: { id: deletedBook.id } };
  }
  function searchBooks(query: string, limit = 20) {
    const normalized = query.trim().toLowerCase();
    const isbnClean = normalizeIsbn(query);
    if (!normalized) return [];
    return clone(
      state.books
        .filter((book) =>
          [book.title, ...book.authors, book.slug, book.sourceId ?? "", book.isbn ?? ""].some((value) =>
            value.toLowerCase().includes(normalized),
          ) || (isbnClean.length >= 8 && normalizeIsbn(book.isbn ?? "").includes(isbnClean)),
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

  function sortedRoasts() {
    /* Array.prototype.sort is stable, so equal timestamps keep insertion order
     * and match the `created_at desc` ordering used by the Postgres store. */
    return [...state.roasts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  function listRoasts(options?: ListRoastsOptions) {
    const status = options?.status;
    const filtered = status ? sortedRoasts().filter((roast) => roast.status === status) : sortedRoasts();
    const offset = resolveListLimit(options?.offset) ?? 0;
    const limit = resolveListLimit(options?.limit);
    const page = limit === undefined ? filtered.slice(offset) : filtered.slice(offset, offset + limit);
    return clone(page);
  }

  function listRoastsByAuthor(profileId: string, options?: ListRoastsByAuthorOptions) {
    const profile = getProfile(profileId);
    if (!profile) return [];
    const status = options?.status;
    const filtered = sortedRoasts()
      .filter((roast) => roast.authorId === profile.id)
      .filter((roast) => (status ? roast.status === status : true));
    const limit = resolveListLimit(options?.limit);
    return clone(limit === undefined ? filtered : filtered.slice(0, limit));
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

  function getUserReactionStates(userId: string, roastIds: string[]): Record<string, { fair: boolean; funny: boolean; bookmarked: boolean }> {
    const profile = getProfile(userId);
    const result: Record<string, { fair: boolean; funny: boolean; bookmarked: boolean }> = {};
    for (const roastId of roastIds) {
      if (!profile) {
        result[roastId] = { fair: false, funny: false, bookmarked: false };
      } else {
        result[roastId] = {
          fair: state.reactions.has(reactionKey(roastId, profile.id, "FAIR")),
          funny: state.reactions.has(reactionKey(roastId, profile.id, "FUNNY")),
          bookmarked: state.bookmarks.has(bookmarkKey(profile.id, roastId)),
        };
      }
    }
    return result;
  }

  function isFollowing(followerUserId: string, followeeProfileId: string): boolean {
    const follower = getProfile(followerUserId);
    if (!follower) return false;
    return state.follows.has(followKey(follower.id, followeeProfileId));
  }

  function listBookmarkedRoasts(userId: string): Roast[] {
    const profile = getProfile(userId);
    if (!profile) return [];
    const prefix = `${profile.id}:`;
    const bookmarkedRoastIds = new Set(
      [...state.bookmarks]
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length)),
    );
    return clone(
      state.roasts
        .filter((roast) => roast.status === "PUBLISHED" && bookmarkedRoastIds.has(roast.id))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
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

  function getBookSummary(bookId: string): BookSummary {
    return calculateBadnessSummary(
      state.roasts.filter((roast) => roast.bookId === bookId && roast.status === "PUBLISHED"),
    );
  }

  /* One grouped pass replaces the per-book loops the pages used to run. Every
   * requested id is present in the result, including books with no roasts. */
  function getBookSummaries(bookIds: string[]): BookSummaryMap {
    const wanted = new Set(bookIds);
    const grouped = new Map<string, Roast[]>();
    for (const roast of state.roasts) {
      if (roast.status !== "PUBLISHED" || !wanted.has(roast.bookId)) continue;
      const list = grouped.get(roast.bookId) ?? [];
      list.push(roast);
      grouped.set(roast.bookId, list);
    }
    const summaries: BookSummaryMap = {};
    for (const bookId of wanted) {
      summaries[bookId] = calculateBadnessSummary(grouped.get(bookId) ?? []);
    }
    return summaries;
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

  function listFeed(viewerId?: string, options?: ListFeedOptions) {
    const now = Date.now();
    const limit = resolveListLimit(options?.limit, DEFAULT_FEED_LIMIT) ?? DEFAULT_FEED_LIMIT;
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
      .filter((roast) => now - new Date(roast.createdAt).getTime() <= DISCOVERY_WINDOW_MS)
      .slice()
      .sort((a, b) => feedEngagementScore(b) - feedEngagementScore(a) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
    const following = state.roasts
      .filter((roast) => roast.status === "PUBLISHED" && followedAuthorIds.has(roast.authorId))
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
    return clone(composeFeed({ following, discovery }).slice(0, limit));
  }

  function listBottom100(sort: Bottom100SortOption = "shuffle", options?: Bottom100Options): Bottom100Item[] {
    const roastsByBook = new Map<string, Roast[]>();
    for (const roast of state.roasts) {
      if (roast.status === "PUBLISHED") {
        const list = roastsByBook.get(roast.bookId) ?? [];
        list.push(roast);
        roastsByBook.set(roast.bookId, list);
      }
    }

    const candidates: Array<{
      book: BookWork;
      summary: { average: number | null; count: number; worstCount: number };
      weightedScore: number;
      topRoasts: Roast[];
    }> = [];

    for (const book of state.books) {
      const bookRoasts = roastsByBook.get(book.id) ?? [];
      if (bookRoasts.length === 0) continue;

      const count = bookRoasts.length;
      const worstCount = bookRoasts.filter((r) => r.rating === 5).length;
      const average = roundAverage(bookRoasts.reduce((acc, r) => acc + r.rating, 0), count);
      const weightedScore = weightedBadnessScore(count, average);

      const topRoasts = [...bookRoasts].sort(compareTopRoasts).slice(0, BOTTOM_100_TOP_ROASTS);

      candidates.push({
        book: clone(book),
        summary: { average, count, worstCount },
        weightedScore,
        topRoasts: clone(topRoasts),
      });
    }

    candidates.sort(compareBottom100Candidates);

    const ranked: Bottom100Item[] = candidates.slice(0, BOTTOM_100_LIMIT).map((item, index) => ({
      rank: index + 1,
      book: item.book,
      summary: item.summary,
      weightedScore: item.weightedScore,
      topRoasts: item.topRoasts,
    }));

    return applyBottom100Sort(ranked, sort, options);
  }

  function listTopRoasters(limit = 25): TopRoaster[] {
    const roasters = new Map<string, TopRoaster>();
    for (const roast of state.roasts) {
      if (roast.status !== "PUBLISHED") continue;
      const profile = roast.author ?? getProfile(roast.authorId);
      if (!profile) continue;
      const current = roasters.get(roast.authorId);
      if (current) {
        current.roastCount += 1;
        current.fairCount += roast.fairCount;
        current.funnyCount += roast.funnyCount;
        current.totalReactions += roast.fairCount + roast.funnyCount;
      } else {
        roasters.set(roast.authorId, {
          profile: clone(profile),
          roastCount: 1,
          fairCount: roast.fairCount,
          funnyCount: roast.funnyCount,
          totalReactions: roast.fairCount + roast.funnyCount,
        });
      }
    }

    return [...roasters.values()]
      .sort((a, b) => b.totalReactions - a.totalReactions || b.roastCount - a.roastCount || a.profile.handle.localeCompare(b.profile.handle))
      .slice(0, normalizeRowCap(limit));
  }

  function listModerationActions(): ModerationAction[] {
    return clone([...state.moderationActions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  return {
    createProfile,
    createRoast,
    deleteProfile,
    exportProfile,
    getBook,
    getBookBySlug,
    getBookSummary,
    getBookSummaries,
    getProfile,
    getProfileByHandle,
    getRoast,
    getRoastsForBook,
    listBooks,
    getBooksByIds,
    getBookByProviderWorkId,
    listFeed,
    listReports,
    listRoasts,
    listRoastsByAuthor,
    moderateRoast,
    reportRoast,
    resolveReport,
    setBookmark,
    setFollow,
    setReaction,
    getUserReactionStates,
    isFollowing,
    listBookmarkedRoasts,
    searchBooks,
    findBookByIsbn,
    createCommunityBook,
    updateCommunityBook,
    deleteCommunityBook,
    listBottom100,
    listTopRoasters,
    upsertBook,
    updateRoast,
    listModerationActions,
  };
}

const globalStore = globalThis as typeof globalThis & { __badreadsStore?: ReturnType<typeof createMemoryStore> };
export const memoryStore = globalStore.__badreadsStore
  && typeof globalStore.__badreadsStore.getBook === "function"
  && typeof globalStore.__badreadsStore.listReports === "function"
  && typeof globalStore.__badreadsStore.resolveReport === "function"
  && typeof globalStore.__badreadsStore.findBookByIsbn === "function"
  && typeof globalStore.__badreadsStore.createCommunityBook === "function"
  && typeof globalStore.__badreadsStore.updateCommunityBook === "function"
  ? globalStore.__badreadsStore
  : createMemoryStore();
globalStore.__badreadsStore = memoryStore;
