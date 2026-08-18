/*
 * This data-access layer keeps the synchronous memory store available for
 * demos and unit tests while giving production pages an async Drizzle-backed
 * implementation. The public domain shapes stay independent of Postgres so
 * the same operations can later move behind an HTTP service.
 */

import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { db } from "@/src/db";
import * as schema from "@/src/db/schema";
import { isDemoMode } from "@/src/lib/runtime-config";
import { calculateBadnessSummary, composeFeed, validateRoastDraft, type FlawTag, type ReactionKind } from "./core";
import { createMemoryStore, memoryStore, type RoastInput, type StoreResult } from "./store";
import type { BookWork, Bottom100Item, Bottom100SortOption, ModerationAction, Profile, Report, ReportCategory, Roast, RoastStatus } from "./types";

type MemoryStore = ReturnType<typeof createMemoryStore>;
type Asyncify<T> = {
  [Key in keyof T]: T[Key] extends (...args: infer Arguments) => infer Result
    ? (...args: Arguments) => Promise<Result>
    : never;
};

export type DomainStore = Asyncify<MemoryStore>;
type Database = NeonHttpDatabase<typeof schema> | PostgresJsDatabase<typeof schema>;
type RoastRow = typeof schema.roasts.$inferSelect;
type ProfileRow = typeof schema.profiles.$inferSelect;
type BookRow = typeof schema.bookWorks.$inferSelect;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    userId: row.userId,
    handle: row.handle,
    displayName: row.displayName,
    bio: row.bio,
    ...(row.ageConfirmedAt ? { ageConfirmedAt: row.ageConfirmedAt.toISOString() } : {}),
  };
}

function coverToneFromMetadata(metadata: Record<string, unknown> | null) {
  const value = metadata?.coverTone;
  return value === "coral" || value === "acid" || value === "lavender" || value === "ink" ? value : "acid";
}

function mapBook(row: BookRow): BookWork {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    authors: row.authors,
    firstPublished: row.firstPublished,
    description: row.description ?? "",
    coverTone: coverToneFromMetadata(row.metadata),
    sourceId: row.providerWorkId,
    coverUrl: row.coverUrl ?? undefined,
  };
}

function mapRoast(row: RoastRow, author: Profile): Roast {
  return {
    id: row.id,
    bookId: row.bookWorkId,
    authorId: row.authorProfileId,
    author,
    hook: row.hook,
    body: row.body,
    rating: row.rating as Roast["rating"],
    flawTags: row.flawTags as Roast["flawTags"],
    spoiler: row.spoiler,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    fairCount: row.fairCount,
    funnyCount: row.funnyCount,
    bookmarkCount: row.bookmarkCount,
    status: row.status,
  };
}

function mapReport(row: typeof schema.reports.$inferSelect): Report {
  return {
    id: row.id,
    roastId: row.roastId,
    reporterId: row.reporterProfileId,
    category: row.category as ReportCategory,
    note: row.note ?? undefined,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

function databaseFailure(error: unknown, fallback: StoreResult<never>): StoreResult<never> {
  /*
   * Unique indexes are the final race-safe guard for one-roast-per-book and
   * public handles. Convert those database conflicts into the same stable
   * result used by the memory implementation instead of leaking driver text.
   */
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("unique") || message.includes("duplicate")) {
    return { ok: false, code: "CONFLICT", message: "That record already exists." };
  }
  return fallback;
}

function createMemoryDomainStore(): DomainStore {
  const store = memoryStore;
  return {
    createProfile: async (...args) => store.createProfile(...args),
    createRoast: async (...args) => store.createRoast(...args),
    deleteProfile: async (...args) => store.deleteProfile(...args),
    exportProfile: async (...args) => store.exportProfile(...args),
    getBook: async (...args) => store.getBook(...args),
    getBookBySlug: async (...args) => store.getBookBySlug(...args),
    getBookSummary: async (...args) => store.getBookSummary(...args),
    getProfile: async (...args) => store.getProfile(...args),
    getProfileByHandle: async (...args) => store.getProfileByHandle(...args),
    getRoast: async (...args) => store.getRoast(...args),
    getRoastsForBook: async (...args) => store.getRoastsForBook(...args),
    listBooks: async (...args) => store.listBooks(...args),
    listFeed: async (...args) => store.listFeed(...args),
    listReports: async (...args) => store.listReports(...args),
    listRoasts: async (...args) => store.listRoasts(...args),
    moderateRoast: async (...args) => store.moderateRoast(...args),
    reportRoast: async (...args) => store.reportRoast(...args),
    resolveReport: async (...args) => store.resolveReport(...args),
    setBookmark: async (...args) => store.setBookmark(...args),
    setFollow: async (...args) => store.setFollow(...args),
    setReaction: async (...args) => store.setReaction(...args),
    getUserReactionStates: async (...args) => store.getUserReactionStates(...args),
    isFollowing: async (...args) => store.isFollowing(...args),
    listBookmarkedRoasts: async (...args) => store.listBookmarkedRoasts(...args),
    searchBooks: async (...args) => store.searchBooks(...args),
    listBottom100: async (...args) => store.listBottom100(...args),
    upsertBook: async (...args) => store.upsertBook(...args),
    updateRoast: async (...args) => store.updateRoast(...args),
    listModerationActions: async (...args) => store.listModerationActions(...args),
  };
}

function createPostgresStore(database: Database): DomainStore {
  async function findProfile(id: string) {
    /* Better Auth IDs are opaque text and are not guaranteed to be UUIDs. Query
     * the text user_id first, then touch the UUID column only for UUID-shaped
     * profile identifiers so PostgreSQL never has to cast arbitrary input. */
    const [byUserId] = await database.select().from(schema.profiles).where(eq(schema.profiles.userId, id)).limit(1);
    if (byUserId) return byUserId;
    if (!UUID_PATTERN.test(id)) return undefined;
    const [byProfileId] = await database.select().from(schema.profiles).where(eq(schema.profiles.id, id)).limit(1);
    return byProfileId;
  }

  async function findRoastWithAuthor(id: string) {
    if (!UUID_PATTERN.test(id)) return undefined;
    const [row] = await database
      .select({ roast: schema.roasts, profile: schema.profiles })
      .from(schema.roasts)
      .innerJoin(schema.profiles, eq(schema.profiles.id, schema.roasts.authorProfileId))
      .where(eq(schema.roasts.id, id))
      .limit(1);
    return row;
  }

  function findRoastsWithAuthors(where?: SQL) {
    const query = database
      .select({ roast: schema.roasts, profile: schema.profiles })
      .from(schema.roasts)
      .innerJoin(schema.profiles, eq(schema.profiles.id, schema.roasts.authorProfileId));
    return where ? query.where(where) : query;
  }

  function mapJoinedRoast(row: { roast: RoastRow; profile: ProfileRow }) {
    return mapRoast(row.roast, mapProfile(row.profile));
  }

  async function getRoast(id: string) {
    const row = await findRoastWithAuthor(id);
    return row ? mapJoinedRoast(row) : undefined;
  }

  async function getProfile(id: string) {
    const row = await findProfile(id);
    return row ? mapProfile(row) : undefined;
  }

  async function listRoasts() {
    const rows = await findRoastsWithAuthors();
    return rows.map(mapJoinedRoast);
  }

  async function createProfile(input: Omit<Profile, "id">) {
    try {
      const existing = await database
        .select({ id: schema.profiles.id })
        .from(schema.profiles)
        .where(or(eq(schema.profiles.userId, input.userId ?? ""), sql`lower(${schema.profiles.handle}) = lower(${input.handle})`))
        .limit(1);
      if (existing.length) return { ok: false as const, code: "CONFLICT" as const, message: "That handle or account is already in use." };

      const [row] = await database.insert(schema.profiles).values({
        userId: input.userId ?? "",
        handle: input.handle,
        displayName: input.displayName,
        bio: input.bio,
        ageConfirmedAt: input.ageConfirmedAt ? new Date(input.ageConfirmedAt) : null,
      }).returning();
      return row
        ? { ok: true as const, data: mapProfile(row) }
        : { ok: false as const, code: "NOT_FOUND" as const, message: "Unable to create that profile." };
    } catch (error) {
      return databaseFailure(error, { ok: false, code: "CONFLICT", message: "That handle or account is already in use." });
    }
  }

  async function createRoast(input: RoastInput) {
    const profile = await findProfile(input.userId);
    if (!profile) return { ok: false as const, code: "NOT_FOUND" as const, message: "That book or profile was not found." };
    if (!UUID_PATTERN.test(input.bookId)) return { ok: false as const, code: "NOT_FOUND" as const, message: "That book or profile was not found." };
    const [book] = await database.select().from(schema.bookWorks).where(eq(schema.bookWorks.id, input.bookId)).limit(1);
    if (!book) return { ok: false as const, code: "NOT_FOUND" as const, message: "That book or profile was not found." };
    const existing = await database.select({ id: schema.roasts.id }).from(schema.roasts).where(and(eq(schema.roasts.authorProfileId, profile.id), eq(schema.roasts.bookWorkId, book.id))).limit(1);
    if (existing.length) return { ok: false as const, code: "CONFLICT" as const, message: "You already roasted this book." };
    const validation = validateRoastDraft(input);
    if (!validation.success) return { ok: false as const, code: "VALIDATION_ERROR" as const, message: validation.errors.join(" ") };
    const approved = await database.select({ id: schema.roasts.id }).from(schema.roasts).where(and(eq(schema.roasts.authorProfileId, profile.id), eq(schema.roasts.status, "PUBLISHED"))).limit(1);
    try {
      const [row] = await database.insert(schema.roasts).values({
        bookWorkId: book.id,
        authorProfileId: profile.id,
        hook: validation.data.hook,
        body: validation.data.body,
        rating: validation.data.rating,
        flawTags: validation.data.flawTags,
        spoiler: input.spoiler,
        status: approved.length ? "PUBLISHED" : "PENDING_REVIEW",
      }).returning();
      return row
        ? { ok: true as const, data: mapRoast(row, mapProfile(profile)) }
        : { ok: false as const, code: "NOT_FOUND" as const, message: "Unable to save that roast." };
    } catch (error) {
      return databaseFailure(error, { ok: false, code: "CONFLICT", message: "You already roasted this book." });
    }
  }

  async function updateRoast(input: RoastInput & { roastId: string; expectedUpdatedAt?: string }) {
    const existing = await findRoastWithAuthor(input.roastId);
    if (!existing) return { ok: false as const, code: "NOT_FOUND" as const, message: "That roast was not found." };
    const profile = await findProfile(input.userId);
    if (!profile || existing.roast.authorProfileId !== profile.id) return { ok: false as const, code: "FORBIDDEN" as const, message: "You can only edit your own roast." };
    if (input.expectedUpdatedAt && existing.roast.updatedAt.toISOString() !== input.expectedUpdatedAt) return { ok: false as const, code: "CONFLICT" as const, message: "This roast changed in another tab. Reload it before editing." };
    const validation = validateRoastDraft(input);
    if (!validation.success) return { ok: false as const, code: "VALIDATION_ERROR" as const, message: validation.errors.join(" ") };
    const updatedAt = new Date();
    const conditions = [eq(schema.roasts.id, input.roastId), eq(schema.roasts.authorProfileId, profile.id)];
    if (input.expectedUpdatedAt) conditions.push(eq(schema.roasts.updatedAt, new Date(input.expectedUpdatedAt)));
    const [row] = await database.update(schema.roasts).set({
      hook: validation.data.hook,
      body: validation.data.body,
      rating: validation.data.rating,
      flawTags: validation.data.flawTags,
      spoiler: input.spoiler,
      updatedAt,
    }).where(and(...conditions)).returning();
    if (!row) return { ok: false as const, code: "CONFLICT" as const, message: "This roast changed in another tab. Reload it before editing." };
    return { ok: true as const, data: mapRoast(row, mapProfile(profile)) };
  }

  async function setReaction(input: { roastId: string; userId: string; kind: ReactionKind; active: boolean }) {
    const roast = await findRoastWithAuthor(input.roastId);
    if (!roast) return { ok: false as const, code: "NOT_FOUND" as const, message: "That roast was not found." };
    if (roast.roast.status !== "PUBLISHED") return { ok: false as const, code: "FORBIDDEN" as const, message: "Only published roasts can receive reactions." };
    const profile = await findProfile(input.userId);
    if (!profile) return { ok: false as const, code: "NOT_FOUND" as const, message: "That reviewer was not found." };
    if (input.active) {
      const inserted = await database.insert(schema.reactions).values({ roastId: input.roastId, profileId: profile.id, kind: input.kind }).onConflictDoNothing().returning();
      if (inserted.length) {
        await database.update(schema.roasts).set({
          fairCount: input.kind === "FAIR" ? sql`${schema.roasts.fairCount} + 1` : schema.roasts.fairCount,
          funnyCount: input.kind === "FUNNY" ? sql`${schema.roasts.funnyCount} + 1` : schema.roasts.funnyCount,
        }).where(eq(schema.roasts.id, input.roastId));
      }
    } else {
      const removed = await database.delete(schema.reactions).where(and(eq(schema.reactions.roastId, input.roastId), eq(schema.reactions.profileId, profile.id), eq(schema.reactions.kind, input.kind))).returning();
      if (removed.length) {
        await database.update(schema.roasts).set({
          fairCount: input.kind === "FAIR" ? sql`greatest(0, ${schema.roasts.fairCount} - 1)` : schema.roasts.fairCount,
          funnyCount: input.kind === "FUNNY" ? sql`greatest(0, ${schema.roasts.funnyCount} - 1)` : schema.roasts.funnyCount,
        }).where(eq(schema.roasts.id, input.roastId));
      }
    }
    const updated = await getRoast(input.roastId);
    return updated ? { ok: true as const, data: updated } : { ok: false as const, code: "NOT_FOUND" as const, message: "That roast was not found." };
  }

  async function setBookmark(input: { userId: string; roastId: string; active: boolean }) {
    const roast = await findRoastWithAuthor(input.roastId);
    if (!roast) return { ok: false as const, code: "NOT_FOUND" as const, message: "That roast was not found." };
    if (roast.roast.status !== "PUBLISHED") return { ok: false as const, code: "FORBIDDEN" as const, message: "Only published roasts can be bookmarked." };
    const profile = await findProfile(input.userId);
    if (!profile) return { ok: false as const, code: "NOT_FOUND" as const, message: "That reviewer was not found." };
    if (input.active) {
      const inserted = await database.insert(schema.bookmarks).values({ roastId: input.roastId, profileId: profile.id }).onConflictDoNothing().returning();
      if (inserted.length) await database.update(schema.roasts).set({ bookmarkCount: sql`${schema.roasts.bookmarkCount} + 1` }).where(eq(schema.roasts.id, input.roastId));
    } else {
      const removed = await database.delete(schema.bookmarks).where(and(eq(schema.bookmarks.roastId, input.roastId), eq(schema.bookmarks.profileId, profile.id))).returning();
      if (removed.length) await database.update(schema.roasts).set({ bookmarkCount: sql`greatest(0, ${schema.roasts.bookmarkCount} - 1)` }).where(eq(schema.roasts.id, input.roastId));
    }
    const updated = await getRoast(input.roastId);
    return updated ? { ok: true as const, data: updated } : { ok: false as const, code: "NOT_FOUND" as const, message: "That roast was not found." };
  }

  async function setFollow(input: { followerId: string; followeeId: string; active: boolean }) {
    const follower = await findProfile(input.followerId);
    const followee = await findProfile(input.followeeId);
    if (!follower || !followee) return { ok: false as const, code: "NOT_FOUND" as const, message: "That reviewer was not found." };
    if (follower.id === followee.id) return { ok: false as const, code: "CONFLICT" as const, message: "You cannot follow yourself." };
    if (input.active) {
      await database.insert(schema.follows).values({ followerProfileId: follower.id, followeeProfileId: followee.id }).onConflictDoNothing();
    } else {
      await database.delete(schema.follows).where(and(eq(schema.follows.followerProfileId, follower.id), eq(schema.follows.followeeProfileId, followee.id)));
    }
    const [row] = await database.select().from(schema.follows).where(and(eq(schema.follows.followerProfileId, follower.id), eq(schema.follows.followeeProfileId, followee.id))).limit(1);
    return { ok: true as const, data: { active: Boolean(row) } };
  }

  async function reportRoast(input: { roastId: string; reporterId: string; category: ReportCategory; note?: string }) {
    const roast = await findRoastWithAuthor(input.roastId);
    if (!roast) return { ok: false as const, code: "NOT_FOUND" as const, message: "That roast was not found." };
    if (roast.roast.status !== "PUBLISHED") return { ok: false as const, code: "FORBIDDEN" as const, message: "Only published roasts can be reported." };
    const reporter = await findProfile(input.reporterId);
    if (!reporter) return { ok: false as const, code: "NOT_FOUND" as const, message: "That reviewer was not found." };
    const duplicate = await database.select({ id: schema.reports.id }).from(schema.reports).where(and(eq(schema.reports.roastId, input.roastId), eq(schema.reports.reporterProfileId, reporter.id))).limit(1);
    if (duplicate.length) return { ok: false as const, code: "CONFLICT" as const, message: "You already reported this roast." };
    try {
      const [row] = await database.insert(schema.reports).values({ roastId: input.roastId, reporterProfileId: reporter.id, category: input.category, note: input.note }).returning();
      const openReports = await database.select({ id: schema.reports.id }).from(schema.reports).where(and(eq(schema.reports.roastId, input.roastId), eq(schema.reports.status, "OPEN")));
      if (openReports.length >= 3) await database.update(schema.roasts).set({ status: "REMOVED", updatedAt: new Date() }).where(eq(schema.roasts.id, input.roastId));
      return row
        ? { ok: true as const, data: mapReport(row) }
        : { ok: false as const, code: "NOT_FOUND" as const, message: "Unable to save that report." };
    } catch (error) {
      return databaseFailure(error, { ok: false, code: "CONFLICT", message: "You already reported this roast." });
    }
  }

  async function moderateRoast(input: { roastId: string; moderatorId: string; decision: ModerationAction["decision"]; note?: string }) {
    const roast = await findRoastWithAuthor(input.roastId);
    if (!roast) return { ok: false as const, code: "NOT_FOUND" as const, message: "That roast was not found." };
    const nextStatus: Record<ModerationAction["decision"], RoastStatus | null> = {
      APPROVE: "PUBLISHED", REJECT: "REJECTED", RESTORE: "PUBLISHED", REMOVE: "REMOVED", WARN: null, SUSPEND: null, BAN: null,
    };
    const status = nextStatus[input.decision];
    if (status !== null) await database.update(schema.roasts).set({ status, updatedAt: new Date() }).where(eq(schema.roasts.id, input.roastId));
    const [action] = await database.insert(schema.moderationActions).values({ roastId: input.roastId, moderatorUserId: input.moderatorId, decision: input.decision, note: input.note }).returning();
    const updated = await getRoast(input.roastId);
    return updated && action ? { ok: true as const, data: updated } : { ok: false as const, code: "NOT_FOUND" as const, message: "Unable to record that moderation action." };
  }

  async function resolveReport(input: { reportId: string; moderatorId: string; status: "UPHELD" | "DISMISSED"; note?: string }) {
    if (!UUID_PATTERN.test(input.reportId)) return { ok: false as const, code: "NOT_FOUND" as const, message: "That report was not found." };
    const [report] = await database.select().from(schema.reports).where(eq(schema.reports.id, input.reportId)).limit(1);
    if (!report) return { ok: false as const, code: "NOT_FOUND" as const, message: "That report was not found." };
    if (report.status !== "OPEN") return { ok: false as const, code: "CONFLICT" as const, message: "That report has already been resolved." };
    const [updated] = await database.update(schema.reports).set({ status: input.status }).where(and(eq(schema.reports.id, input.reportId), eq(schema.reports.status, "OPEN"))).returning();
    const [action] = await database.insert(schema.moderationActions).values({ roastId: report.roastId, moderatorUserId: input.moderatorId, decision: input.status === "UPHELD" ? "REMOVE" : "WARN", note: input.note }).returning();
    if (input.status === "UPHELD") await database.update(schema.roasts).set({ status: "REMOVED", updatedAt: new Date() }).where(eq(schema.roasts.id, report.roastId));
    return updated && action ? { ok: true as const, data: mapReport(updated) } : { ok: false as const, code: "CONFLICT" as const, message: "That report has already been resolved." };
  }

  async function upsertBook(input: BookWork) {
    const provider = "openlibrary";
    const providerWorkId = input.sourceId ?? input.id;
    const metadata = { coverTone: input.coverTone };
    const [existing] = await database.select().from(schema.bookWorks).where(or(and(eq(schema.bookWorks.provider, provider), eq(schema.bookWorks.providerWorkId, providerWorkId)), eq(schema.bookWorks.slug, input.slug))).limit(1);
    if (existing) {
      const [updated] = await database.update(schema.bookWorks).set({ slug: input.slug, title: input.title, authors: input.authors, firstPublished: input.firstPublished, description: input.description, coverUrl: input.coverUrl ?? existing.coverUrl, metadata, updatedAt: new Date() }).where(eq(schema.bookWorks.id, existing.id)).returning();
      const book = mapBook(updated ?? existing);
      await database.insert(schema.bookIdentifiers).values({ bookWorkId: book.id, scheme: "OPEN_LIBRARY_WORK", value: providerWorkId }).onConflictDoNothing();
      return book;
    }
    try {
      const [row] = await database.insert(schema.bookWorks).values({ provider, providerWorkId, slug: input.slug, title: input.title, authors: input.authors, firstPublished: input.firstPublished, description: input.description, coverUrl: input.coverUrl ?? null, metadata }).returning();
      if (!row) return input;
      const book = mapBook(row);
      await database.insert(schema.bookIdentifiers).values({ bookWorkId: book.id, scheme: "OPEN_LIBRARY_WORK", value: providerWorkId }).onConflictDoNothing();
      return book;
    } catch (error) {
      const [conflict] = await database.select().from(schema.bookWorks).where(and(eq(schema.bookWorks.provider, provider), eq(schema.bookWorks.providerWorkId, providerWorkId))).limit(1);
      if (conflict) {
        const book = mapBook(conflict);
        await database.insert(schema.bookIdentifiers).values({ bookWorkId: book.id, scheme: "OPEN_LIBRARY_WORK", value: providerWorkId }).onConflictDoNothing();
        return book;
      }
      throw error;
    }
  }

  async function getBook(id: string) {
    if (!UUID_PATTERN.test(id)) return undefined;
    const [row] = await database.select().from(schema.bookWorks).where(eq(schema.bookWorks.id, id)).limit(1);
    return row ? mapBook(row) : undefined;
  }

  async function getBookBySlug(slug: string) {
    const [row] = await database.select().from(schema.bookWorks).where(eq(schema.bookWorks.slug, slug)).limit(1);
    return row ? mapBook(row) : undefined;
  }

  async function listBooks() {
    const rows = await database.select().from(schema.bookWorks).orderBy(schema.bookWorks.title);
    return rows.map(mapBook);
  }
  async function searchBooks(query: string, limit = 20) {
    const clean = query.trim();
    if (!clean) return [];
    const pattern = `%${clean}%`;
    const rows = await database
      .select()
      .from(schema.bookWorks)
      .where(
        or(
          ilike(schema.bookWorks.title, pattern),
          ilike(schema.bookWorks.slug, pattern),
          ilike(schema.bookWorks.providerWorkId, pattern),
          sql`${schema.bookWorks.authors}::text ILIKE ${pattern}`,
        ),
      )
      .limit(limit);
    return rows.map(mapBook);
  }

  async function getBookSummary(bookId: string) {
    if (!UUID_PATTERN.test(bookId)) return { average: null, count: 0, worstCount: 0, flawCounts: calculateBadnessSummary([]).flawCounts };
    const rows = await database
      .select({ rating: schema.roasts.rating, flawTags: schema.roasts.flawTags })
      .from(schema.roasts)
      .where(and(eq(schema.roasts.bookWorkId, bookId), eq(schema.roasts.status, "PUBLISHED")));
    return calculateBadnessSummary(
      rows.map((row) => ({
        rating: row.rating as Roast["rating"],
        flawTags: (row.flawTags as FlawTag[]) ?? [],
      })),
    );
  }

  async function getUserReactionStates(userId: string, roastIds: string[]): Promise<Record<string, { fair: boolean; funny: boolean; bookmarked: boolean }>> {
    const result: Record<string, { fair: boolean; funny: boolean; bookmarked: boolean }> = {};
    for (const roastId of roastIds) {
      result[roastId] = { fair: false, funny: false, bookmarked: false };
    }
    if (!userId || roastIds.length === 0) return result;
    const profile = await findProfile(userId);
    if (!profile) return result;

    const validRoastIds = roastIds.filter((id) => UUID_PATTERN.test(id));
    if (validRoastIds.length === 0) return result;

    const [userReactions, userBookmarks] = await Promise.all([
      database
        .select({ roastId: schema.reactions.roastId, kind: schema.reactions.kind })
        .from(schema.reactions)
        .where(
          and(
            eq(schema.reactions.profileId, profile.id),
            sql`${schema.reactions.roastId} IN (${sql.join(validRoastIds.map((id) => sql`${id}`), sql`, `)})`,
          ),
        ),
      database
        .select({ roastId: schema.bookmarks.roastId })
        .from(schema.bookmarks)
        .where(
          and(
            eq(schema.bookmarks.profileId, profile.id),
            sql`${schema.bookmarks.roastId} IN (${sql.join(validRoastIds.map((id) => sql`${id}`), sql`, `)})`,
          ),
        ),
    ]);

    for (const rx of userReactions) {
      if (result[rx.roastId]) {
        if (rx.kind === "FAIR") result[rx.roastId].fair = true;
        if (rx.kind === "FUNNY") result[rx.roastId].funny = true;
      }
    }
    for (const bm of userBookmarks) {
      if (result[bm.roastId]) {
        result[bm.roastId].bookmarked = true;
      }
    }
    return result;
  }

  async function isFollowing(followerUserId: string, followeeProfileId: string): Promise<boolean> {
    if (!followerUserId || !followeeProfileId) return false;
    const follower = await findProfile(followerUserId);
    if (!follower) return false;
    if (!UUID_PATTERN.test(follower.id) || !UUID_PATTERN.test(followeeProfileId)) return false;
    const [row] = await database
      .select({ followerProfileId: schema.follows.followerProfileId })
      .from(schema.follows)
      .where(and(eq(schema.follows.followerProfileId, follower.id), eq(schema.follows.followeeProfileId, followeeProfileId)))
      .limit(1);
    return Boolean(row);
  }

  async function listBookmarkedRoasts(userId: string): Promise<Roast[]> {
    const profile = await findProfile(userId);
    if (!profile) return [];
    const bookmarkedRows = await database
      .select({ roastId: schema.bookmarks.roastId })
      .from(schema.bookmarks)
      .where(eq(schema.bookmarks.profileId, profile.id));
    const roastIds = bookmarkedRows.map((r) => r.roastId).filter((id) => UUID_PATTERN.test(id));
    if (roastIds.length === 0) return [];

    const rows = await findRoastsWithAuthors(
      and(
        eq(schema.roasts.status, "PUBLISHED"),
        sql`${schema.roasts.id} IN (${sql.join(roastIds.map((id) => sql`${id}`), sql`, `)})`,
      ),
    ).orderBy(desc(schema.roasts.createdAt));

    return rows.map(mapJoinedRoast);
  }

  async function getRoastsForBook(bookId: string) {
    if (!UUID_PATTERN.test(bookId)) return [];
    const rows = await findRoastsWithAuthors(and(eq(schema.roasts.bookWorkId, bookId), eq(schema.roasts.status, "PUBLISHED"))).orderBy(desc(schema.roasts.createdAt));
    return rows.map(mapJoinedRoast);
  }

  async function listFeed(viewerId?: string) {
    const viewer = viewerId ? await findProfile(viewerId) : undefined;
    const followed = viewer
      ? await database.select({ id: schema.follows.followeeProfileId }).from(schema.follows).where(eq(schema.follows.followerProfileId, viewer.id))
      : [];
    const followedIds = new Set(followed.map((row) => row.id));
    const rows = await findRoastsWithAuthors(eq(schema.roasts.status, "PUBLISHED")).orderBy(desc(schema.roasts.createdAt));
    const now = Date.now();
    const discovery = rows
      .map(mapJoinedRoast)
      .filter((roast) => !followedIds.has(roast.authorId))
      .filter((roast) => now - new Date(roast.createdAt).getTime() <= 14 * 24 * 60 * 60 * 1000)
      .sort((a, b) => (2 * b.fairCount + b.funnyCount + 2 * b.bookmarkCount) - (2 * a.fairCount + a.funnyCount + 2 * a.bookmarkCount) || b.createdAt.localeCompare(a.createdAt));
    const following = rows.map(mapJoinedRoast).filter((roast) => followedIds.has(roast.authorId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return composeFeed({ following, discovery });
  }

  async function listReports() {
    const rows = await database.select().from(schema.reports).orderBy(desc(schema.reports.createdAt));
    return rows.map(mapReport);
  }

  async function exportProfile(userId: string) {
    const profile = await getProfile(userId);
    if (!profile) return { ok: false as const, code: "NOT_FOUND" as const, message: "That profile was not found." };
    const roasts = (await listRoasts()).filter((roast) => roast.authorId === profile.id);
    return { ok: true as const, data: { profile, roasts } };
  }

  async function deleteProfile(userId: string) {
    const profile = await findProfile(userId);
    if (!profile) return { ok: false as const, code: "NOT_FOUND" as const, message: "That profile was not found." };
    const [user] = await database.select().from(schema.users).where(eq(schema.users.id, profile.userId ?? "")).limit(1);
    const [deleted] = await database.delete(schema.profiles).where(eq(schema.profiles.id, profile.id)).returning();
    if (deleted && user) {
      /* Remove credentials and personal identifiers while retaining any audit
       * rows that point at this moderator user. Public profile data and
       * score-bearing roasts are removed through the profile cascade above;
       * the login identity is also explicitly marked unverified. */
      await database.delete(schema.sessions).where(eq(schema.sessions.userId, user.id));
      await database.delete(schema.accounts).where(eq(schema.accounts.userId, user.id));
      await database.delete(schema.verifications).where(eq(schema.verifications.identifier, user.email));
      await database.update(schema.users).set({
        name: "Deleted reader",
        email: `deleted-${user.id}-${Date.now()}@invalid.badreads.local`,
        emailVerified: false,
        image: null,
        status: "DELETED",
        updatedAt: new Date(),
      }).where(eq(schema.users.id, user.id));
    }
    return deleted ? { ok: true as const, data: { deleted: true } } : { ok: false as const, code: "NOT_FOUND" as const, message: "That profile was not found." };
  }
  async function listBottom100(sort: Bottom100SortOption = "shuffle"): Promise<Bottom100Item[]> {
    const publishedRoasts = await findRoastsWithAuthors(eq(schema.roasts.status, "PUBLISHED")).orderBy(desc(schema.roasts.createdAt));
    const roasts = publishedRoasts.map(mapJoinedRoast);

    const roastsByBook = new Map<string, Roast[]>();
    for (const roast of roasts) {
      const list = roastsByBook.get(roast.bookId) ?? [];
      list.push(roast);
      roastsByBook.set(roast.bookId, list);
    }

    const bookIds = Array.from(roastsByBook.keys()).filter((id) => UUID_PATTERN.test(id));
    if (bookIds.length === 0) return [];

    const bookRows = await database
      .select()
      .from(schema.bookWorks)
      .where(sql`${schema.bookWorks.id} IN (${sql.join(bookIds.map((id) => sql`${id}`), sql`, `)})`);
    const books = bookRows.map(mapBook);
    const candidates: Array<{
      book: BookWork;
      summary: { average: number | null; count: number; worstCount: number };
      weightedScore: number;
      topRoasts: Roast[];
    }> = [];

    for (const book of books) {
      const bookRoasts = roastsByBook.get(book.id) ?? [];
      if (bookRoasts.length === 0) continue;

      const count = bookRoasts.length;
      const worstCount = bookRoasts.filter((r) => r.rating === 5).length;
      const average = count > 0 ? Number((bookRoasts.reduce((acc, r) => acc + r.rating, 0) / count).toFixed(1)) : null;
      const weightedScore = average !== null
        ? Number(((count * average + 2 * 3.0) / (count + 2)).toFixed(2))
        : 0;

      const topRoasts = [...bookRoasts]
        .sort((a, b) => (2 * b.fairCount + b.funnyCount) - (2 * a.fairCount + a.funnyCount) || b.rating - a.rating)
        .slice(0, 5);

      candidates.push({
        book,
        summary: { average, count, worstCount },
        weightedScore,
        topRoasts,
      });
    }

    candidates.sort((a, b) => {
      const aQualified = a.summary.count >= 3 ? 1 : 0;
      const bQualified = b.summary.count >= 3 ? 1 : 0;
      if (aQualified !== bQualified) return bQualified - aQualified;
      return b.weightedScore - a.weightedScore || b.summary.count - a.summary.count;
    });

    const ranked: Bottom100Item[] = candidates.slice(0, 100).map((item, index) => ({
      rank: index + 1,
      book: item.book,
      summary: item.summary,
      weightedScore: item.weightedScore,
      topRoasts: item.topRoasts,
    }));

    if (sort === "badness") return ranked;
    if (sort === "roasts") return [...ranked].sort((a, b) => b.summary.count - a.summary.count || a.rank - b.rank);
    if (sort === "title") return [...ranked].sort((a, b) => a.book.title.localeCompare(b.book.title));

    const shuffled = [...ranked];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  async function listModerationActions(): Promise<ModerationAction[]> {
    const rows = await database.select().from(schema.moderationActions).orderBy(desc(schema.moderationActions.createdAt));
    return rows.map((row) => ({
      id: row.id,
      roastId: row.roastId,
      moderatorId: row.moderatorUserId,
      decision: row.decision as ModerationAction["decision"],
      note: row.note ?? undefined,
      createdAt: row.createdAt.toISOString(),
    }));
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
    getProfileByHandle: async (handle: string) => {
      const [row] = await database.select().from(schema.profiles).where(ilike(schema.profiles.handle, handle)).limit(1);
      return row ? mapProfile(row) : undefined;
    },
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
    getUserReactionStates,
    isFollowing,
    listBookmarkedRoasts,
    upsertBook,
    searchBooks,
    listBottom100,
    updateRoast,
    listModerationActions,
  } as DomainStore;
}

const globalRepositoryState = globalThis as typeof globalThis & {
  __badreadsAsyncMemoryStore?: DomainStore;
  __badreadsPostgresStore?: DomainStore;
};

const asyncMemoryStore = globalRepositoryState.__badreadsAsyncMemoryStore ?? createMemoryDomainStore();
globalRepositoryState.__badreadsAsyncMemoryStore = asyncMemoryStore;

export function getDomainStore(): DomainStore {
  if (isDemoMode() || !db) return asyncMemoryStore;
  if (!globalRepositoryState.__badreadsPostgresStore) {
    globalRepositoryState.__badreadsPostgresStore = createPostgresStore(db);
  }
  return globalRepositoryState.__badreadsPostgresStore;
}

export function createPostgresDomainStore(database: Database): DomainStore {
  return createPostgresStore(database);
}
