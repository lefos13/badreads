import type { MetadataRoute } from "next";
import { getDomainStore } from "@/src/domain/repository";
import { normalizeAppUrl } from "@/src/lib/url-config";

/*
 * The local catalog holds 10k+ works, so both reads are explicitly bounded to
 * keep the sitemap response (and the queries behind it) a fixed size.
 */
const SITEMAP_BOOK_LIMIT = 5000;
const SITEMAP_ROAST_LIMIT = 5000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_SITE_URL);
  const staticPaths = ["", "/search", "/feed", "/community", "/about", "/faq", "/contributors", "/leaderboard", "/support", "/privacy", "/terms"];
  const store = getDomainStore();
  const [books, roasts] = await Promise.all([
    store.listBooks(SITEMAP_BOOK_LIMIT),
    store.listRoasts({ status: "PUBLISHED", limit: SITEMAP_ROAST_LIMIT }),
  ]);
  const bookPaths = books.map((book) => `/books/${book.slug}`);
  const profilePaths = roasts.map((roast) => `/u/${roast.author.handle}`);
  const roastPaths = roasts.map((roast) => `/roasts/${roast.id}`);
  return [...new Set([...staticPaths, ...bookPaths, ...profilePaths, ...roastPaths])].map((path) => ({ url: `${baseUrl}${path}`, changeFrequency: "daily" as const }));
}
