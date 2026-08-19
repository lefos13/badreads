import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export type SeedUser = {
  id: string;
  email: string;
  name: string;
  role: "MEMBER" | "MODERATOR" | "ADMIN";
};

export type SeedProfile = {
  id: string;
  userId: string;
  handle: string;
  displayName: string;
  bio: string;
  ageConfirmedAt: string;
};

export type SeedBook = {
  id: string;
  providerWorkId: string;
  slug: string;
  title: string;
  authors: string[];
  firstPublished: number | null;
  description: string;
  coverTone: "coral" | "acid" | "lavender" | "ink";
  coverUrl: string | null;
  isbn?: string | null;
};
export type SeedRoast = {
  id: string;
  bookId: string;
  providerWorkId: string;
  authorId: string;
  authorHandle: string;
  hook: string;
  body: string;
  rating: 1 | 2 | 3 | 4 | 5;
  flawTags: Array<"PACING" | "PROSE" | "PLOT" | "CHARACTERS" | "ARGUMENTS" | "WORLD_BUILDING" | "ENDING" | "EDITING" | "OTHER">;
  spoiler: boolean;
  sourceLabel?: string | null;
  sourceUrl?: string | null;
  fairCount: number;
  funnyCount: number;
  bookmarkCount: number;
  status: "PUBLISHED";
  createdAt: string;
  updatedAt: string;
};

function deterministicUuid(seed: string): string {
  const hash = crypto.createHash("sha256").update(seed).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export const REVIEWERS = [
  { handle: "receipts_only", name: "Elena Rostova", bio: "If your plot requires characters to share a single brain cell, I will document it with page numbers." },
  { handle: "margin_notes", name: "Marcus Vance", bio: "Former literature TA. Annotating continuity errors and bloated dialogue since 2012." },
  { handle: "red_pen_rebel", name: "Clara Thorne", bio: "Professional copyeditor with zero patience for purple prose and redundant adjectives." },
  { handle: "plot_police", name: "Devon Reed", bio: "Checking your deus ex machina and unresolved cliffhangers at the door." },
  { handle: "book_skeptic", name: "Aria Chen", bio: "Reading the five-star hype trains so your group chat does not have to." },
  { handle: "brutal_honesty", name: "Zane Sterling", bio: "Five stars = catastrophic failure. Keeping Badreads honest one receipt at a time." },
  { handle: "unimpressed", name: "Nora Blake", bio: "Expected a character arc. Received a checklist of marketing tropes." },
  { handle: "trope_exhausted", name: "Felix Alvarez", bio: "If there is an enemies-to-lovers knife to the throat, I am deducting two stars immediately." },
  { handle: "dissonance_daily", name: "Maya Lin", bio: "Investigating why the internet lied to me about this New York Times bestseller." },
  { handle: "airport_reader", name: "Julian Ward", bio: "Reading 400-page paperbacks on delayed cross-country flights with growing indignation." },
  { handle: "pacing_patrol", name: "Sienna Miller", bio: "Chapter 52 and nothing has happened. Calling the narrative authorities." },
  { handle: "manuscript_coroner", name: "Leo Vance", bio: "Performing autopsies on books that should have remained rough drafts." },
];

export { RAW_WORST_100, type RawWorstBook, type RawWorstRoast } from "./raw-worst-100-data";
import { RAW_WORST_100 } from "./raw-worst-100-data";

export function buildCompleteBottom100() {
  const allBooks: SeedBook[] = [];
  const allRoasts: SeedRoast[] = [];
  const allUsers: SeedUser[] = [];
  const allProfiles: SeedProfile[] = [];

  // Create users and profiles
  REVIEWERS.forEach((rev, idx) => {
    const userId = deterministicUuid(`user-${rev.handle}`);
    const profileId = deterministicUuid(`profile-${rev.handle}`);
    allUsers.push({
      id: userId,
      email: `${rev.handle}@badreads.test`,
      name: rev.name,
      role: idx === 0 ? "MODERATOR" : "MEMBER",
    });
    allProfiles.push({
      id: profileId,
      userId,
      handle: rev.handle,
      displayName: rev.name,
      bio: rev.bio,
      ageConfirmedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  // Load starter-catalog.json for rich metadata
  const starterPath = path.resolve(process.cwd(), "src/data/starter-catalog.json");
  const starterCatalog = fs.existsSync(starterPath)
    ? (JSON.parse(fs.readFileSync(starterPath, "utf-8")) as Array<{
        providerWorkId: string;
        title: string;
        authors: string[];
        firstPublished: number | null;
        description: string;
        coverTone: "coral" | "acid" | "lavender" | "ink";
        coverUrl: string | null;
        isbn?: string;
      }>)
    : [];

  const rawLookup = new Map(RAW_WORST_100.map((b) => [b.title.toLowerCase(), b]));

  // Pick 100 prime targets from starter catalog
  const selectedStarter = starterCatalog.slice(0, 100);

  selectedStarter.forEach((item, bookIdx) => {
    const bookId = deterministicUuid(`bottom100-book-${item.providerWorkId}`);
    const slug = item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) + `-${item.providerWorkId.toLowerCase()}`;
    const book: SeedBook = {
      id: bookId,
      providerWorkId: item.providerWorkId,
      slug,
      title: item.title,
      authors: item.authors,
      firstPublished: item.firstPublished,
      description: item.description,
      coverTone: item.coverTone,
      coverUrl: item.coverUrl ?? `https://covers.openlibrary.org/b/olid/${item.providerWorkId}-M.jpg`,
      isbn: item.isbn ?? null,
    };
    allBooks.push(book);

    const custom = rawLookup.get(item.title.toLowerCase());
    if (!custom || custom.roasts.length === 0) {
      throw new Error(`Missing curated real-world roasts for book: ${item.title}`);
    }

    custom.roasts.forEach((tpl, rIdx) => {
      const reviewer = allProfiles[(bookIdx * 3 + rIdx) % allProfiles.length];
      const roastId = deterministicUuid(`bottom100-roast-${item.providerWorkId}-${rIdx}`);
      allRoasts.push({
        id: roastId,
        bookId: book.id,
        providerWorkId: item.providerWorkId,
        authorId: reviewer.id,
        authorHandle: reviewer.handle,
        hook: tpl.hook,
        body: tpl.body,
        rating: tpl.rating,
        flawTags: [...tpl.tags],
        spoiler: tpl.spoiler ?? false,
        sourceLabel: tpl.sourceLabel ?? "Curated Web Review",
        sourceUrl: tpl.sourceUrl ?? null,
        fairCount: 12 + ((bookIdx * 7 + rIdx * 11) % 45),
        funnyCount: 8 + ((bookIdx * 5 + rIdx * 13) % 35),
        bookmarkCount: 4 + ((bookIdx * 3 + rIdx * 7) % 20),
        status: "PUBLISHED",
        createdAt: new Date(Date.now() - (bookIdx * 86400000 + rIdx * 3600000)).toISOString(),
        updatedAt: new Date(Date.now() - (bookIdx * 86400000 + rIdx * 3600000)).toISOString(),
      });
    });
  });
  return { users: allUsers, profiles: allProfiles, books: allBooks, roasts: allRoasts };
}

async function main() {
  const data = buildCompleteBottom100();
  const outPath = path.resolve(process.cwd(), "src/data/bottom-100-seed.json");
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2) + "\n");
  // eslint-disable-next-line no-console
  console.log(`✓ Assembled Bottom 100 Dataset:`);
  // eslint-disable-next-line no-console
  console.log(`  - ${data.books.length} Books`);
  // eslint-disable-next-line no-console
  console.log(`  - ${data.roasts.length} Roasts (3 per book)`);
  // eslint-disable-next-line no-console
  console.log(`  - ${data.profiles.length} Curated Reviewer Profiles`);
  // eslint-disable-next-line no-console
  console.log(`  - Saved to ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
}

if (process.argv[1] && process.argv[1].endsWith("build-bottom-100-dataset.ts")) {
  main().catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error("Dataset build failed:", err);
    process.exit(1);
  });
}
