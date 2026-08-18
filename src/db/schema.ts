/*
 * The schema keeps auth, canonical work metadata, user-generated roasts, and
 * moderation records in one Postgres boundary. Every public relationship has
 * an explicit uniqueness constraint so retries cannot create duplicate votes,
 * follows, bookmarks, or score-bearing reviews.
 */

import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["MEMBER", "MODERATOR", "ADMIN"]);
export const userStatus = pgEnum("user_status", ["ACTIVE", "SUSPENDED", "BANNED", "DELETED"]);
export const roastStatus = pgEnum("roast_status", ["PENDING_REVIEW", "PUBLISHED", "REJECTED", "REMOVED"]);
export const reactionKind = pgEnum("reaction_kind", ["FAIR", "FUNNY"]);
export const reportCategory = pgEnum("report_category", ["PERSONAL_ATTACK", "HATE", "SPOILER", "SPAM", "COPYRIGHT", "OTHER"]);
export const reportStatus = pgEnum("report_status", ["OPEN", "UPHELD", "DISMISSED"]);

export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  role: userRole("role").notNull().default("MEMBER"),
  status: userStatus("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ emailIndex: uniqueIndex("user_email_idx").on(table.email) }));

export const sessions = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (table) => ({ tokenIndex: uniqueIndex("session_token_idx").on(table.token) }));

export const accounts = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verifications = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const profiles = pgTable("profile", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  handle: text("handle").notNull(),
  displayName: text("display_name").notNull(),
  bio: text("bio").notNull().default(""),
  ageConfirmedAt: timestamp("age_confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ handleIndex: uniqueIndex("profile_handle_idx").on(table.handle), userIndex: uniqueIndex("profile_user_idx").on(table.userId) }));

export const bookWorks = pgTable("book_work", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: text("provider").notNull(),
  providerWorkId: text("provider_work_id").notNull(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  authors: jsonb("authors").$type<string[]>().notNull(),
  firstPublished: integer("first_published"),
  description: text("description"),
  coverUrl: text("cover_url"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ providerWorkIndex: uniqueIndex("book_provider_work_idx").on(table.provider, table.providerWorkId), slugIndex: uniqueIndex("book_slug_idx").on(table.slug) }));

export const bookIdentifiers = pgTable("book_identifier", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookWorkId: uuid("book_work_id").notNull().references(() => bookWorks.id, { onDelete: "cascade" }),
  scheme: text("scheme").notNull(),
  value: text("value").notNull(),
}, (table) => ({ identifierIndex: uniqueIndex("book_identifier_idx").on(table.scheme, table.value) }));

export const roasts = pgTable("roast", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookWorkId: uuid("book_work_id").notNull().references(() => bookWorks.id, { onDelete: "cascade" }),
  authorProfileId: uuid("author_profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  hook: text("hook").notNull(),
  body: text("body").notNull(),
  rating: integer("rating").notNull(),
  flawTags: text("flaw_tags").array().notNull(),
  spoiler: boolean("spoiler").notNull().default(false),
  status: roastStatus("status").notNull().default("PENDING_REVIEW"),
  fairCount: integer("fair_count").notNull().default(0),
  funnyCount: integer("funny_count").notNull().default(0),
  bookmarkCount: integer("bookmark_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ onePerBook: uniqueIndex("roast_author_book_idx").on(table.authorProfileId, table.bookWorkId) }));

export const reactions = pgTable("reaction", {
  roastId: uuid("roast_id").notNull().references(() => roasts.id, { onDelete: "cascade" }),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  kind: reactionKind("kind").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ primaryKey: primaryKey({ columns: [table.roastId, table.profileId, table.kind] }) }));

export const bookmarks = pgTable("bookmark", {
  roastId: uuid("roast_id").notNull().references(() => roasts.id, { onDelete: "cascade" }),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ primaryKey: primaryKey({ columns: [table.roastId, table.profileId] }) }));

export const follows = pgTable("follow", {
  followerProfileId: uuid("follower_profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  followeeProfileId: uuid("followee_profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({ primaryKey: primaryKey({ columns: [table.followerProfileId, table.followeeProfileId] }) }));

export const reports = pgTable("report", {
  id: uuid("id").defaultRandom().primaryKey(),
  roastId: uuid("roast_id").notNull().references(() => roasts.id, { onDelete: "cascade" }),
  reporterProfileId: uuid("reporter_profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  category: reportCategory("category").notNull(),
  note: text("note"),
  status: reportStatus("status").notNull().default("OPEN"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const moderationActions = pgTable("moderation_action", {
  id: uuid("id").defaultRandom().primaryKey(),
  roastId: uuid("roast_id").notNull().references(() => roasts.id, { onDelete: "cascade" }),
  moderatorUserId: text("moderator_user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  decision: text("decision").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const analyticsEvents = pgTable("analytics_event", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id").references(() => profiles.id, { onDelete: "set null" }),
  eventName: text("event_name").notNull(),
  properties: jsonb("properties").$type<Record<string, unknown>>().notNull().default({}),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rateLimitBuckets = pgTable("rate_limit_bucket", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
});
