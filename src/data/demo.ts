import { calculateBadnessSummary } from "@/src/domain/core";
import type { BookWork, Profile, Roast } from "@/src/domain/types";

export const demoProfiles: Profile[] = [
  {
    id: "profile-mara",
    handle: "mara_reads",
    displayName: "Mara Reads",
    bio: "I finish books so you can avoid them.",
  },
  {
    id: "profile-otto",
    handle: "ottoshelf",
    displayName: "Otto Shelf",
    bio: "Forensic analysis of questionable prose.",
  },
  {
    id: "profile-jules",
    handle: "julesinparentheses",
    displayName: "Jules (in parentheses)",
    bio: "The ending was a personal attack.",
  },
];

export const demoBooks: BookWork[] = [
  {
    id: "book-midnight-library",
    slug: "the-midnight-library",
    title: "The Midnight Library",
    authors: ["Matt Haig"],
    firstPublished: 2020,
    description: "A library between life and death promises infinite alternate lives. The premise is enormous. The execution is… a pamphlet.",
    coverTone: "lavender",
    sourceId: "OL20603503W",
  },
  {
    id: "book-alchemist",
    slug: "the-alchemist",
    title: "The Alchemist",
    authors: ["Paulo Coelho"],
    firstPublished: 1988,
    description: "A shepherd follows omens toward treasure and discovers that the real treasure was a series of extremely confident sentences.",
    coverTone: "acid",
    sourceId: "OL154623W",
  },
  {
    id: "book-atlas-shrugged",
    slug: "atlas-shrugged",
    title: "Atlas Shrugged",
    authors: ["Ayn Rand"],
    firstPublished: 1957,
    description: "A 1,168-page philosophical thriller that asks what would happen if every character stopped having a conversation and started giving a speech.",
    coverTone: "coral",
    sourceId: "OL52293W",
  },
  {
    id: "book-fourth-wing",
    slug: "fourth-wing",
    title: "Fourth Wing",
    authors: ["Rebecca Yarros"],
    firstPublished: 2023,
    description: "Dragons, war college, and a romance that treats communication as an optional side quest.",
    coverTone: "ink",
    sourceId: "OL49634116W",
  },
];

export const demoRoasts: Roast[] = [
  {
    id: "roast-midnight-1",
    bookId: "book-midnight-library",
    authorId: "profile-mara",
    author: demoProfiles[0],
    hook: "A self-help book wearing a library costume.",
    body: "The central idea deserves a novel with more curiosity and less motivational-poster dialogue. Every emotional discovery arrives pre-packaged, explained twice, then underlined in case the reader was enjoying themselves.",
    rating: 4,
    flawTags: ["PROSE", "ARGUMENTS"],
    spoiler: false,
    createdAt: "2026-08-12T09:00:00.000Z",
    fairCount: 42,
    funnyCount: 21,
    bookmarkCount: 16,
    status: "PUBLISHED",
    source: "discovery",
  },
  {
    id: "roast-alchemist-1",
    bookId: "book-alchemist",
    authorId: "profile-otto",
    author: demoProfiles[1],
    hook: "The longest fortune cookie ever printed.",
    body: "The shepherd has one dream and the book has one sentence it wants to repeat forever. The fable is sweet until every person he meets becomes a human-shaped billboard for the same lesson.",
    rating: 5,
    flawTags: ["PROSE", "CHARACTERS"],
    spoiler: false,
    createdAt: "2026-08-11T14:30:00.000Z",
    fairCount: 68,
    funnyCount: 39,
    bookmarkCount: 24,
    status: "PUBLISHED",
    source: "following",
  },
  {
    id: "roast-fourth-wing-1",
    bookId: "book-fourth-wing",
    authorId: "profile-jules",
    author: demoProfiles[2],
    hook: "The dragons deserved a quieter roommate.",
    body: "There is a thrilling world hiding underneath the forced misunderstandings, but it keeps getting interrupted by characters refusing to say the one obvious sentence that would solve the chapter.",
    rating: 3,
    flawTags: ["PACING", "CHARACTERS"],
    spoiler: false,
    createdAt: "2026-08-10T17:20:00.000Z",
    fairCount: 31,
    funnyCount: 33,
    bookmarkCount: 12,
    status: "PUBLISHED",
    source: "following",
  },
  {
    id: "roast-atlas-1",
    bookId: "book-atlas-shrugged",
    authorId: "profile-mara",
    author: demoProfiles[0],
    hook: "A monologue with a train attached.",
    body: "The book has a genuinely gripping mystery buried in it. Unfortunately, every clue comes with a lecture, every conflict comes with a lecture, and eventually the lecture becomes the conflict.",
    rating: 4,
    flawTags: ["PACING", "ARGUMENTS"],
    spoiler: false,
    createdAt: "2026-08-09T10:10:00.000Z",
    fairCount: 29,
    funnyCount: 17,
    bookmarkCount: 9,
    status: "PUBLISHED",
    source: "discovery",
  },
];

export function getBookBySlug(slug: string) {
  return demoBooks.find((book) => book.slug === slug);
}

export function getBookById(id: string) {
  return demoBooks.find((book) => book.id === id);
}

export function getRoastById(id: string) {
  return demoRoasts.find((roast) => roast.id === id);
}

export function getRoastsForBook(bookId: string) {
  return demoRoasts.filter((roast) => roast.bookId === bookId && roast.status === "PUBLISHED");
}

export function getBookSummary(bookId: string) {
  return calculateBadnessSummary(getRoastsForBook(bookId));
}

export function searchDemoBooks(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return demoBooks;

  return demoBooks.filter((book) =>
    [book.title, ...book.authors].some((value) => value.toLowerCase().includes(normalized)),
  );
}

export function getDemoFeed() {
  return demoRoasts.filter((roast) => roast.status === "PUBLISHED");
}
