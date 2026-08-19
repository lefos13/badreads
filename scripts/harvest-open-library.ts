import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { importBooksToDatabase, type BookImportItem } from "./import-books";

const COVER_TONES = ["coral", "acid", "lavender", "ink"] as const;

// Curated English-first subjects across genres, bestsellers, and literary topics
const SUBJECTS = [
  "bestseller",
  "new_york_times_bestseller",
  "fiction",
  "classic_literature",
  "science_fiction",
  "fantasy",
  "dystopian",
  "mystery",
  "thriller",
  "suspense",
  "crime",
  "psychological_thriller",
  "romance",
  "contemporary_romance",
  "historical_romance",
  "fantasy_romance",
  "horror",
  "gothic",
  "paranormal",
  "historical_fiction",
  "young_adult",
  "young_adult_fiction",
  "coming_of_age",
  "adventure",
  "adventure_stories",
  "action_adventure",
  "biography",
  "autobiography",
  "memoir",
  "history",
  "world_history",
  "american_history",
  "european_history",
  "philosophy",
  "ethics",
  "political_philosophy",
  "psychology",
  "popular_psychology",
  "self-help",
  "personal_growth",
  "habits",
  "productivity",
  "business",
  "economics",
  "finance",
  "leadership",
  "science",
  "physics",
  "astronomy",
  "biology",
  "technology",
  "computer_science",
  "artificial_intelligence",
  "humor",
  "satire",
  "comedy",
  "drama",
  "plays",
  "theatre",
  "poetry",
  "modern_poetry",
  "true_crime",
  "investigative_journalism",
  "essays",
  "short_stories",
  "literary_criticism",
  "mythology",
  "folklore",
  "fairy_tales",
  "epic_fantasy",
  "urban_fantasy",
  "space_opera",
  "cyberpunk",
  "steampunk",
  "post-apocalyptic",
  "time_travel",
  "time_travel_fiction",
  "cozy_mystery",
  "hard-boiled",
  "noir",
  "legal_thriller",
  "medical_thriller",
  "spy_stories",
  "espionage",
  "military_fiction",
  "sea_stories",
  "western_stories",
  "lgbtq+",
  "queer_fiction",
  "women_authors",
  "african_american_fiction",
  "nobel_prize_in_literature",
  "pulitzer_prize",
  "booker_prize",
  "hugo_award",
  "nebula_award",
];

type OpenLibrarySubjectWork = {
  key: string;
  title: string;
  authors?: Array<{ name: string; key?: string }>;
  first_publish_year?: number;
  edition_count?: number;
  subject?: string[];
  cover_id?: number | null;
  availability?: { isbn?: string };
};

export function isEnglishLatinText(text: string): boolean {
  if (!text) return false;
  // Disallow CJK, Cyrillic, Greek, Arabic, Hebrew, Hangul, Thai, Devanagari
  const nonLatinRegex = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\u0400-\u04FF\u0370-\u03FF\u0600-\u06FF\uac00-\ud7af\u0e00-\u0e7f\u0900-\u097f]/;
  if (nonLatinRegex.test(text)) return false;
  // Must contain ASCII letters
  return /[a-zA-Z]/.test(text);
}

function generateDescription(title: string, authors: string[], subjects: string[] = []): string {
  const authorStr = authors.length ? authors.join(", ") : "an uncredited author";
  const primarySubjects = subjects
    .filter((s) => typeof s === "string" && s.length < 35 && !s.includes("nyt:") && !s.includes("Level-") && isEnglishLatinText(s))
    .slice(0, 3);

  if (primarySubjects.length > 0) {
    return `${title} is a notable work by ${authorStr} exploring ${primarySubjects.join(", ").toLowerCase()}. Document your evidence and verdict on Badreads.`;
  }
  return `A popular book by ${authorStr}. Add the receipts and tell readers why it worked or failed.`;
}

function cleanTitle(title: string): string {
  return title
    .replace(/\s+/g, " ")
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .trim();
}

async function fetchSubjectBatch(
  subject: string,
  offset = 0,
  limit = 100,
): Promise<OpenLibrarySubjectWork[]> {
  const url = `https://openlibrary.org/subjects/${encodeURIComponent(subject)}.json?limit=${limit}&offset=${offset}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "BadreadsCatalogHarvester/3.0 (https://badreads.local; catalog@badreads.local)",
    },
  });

  if (!response.ok) {
    if (response.status === 429) {
      await new Promise((r) => setTimeout(r, 2000));
      const retry = await fetch(url, {
        headers: { "User-Agent": "BadreadsCatalogHarvester/3.0" },
      });
      if (retry.ok) {
        const data = (await retry.json()) as { works?: OpenLibrarySubjectWork[] };
        return data.works ?? [];
      }
    }
    return [];
  }

  const data = (await response.json()) as { works?: OpenLibrarySubjectWork[] };
  return data.works ?? [];
}

export async function harvestOpenLibrary(
  targetCount = 10000,
  options: { concurrency?: number; delayMs?: number } = {},
): Promise<BookImportItem[]> {
  const delayMs = options.delayMs ?? 100;
  const concurrency = options.concurrency ?? 6;
  const collectedMap = new Map<string, BookImportItem>();

  // Pre-populate with our curated starter catalog
  const starterPath = path.resolve(process.cwd(), "src/data/starter-catalog.json");
  if (fs.existsSync(starterPath)) {
    const starterBooks = JSON.parse(fs.readFileSync(starterPath, "utf-8")) as BookImportItem[];
    for (const b of starterBooks) {
      if (isEnglishLatinText(b.title)) {
        collectedMap.set(b.providerWorkId.toUpperCase(), b);
      }
    }
    // eslint-disable-next-line no-console
    console.log(`Loaded ${collectedMap.size} seed books from starter-catalog.json`);
  }

  // eslint-disable-next-line no-console
  console.log(`Harvesting Open Library subjects for ~${targetCount} English books with verified cover IDs...`);

  const tasks: Array<{ subject: string; offset: number }> = [];
  for (let page = 0; page < 5; page++) {
    for (const subject of SUBJECTS) {
      tasks.push({ subject, offset: page * 100 });
    }
  }

  let taskIndex = 0;
  let activeWorkers = 0;

  const { promise, resolve } = Promise.withResolvers<void>();

  function next() {
    if (collectedMap.size >= targetCount || taskIndex >= tasks.length) {
      if (activeWorkers === 0) resolve();
      return;
    }

    while (activeWorkers < concurrency && taskIndex < tasks.length && collectedMap.size < targetCount) {
      const currentTask = tasks[taskIndex++];
      activeWorkers++;

      fetchSubjectBatch(currentTask.subject, currentTask.offset, 100)
        .then((works) => {
          for (const work of works) {
            if (collectedMap.size >= targetCount) break;

            const workId = work.key.replace(/^\/works\//, "").toUpperCase();
            if (collectedMap.has(workId)) continue;

            const title = cleanTitle(work.title ?? "");
            if (!title || title.length < 2 || title.length > 200) continue;
            // Strict English Latin check
            if (!isEnglishLatinText(title)) continue;

            const authors = (work.authors ?? [])
              .map((a) => a.name?.trim())
              .filter((name): name is string => Boolean(name && name.length > 1 && name.length < 80 && isEnglishLatinText(name)));

            if (authors.length === 0) continue;

            // Only generate cover URL when there is a valid numeric cover ID
            const coverUrl = work.cover_id && typeof work.cover_id === "number" && work.cover_id > 0
              ? `https://covers.openlibrary.org/b/id/${work.cover_id}-M.jpg`
              : null;

            const toneIndex = collectedMap.size % COVER_TONES.length;
            const item: BookImportItem = {
              providerWorkId: workId,
              title,
              authors,
              firstPublished: work.first_publish_year && work.first_publish_year > 1200 && work.first_publish_year <= new Date().getFullYear() + 1
                ? work.first_publish_year
                : null,
              description: generateDescription(title, authors, work.subject),
              coverTone: COVER_TONES[toneIndex],
              isbn: work.availability?.isbn ?? null,
              coverUrl,
            };

            collectedMap.set(workId, item);
          }

          if (taskIndex % 10 === 0 || collectedMap.size >= targetCount) {
            // eslint-disable-next-line no-console
            console.log(`Progress: ${collectedMap.size}/${targetCount} verified English books collected...`);
          }
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.warn(`Subject ${currentTask.subject} offset ${currentTask.offset} failed:`, (err as Error).message);
        })
        .finally(() => {
          activeWorkers--;
          setTimeout(next, delayMs);
        });
    }
  }

  next();
  await promise;

  const finalItems = Array.from(collectedMap.values());
  // eslint-disable-next-line no-console
  console.log(`✓ Harvesting complete: ${finalItems.length} unique, verified English books assembled.`);
  return finalItems;
}

async function main() {
  const args = process.argv.slice(2);
  const targetArg = args.find((a) => a.startsWith("--target="))?.split("=")[1];
  const target = targetArg ? parseInt(targetArg, 10) : 10000;
  const doImport = args.includes("--import") || args.includes("--save-and-import");

  const books = await harvestOpenLibrary(target, { concurrency: 8, delayMs: 60 });

  const outputPath = path.resolve(process.cwd(), "src/data/open-library-10k.json");
  // eslint-disable-next-line no-console
  console.log(`Writing dataset to ${outputPath}...`);
  fs.writeFileSync(outputPath, JSON.stringify(books, null, 2) + "\n");
  // eslint-disable-next-line no-console
  console.log(`✓ Saved ${books.length} books to src/data/open-library-10k.json (${(fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2)} MB)`);

  if (doImport) {
    // eslint-disable-next-line no-console
    console.log("Starting bulk database import into PostgreSQL...");
    await importBooksToDatabase(books, { batchSize: 250 });
  }
}

if (process.argv[1] && process.argv[1].endsWith("harvest-open-library.ts")) {
  main().catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error("Harvesting failed:", err);
    process.exit(1);
  });
}
