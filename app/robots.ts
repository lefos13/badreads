import type { MetadataRoute } from "next";
import { normalizeAppUrl } from "@/src/lib/url-config";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_SITE_URL);
  return { rules: { userAgent: "*", allow: "/", disallow: ["/account", "/moderation", "/onboarding", "/api/"] }, sitemap: `${baseUrl}/sitemap.xml` };
}
