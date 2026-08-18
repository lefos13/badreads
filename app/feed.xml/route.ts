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
  const [allRoasts, books] = await Promise.all([store.listRoasts(), store.listBooks()]);
  const booksById = new Map(books.map((b) => [b.id, b]));

  const publishedRoasts = allRoasts
    .filter((r) => r.status === "PUBLISHED")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 50);

  const itemsXml = publishedRoasts
    .map((roast) => {
      const book = booksById.get(roast.bookId);
      const bookTitle = book?.title ?? "Book";
      const roastUrl = `${baseUrl}/roasts/${roast.id}`;
      const pubDate = new Date(roast.createdAt).toUTCString();
      const tags = roast.flawTags.join(", ");
      const title = `[${roast.rating}/5★] ${roast.hook} — @${roast.author.handle} on ${bookTitle}`;
      const description = `<![CDATA[<p><strong>Verdict on ${escapeXml(bookTitle)}:</strong> ${escapeXml(roast.hook)}</p><p><strong>Evidence:</strong> ${escapeXml(roast.body)}</p><p><strong>Flaws:</strong> ${escapeXml(tags)}</p><p><a href="${roastUrl}">Read full roast on Badreads</a></p>]]>`;

      return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${roastUrl}</link>
      <guid isPermaLink="true">${roastUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${description}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Badreads — The Feed</title>
    <link>${baseUrl}/feed</link>
    <description>Fresh, fair, and funny book criticism with verified receipts.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800, s-maxage=3600",
    },
  });
}
