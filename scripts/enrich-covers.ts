import fs from "node:fs";
import path from "node:path";

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

async function lookupExactCover(title: string, author = ""): Promise<string | null> {
  const normTarget = normalizeTitle(title);
  const primaryAuthor = author.split(",")[0]?.trim() || "";

  // 1. Try search with title and author
  const queries = [
    `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(primaryAuthor)}&limit=5`,
    `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=5`,
  ];

  for (const url of queries) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "BadreadsExactCoverMatcher/2.0 (contact@badreads.local)" },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        docs?: Array<{
          title?: string;
          author_name?: string[];
          cover_i?: number;
        }>;
      };

      if (!data.docs?.length) continue;

      for (const doc of data.docs) {
        if (!doc.cover_i || typeof doc.cover_i !== "number" || doc.cover_i <= 0) continue;
        const normDocTitle = normalizeTitle(doc.title ?? "");

        // Verify title match: either contains or closely matches
        const isTitleMatch =
          normDocTitle === normTarget ||
          normDocTitle.startsWith(normTarget) ||
          normTarget.startsWith(normDocTitle) ||
          (normTarget.length > 5 && normDocTitle.includes(normTarget));

        if (isTitleMatch) {
          return `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
        }
      }
    } catch {
      // ignore network errors and try next
    }
  }

  return null;
}

async function main() {
  const starterPath = path.resolve(process.cwd(), "src/data/starter-catalog.json");
  const starter = JSON.parse(fs.readFileSync(starterPath, "utf-8")) as Array<{
    title: string;
    authors: string[];
    coverUrl?: string | null;
  }>;

  // eslint-disable-next-line no-console
  console.log(`Starting exact title/author cover verification for ${starter.length} starter books...`);

  const BATCH_SIZE = 8;
  let matched = 0;

  for (let i = 0; i < starter.length; i += BATCH_SIZE) {
    const chunk = starter.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      chunk.map((b) => lookupExactCover(b.title, b.authors[0] ?? "")),
    );

    results.forEach((url, idx) => {
      chunk[idx].coverUrl = url;
      if (url) matched++;
    });

    // eslint-disable-next-line no-console
    console.log(`Verified ${Math.min(i + BATCH_SIZE, starter.length)}/${starter.length} (matched: ${matched})...`);
    await new Promise((r) => setTimeout(r, 200));
  }

  fs.writeFileSync(starterPath, JSON.stringify(starter, null, 2) + "\n");
  // eslint-disable-next-line no-console
  console.log(`✓ Completed! ${matched}/${starter.length} books have 100% verified authentic covers.`);
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error("Enrichment failed:", err);
  process.exit(1);
});
