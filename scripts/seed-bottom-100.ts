import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { db } from "@/src/db";
import {
  bookIdentifiers,
  bookWorks,
  profiles,
  roasts,
  users,
} from "@/src/db/schema";
import type {
  SeedBook,
  SeedProfile,
  SeedRoast,
  SeedUser,
} from "./build-bottom-100-dataset";

export async function seedBottom100ToDatabase() {
  if (!db) {
    throw new Error("DATABASE_URL is not configured. Connect a database before seeding.");
  }

  const seedPath = path.resolve(process.cwd(), "src/data/bottom-100-seed.json");
  if (!fs.existsSync(seedPath)) {
    throw new Error(`Seed file not found at ${seedPath}. Run pnpm exec tsx scripts/build-bottom-100-dataset.ts first.`);
  }

  const data = JSON.parse(fs.readFileSync(seedPath, "utf-8")) as {
    users: SeedUser[];
    profiles: SeedProfile[];
    books: SeedBook[];
    roasts: SeedRoast[];
  };

  const startTime = Date.now();
  // eslint-disable-next-line no-console
  console.log(`Starting Bottom 100 seed into database (${data.books.length} books, ${data.roasts.length} roasts)...`);

  // 1. Users
  await db
    .insert(users)
    .values(
      data.users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        status: "ACTIVE" as const,
        emailVerified: true,
      })),
    )
    .onConflictDoUpdate({
      target: users.id,
      set: {
        name: sql`excluded.name`,
        email: sql`excluded.email`,
      },
    });

  // 2. Profiles
  await db
    .insert(profiles)
    .values(
      data.profiles.map((p) => ({
        id: p.id,
        userId: p.userId,
        handle: p.handle,
        displayName: p.displayName,
        bio: p.bio,
        ageConfirmedAt: new Date(p.ageConfirmedAt),
      })),
    )
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        handle: sql`excluded.handle`,
        displayName: sql`excluded.display_name`,
        bio: sql`excluded.bio`,
      },
    });

  // 3. Books
  const BATCH_SIZE = 100;
  for (let i = 0; i < data.books.length; i += BATCH_SIZE) {
    const chunk = data.books.slice(i, i + BATCH_SIZE);
    await db
      .insert(bookWorks)
      .values(
        chunk.map((b) => ({
          id: b.id,
          provider: "openlibrary",
          providerWorkId: b.providerWorkId,
          slug: b.slug,
          title: b.title,
          authors: b.authors,
          firstPublished: b.firstPublished,
          description: b.description,
          coverUrl: b.coverUrl,
          metadata: { coverTone: b.coverTone },
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [bookWorks.provider, bookWorks.providerWorkId],
        set: {
          title: sql`excluded.title`,
          authors: sql`excluded.authors`,
          description: sql`excluded.description`,
          coverUrl: sql`excluded.cover_url`,
          metadata: sql`excluded.metadata`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  // Fetch actual database IDs for books
  const dbWorks = await db.select({ id: bookWorks.id, providerWorkId: bookWorks.providerWorkId }).from(bookWorks);
  const workMap = new Map(dbWorks.map((w) => [w.providerWorkId.toUpperCase(), w.id]));

  // Identifiers
  const idRows = data.books.flatMap((b) => {
    const resolvedBookId = workMap.get(b.providerWorkId.toUpperCase()) ?? b.id;
    return [
      { bookWorkId: resolvedBookId, scheme: "OPEN_LIBRARY_WORK", value: b.providerWorkId },
      ...(b.isbn ? [{ bookWorkId: resolvedBookId, scheme: "ISBN", value: b.isbn.replace(/[^0-9X]/gi, "") }] : []),
    ];
  });
  await db.insert(bookIdentifiers).values(idRows).onConflictDoNothing();

  // 4. Roasts
  for (let i = 0; i < data.roasts.length; i += BATCH_SIZE) {
    const chunk = data.roasts.slice(i, i + BATCH_SIZE);
    await db
      .insert(roasts)
      .values(
        chunk.map((r) => {
          const resolvedBookId = workMap.get(r.providerWorkId.toUpperCase()) ?? r.bookId;
          return {
            id: r.id,
            bookWorkId: resolvedBookId,
            authorProfileId: r.authorId,
            hook: r.hook,
            body: r.body,
            rating: r.rating,
            flawTags: r.flawTags,
            spoiler: r.spoiler,
            sourceLabel: r.sourceLabel ?? null,
            sourceUrl: r.sourceUrl ?? null,
            fairCount: r.fairCount,
            funnyCount: r.funnyCount,
            bookmarkCount: r.bookmarkCount,
            status: "PUBLISHED" as const,
            createdAt: new Date(r.createdAt),
            updatedAt: new Date(r.updatedAt),
          };
        }),
      )
      .onConflictDoUpdate({
        target: roasts.id,
        set: {
          hook: sql`excluded.hook`,
          body: sql`excluded.body`,
          rating: sql`excluded.rating`,
          flawTags: sql`excluded.flaw_tags`,
          sourceLabel: sql`excluded.source_label`,
          sourceUrl: sql`excluded.source_url`,
          fairCount: sql`excluded.fair_count`,
          funnyCount: sql`excluded.funny_count`,
          bookmarkCount: sql`excluded.bookmark_count`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  // eslint-disable-next-line no-console
  console.log(`✓ Bottom 100 successfully seeded in ${durationSec}s:`);
  // eslint-disable-next-line no-console
  console.log(`  - ${data.users.length} Users`);
  // eslint-disable-next-line no-console
  console.log(`  - ${data.profiles.length} Profiles`);
  // eslint-disable-next-line no-console
  console.log(`  - ${data.books.length} Books`);
  // eslint-disable-next-line no-console
  console.log(`  - ${data.roasts.length} Roasts`);
}

async function main() {
  await seedBottom100ToDatabase();
}

if (process.argv[1] && process.argv[1].endsWith("seed-bottom-100.ts")) {
  main().catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error("Seed failed:", err);
    process.exit(1);
  });
}
