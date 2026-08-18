import type { MetadataRoute } from "next";
import { memoryStore } from "@/src/domain/store";
import { normalizeAppUrl } from "@/src/lib/url-config";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_SITE_URL);
  const staticPaths = ["", "/search", "/feed", "/community", "/privacy", "/terms"];
  const bookPaths = memoryStore.listBooks().map((book) => `/books/${book.slug}`);
  const profilePaths = memoryStore.listRoasts().map((roast) => `/u/${roast.author.handle}`);
  const roastPaths = memoryStore.listRoasts().filter((roast) => roast.status === "PUBLISHED").map((roast) => `/roasts/${roast.id}`);
  return [...new Set([...staticPaths, ...bookPaths, ...profilePaths, ...roastPaths])].map((path) => ({ url: `${baseUrl}${path}`, changeFrequency: "daily" as const }));
}
