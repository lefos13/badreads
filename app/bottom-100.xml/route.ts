import { getDomainStore } from "@/src/domain/repository";
import { resolveAppUrl } from "@/src/lib/url-config";

export const dynamic = "force-dynamic";

function escapeXml(unsafe: string): string {
  return unsafe
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET() {
  const baseUrl = resolveAppUrl(process.env.NEXT_PUBLIC_SITE_URL).toString().replace(/\/$/, "");
  const store = getDomainStore();
  const items = await store.listBottom100("badness");

  const itemsXml = items
    .map((item) => {
      const bookUrl = `${baseUrl}/books/${item.book.slug}`;
      const title = `#${item.rank} ${item.book.title} by ${item.book.authors.join(", ")} (${item.summary.average ?? "—"}/5 Badness)`;
      const description = `<![CDATA[<p><strong>Rank #${item.rank}:</strong> ${escapeXml(item.book.title)}</p><p><strong>Authors:</strong> ${escapeXml(item.book.authors.join(", "))}</p><p><strong>Badness Rating:</strong> ${item.summary.average ?? "—"} / 5 (${item.summary.count} roasts, ${item.summary.worstCount} catastrophic)</p><p>${escapeXml(item.book.description)}</p><p><a href="${bookUrl}">View receipts on Badreads</a></p>]]>`;

      return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${bookUrl}</link>
      <guid isPermaLink="true">${bookUrl}</guid>
      <description>${description}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Badreads — The Bottom 100</title>
    <link>${baseUrl}/bottom-100</link>
    <description>The 100 worst-rated bestsellers on record. High-volume disappointments with verified receipts.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/bottom-100.xml" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=7200",
    },
  });
}
