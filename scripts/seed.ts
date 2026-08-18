import "dotenv/config";

import { sql } from "drizzle-orm";
import { db } from "@/src/db";
import {
  bookIdentifiers,
  bookWorks,
  follows,
  profiles,
  roasts,
  users,
} from "@/src/db/schema";
import { launchSeed } from "@/src/data/launch-seed";

/*
 * The seed is deliberately an upsert-only operation. Stable IDs make it safe
 * to run after every migration or deployment, while defaults in the schema
 * continue to own timestamps and future fields not present in this set.
 */
async function seedDatabase(database: NonNullable<typeof db>) {
  const seedDate = new Date("2026-08-01T00:00:00.000Z");

  /* Seeded readers are trusted launch identities, so their Better Auth
   * verification state is represented by the same boolean as live users. */
  await database
    .insert(users)
    .values(
      launchSeed.users.map((user) => ({
        ...user,
        emailVerified: true,
        createdAt: seedDate,
        updatedAt: seedDate,
      })),
    )
    .onConflictDoUpdate({
      target: users.id,
      set: {
        name: sql.raw("excluded.name"),
        email: sql.raw("excluded.email"),
        emailVerified: sql.raw("excluded.email_verified"),
        updatedAt: seedDate,
      },
    });

  await database
    .insert(profiles)
    .values(
      launchSeed.profiles.map((profile) => ({
        ...profile,
        ageConfirmedAt: seedDate,
        createdAt: seedDate,
        updatedAt: seedDate,
      })),
    )
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        userId: sql.raw("excluded.user_id"),
        handle: sql.raw("excluded.handle"),
        displayName: sql.raw("excluded.display_name"),
        bio: sql.raw("excluded.bio"),
        ageConfirmedAt: sql.raw("excluded.age_confirmed_at"),
        updatedAt: seedDate,
      },
    });

  await database
    .insert(bookWorks)
    .values(
      launchSeed.books.map((book) => ({
        id: book.id,
        provider: book.provider,
        providerWorkId: book.providerWorkId,
        slug: book.slug,
        title: book.title,
        authors: [...book.authors],
        firstPublished: book.firstPublished,
        description: book.description,
        coverUrl: book.coverUrl,
        metadata: { curated: true, coverTone: book.coverTone },
        createdAt: seedDate,
        updatedAt: seedDate,
      })),
    )
    .onConflictDoUpdate({
      target: bookWorks.id,
      set: {
        provider: sql.raw("excluded.provider"),
        providerWorkId: sql.raw("excluded.provider_work_id"),
        slug: sql.raw("excluded.slug"),
        title: sql.raw("excluded.title"),
        authors: sql.raw("excluded.authors"),
        firstPublished: sql.raw("excluded.first_published"),
        description: sql.raw("excluded.description"),
        coverUrl: sql.raw("excluded.cover_url"),
        metadata: sql.raw("excluded.metadata"),
        updatedAt: seedDate,
      },
    });

  await database
    .insert(bookIdentifiers)
    .values(
      launchSeed.books.map((book) => ({
        bookWorkId: book.id,
        scheme: "OPEN_LIBRARY_WORK",
        value: book.providerWorkId,
      })),
    )
    .onConflictDoNothing({ target: [bookIdentifiers.scheme, bookIdentifiers.value] });

  await database
    .insert(roasts)
    .values(
      launchSeed.roasts.map((roast) => ({
        ...roast,
        flawTags: [...roast.flawTags],
        createdAt: new Date(roast.createdAt),
        updatedAt: new Date(roast.createdAt),
        status: "PUBLISHED" as const,
      })),
    )
    .onConflictDoUpdate({
      target: roasts.id,
      set: {
        bookWorkId: sql.raw("excluded.book_work_id"),
        authorProfileId: sql.raw("excluded.author_profile_id"),
        hook: sql.raw("excluded.hook"),
        body: sql.raw("excluded.body"),
        rating: sql.raw("excluded.rating"),
        flawTags: sql.raw("excluded.flaw_tags"),
        spoiler: sql.raw("excluded.spoiler"),
        status: sql.raw("excluded.status"),
        fairCount: sql.raw("excluded.fair_count"),
        funnyCount: sql.raw("excluded.funny_count"),
        bookmarkCount: sql.raw("excluded.bookmark_count"),
        updatedAt: sql.raw("excluded.updated_at"),
      },
    });

  await database
    .insert(follows)
    .values(launchSeed.follows.map((follow) => ({ ...follow, createdAt: seedDate })))
    .onConflictDoNothing();

  return {
    books: launchSeed.books.length,
    profiles: launchSeed.profiles.length,
    roasts: launchSeed.roasts.length,
    follows: launchSeed.follows.length,
  };
}

async function main() {
  if (!db) {
    process.stdout.write("DATABASE_URL is not configured; demo data remains in memory for local development.\n");
    return;
  }

  const counts = await seedDatabase(db);
  process.stdout.write(
    `Seeded ${counts.books} books, ${counts.profiles} profiles, ${counts.roasts} roasts, and ${counts.follows} follows.\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`Database seed failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
  process.exitCode = 1;
});
