import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { db } from "@/src/db";
import { bookIdentifiers, bookWorks } from "@/src/db/schema";

export type BookImportItem = {
  providerWorkId: string;
  title: string;
  authors: string[];
  firstPublished?: number | null;
  description?: string | null;
  coverTone?: "coral" | "acid" | "lavender" | "ink";
  isbn?: string | null;
};

const COVER_TONES = ["coral", "acid", "lavender", "ink"] as const;

export function slugify(title: string, providerWorkId: string): string {
  const cleanTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const cleanId = providerWorkId.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return `${cleanTitle || "book"}-${cleanId}`;
}

export function parseCSV(content: string): BookImportItem[] {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length <= 1) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const items: BookImportItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Simple CSV parser supporting quoted values
    const regex = /(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^,]*))/g;
    const values: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(lines[i])) !== null) {
      if (match.index === regex.lastIndex) regex.lastIndex++;
      values.push((match[1] ? match[1].replace(/""/g, '"') : match[2] ?? "").trim());
    }

    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });

    if (row.title && row.authors) {
      const authors = row.authors.split(";").map((a) => a.trim()).filter(Boolean);
      items.push({
        providerWorkId: row.providerworkid || row.id || `custom-${i}`,
        title: row.title,
        authors: authors.length ? authors : [row.authors],
        firstPublished: row.firstpublished ? parseInt(row.firstpublished, 10) || null : null,
        description: row.description || null,
        coverTone: (COVER_TONES as readonly string[]).includes(row.covertone)
          ? (row.covertone as BookImportItem["coverTone"])
          : undefined,
        isbn: row.isbn || null,
      });
    }
  }

  return items;
}

export async function fetchSubjectFromOpenLibrary(
  subject: string,
  limit = 50,
): Promise<BookImportItem[]> {
  const url = `https://openlibrary.org/subjects/${encodeURIComponent(subject)}.json?limit=${limit}`;
  // eslint-disable-next-line no-console
  console.log(`Querying Open Library Subject API: ${url}`);
  const response = await fetch(url, {
    headers: {
      "User-Agent": "BadreadsCatalogImporter/1.0 (https://badreads.local; contact@badreads.local)",
    },
  });

  if (!response.ok) {
    throw new Error(`Open Library Subject API responded with HTTP ${response.status}`);
  }

  const data = (await response.json()) as {
    works?: Array<{
      key: string;
      title: string;
      authors?: Array<{ name: string }>;
      first_publish_year?: number;
      cover_id?: number;
    }>;
  };

  const works = data.works ?? [];
  return works.map((work, idx) => {
    const workId = work.key.replace(/^\/works\//, "");
    return {
      providerWorkId: workId,
      title: work.title,
      authors: (work.authors ?? []).map((a) => a.name).filter(Boolean),
      firstPublished: work.first_publish_year ?? null,
      description: `Discovered from Open Library subject "${subject}". Be the first to publish a verified verdict.`,
      coverTone: COVER_TONES[idx % COVER_TONES.length],
    };
  });
}

export async function importBooksToDatabase(
  items: BookImportItem[],
  options: { batchSize?: number } = {},
) {
  if (!db) {
    throw new Error("DATABASE_URL is not configured. Connect a database before importing.");
  }

  const batchSize = options.batchSize ?? 100;
  let importedCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);

    const values = chunk.map((item, idx) => {
      const coverTone = item.coverTone ?? COVER_TONES[(i + idx) % COVER_TONES.length];
      const isOL = item.providerWorkId.startsWith("OL");
      return {
        provider: "openlibrary",
        providerWorkId: item.providerWorkId,
        slug: slugify(item.title, item.providerWorkId),
        title: item.title,
        authors: item.authors.length ? item.authors : ["Unknown author"],
        firstPublished: item.firstPublished ?? null,
        description: item.description ?? "A popular book awaiting its first evidence-backed roast.",
        coverUrl: isOL ? `https://covers.openlibrary.org/b/olid/${item.providerWorkId}-M.jpg` : null,
        metadata: { coverTone },
        updatedAt: new Date(),
      };
    });

    const insertedWorks = await db
      .insert(bookWorks)
      .values(values)
      .onConflictDoUpdate({
        target: [bookWorks.provider, bookWorks.providerWorkId],
        set: {
          title: sql`excluded.title`,
          authors: sql`excluded.authors`,
          description: sql`excluded.description`,
          firstPublished: sql`excluded.first_published`,
          coverUrl: sql`excluded.cover_url`,
          metadata: sql`excluded.metadata`,
          updatedAt: sql`excluded.updated_at`,
        },
      })
      .returning({ id: bookWorks.id, providerWorkId: bookWorks.providerWorkId });

    const identifierValues = [];
    for (let j = 0; j < chunk.length; j++) {
      const item = chunk[j];
      const inserted = insertedWorks.find((w) => w.providerWorkId === item.providerWorkId);
      if (inserted) {
        identifierValues.push({
          bookWorkId: inserted.id,
          scheme: "OPEN_LIBRARY_WORK",
          value: item.providerWorkId,
        });
        if (item.isbn) {
          identifierValues.push({
            bookWorkId: inserted.id,
            scheme: "ISBN",
            value: item.isbn.replace(/[^0-9X]/gi, ""),
          });
        }
      }
    }

    if (identifierValues.length > 0) {
      await db
        .insert(bookIdentifiers)
        .values(identifierValues)
        .onConflictDoNothing({ target: [bookIdentifiers.scheme, bookIdentifiers.value] });
    }

    importedCount += chunk.length;
    // eslint-disable-next-line no-console
    console.log(`Imported ${importedCount}/${items.length} books...`);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  // eslint-disable-next-line no-console
  console.log(`✓ Completed import of ${importedCount} books in ${durationSec}s`);
  return { count: importedCount, durationSec };
}

async function main() {
  const args = process.argv.slice(2);
  const fileArg = args.find((a) => a.startsWith("--file="))?.split("=")[1];
  const subjectArg = args.find((a) => a.startsWith("--subject="))?.split("=")[1];
  const limitArg = args.find((a) => a.startsWith("--limit="))?.split("=")[1];

  let items: BookImportItem[] = [];

  if (subjectArg) {
    const limit = limitArg ? parseInt(limitArg, 10) : 50;
    // eslint-disable-next-line no-console
    console.log(`Fetching up to ${limit} books for subject "${subjectArg}"...`);
    items = await fetchSubjectFromOpenLibrary(subjectArg, limit);
  } else if (fileArg) {
    const resolvedPath = path.resolve(process.cwd(), fileArg);
    // eslint-disable-next-line no-console
    console.log(`Loading custom books file from ${resolvedPath}...`);
    const content = fs.readFileSync(resolvedPath, "utf-8");
    if (resolvedPath.endsWith(".csv")) {
      items = parseCSV(content);
    } else {
      items = JSON.parse(content) as BookImportItem[];
    }
  } else {
    const defaultPath = path.resolve(process.cwd(), "src/data/starter-catalog.json");
    // eslint-disable-next-line no-console
    console.log(`Loading starter catalog from ${defaultPath}...`);
    const content = fs.readFileSync(defaultPath, "utf-8");
    items = JSON.parse(content) as BookImportItem[];
  }

  // eslint-disable-next-line no-console
  console.log(`Found ${items.length} books to import.`);
  await importBooksToDatabase(items);
}

if (process.argv[1] && process.argv[1].endsWith("import-books.ts")) {
  main().catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error("Import failed:", err);
    process.exit(1);
  });
}
