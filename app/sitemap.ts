import type { MetadataRoute } from "next";
import { getDomainStore } from "@/src/domain/repository";
import { normalizeAppUrl } from "@/src/lib/url-config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_SITE_URL);
  const staticPaths = ["", "/search", "/feed", "/community", "/privacy", "/terms"];
  const store = getDomainStore();
  const [books, roasts] = await Promise.all([store.listBooks(), store.listRoasts()]);
  const bookPaths = books.map((book) => `/books/${book.slug}`);
  const profilePaths = roasts.map((roast) => `/u/${roast.author.handle}`);
  const roastPaths = roasts.filter((roast) => roast.status === "PUBLISHED").map((roast) => `/roasts/${roast.id}`);
  return [...new Set([...staticPaths, ...bookPaths, ...profilePaths, ...roastPaths])].map((path) => ({ url: `${baseUrl}${path}`, changeFrequency: "daily" as const }));
}
