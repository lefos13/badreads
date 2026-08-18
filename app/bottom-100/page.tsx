import type { Metadata } from "next";
import Link from "next/link";
import { Bottom100SortControls } from "@/components/Bottom100SortControls";
import { BADNESS_LABELS } from "@/src/domain/core";
import { getDomainStore } from "@/src/domain/repository";
import type { Bottom100SortOption } from "@/src/domain/types";

export const metadata: Metadata = {
  title: "The Bottom 100 — Badreads",
  description: "The 100 worst-rated bestsellers on record. High-volume disappointments with verified receipts.",
  openGraph: {
    title: "The Bottom 100 — Badreads",
    description: "The 100 worst-rated bestsellers on record. High-volume disappointments with verified receipts.",
    images: [{ url: "/api/og/bottom-100", width: 1200, height: 630, alt: "The Bottom 100 on Badreads" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Bottom 100 — Badreads",
    description: "The 100 worst-rated bestsellers on record. High-volume disappointments with verified receipts.",
    images: ["/api/og/bottom-100"],
  },
};

export const dynamic = "force-dynamic";

type Bottom100PageProps = {
  searchParams: Promise<{ sort?: string }>;
};

const VALID_SORTS: Bottom100SortOption[] = ["shuffle", "badness", "roasts", "title"];

export default async function Bottom100Page({ searchParams }: Bottom100PageProps) {
  const params = await searchParams;
  const rawSort = (params.sort ?? "shuffle").toLowerCase();
  const sort: Bottom100SortOption = (VALID_SORTS as readonly string[]).includes(rawSort)
    ? (rawSort as Bottom100SortOption)
    : "shuffle";

  const store = getDomainStore();
  const items = await store.listBottom100(sort);

  const totalRoasts = items.reduce((acc, item) => acc + item.summary.count, 0);
  const avgBadness = items.length > 0
    ? (
        items.reduce((acc, item) => acc + (item.summary.average ?? 0), 0) / items.length
      ).toFixed(1)
    : "0.0";

  return (
    <main className="page-width section">
      <header className="bottom-100-hero">
        <div className="section-heading">
          <div>
            <span className="eyebrow mono">Verified Disasters / Reader Receipts</span>
            <h1 className="book-detail-title">The Bottom 100.</h1>
          </div>
          <p className="hero-copy">
            The most disappointing, over-hyped, and catastrophic bestsellers on record. Every book below earned its place through evidence-backed roasts.
          </p>
        </div>

        <div className="stat-row bottom-100-stats">
          <div className="stat">
            <strong>{items.length}</strong>
            <span>disaster bestsellers</span>
          </div>
          <div className="stat">
            <strong>{totalRoasts}</strong>
            <span>verified roasts</span>
          </div>
          <div className="stat">
            <strong>{avgBadness} ★</strong>
            <span>average badness score</span>
          </div>
        </div>

        <div className="displacement-banner">
          <span className="mono eyebrow">Dynamic Displacement Protocol</span>
          <p>
            Books qualify for this board with a minimum of <strong>3 verified roasts</strong>. When reader verdicts push a book&apos;s badness score above an existing title, it automatically displaces it in real time.
          </p>
        </div>

        <Bottom100SortControls currentSort={sort} />
      </header>

      <div className="bottom-100-grid">
        {items.map((item) => (
          <article className="bottom-100-card" key={item.book.id}>
            <div className="bottom-100-rank-badge mono">#{item.rank}</div>

            <div className="bottom-100-main">
              <div className={`bottom-100-cover cover-${item.book.coverTone}`}>
                {item.book.coverUrl ? (
                  <img
                    alt={`Cover of ${item.book.title}`}
                    className="book-cover-image"
                    loading="lazy"
                    src={item.book.coverUrl}
                  />
                ) : (
                  <span className="cover-title">{item.book.title}</span>
                )}
              </div>

              <div className="bottom-100-details">
                <div className="bottom-100-topline">
                  <span className="mono eyebrow">{item.book.firstPublished ?? "Unknown year"}</span>
                  <span className="badness-badge mono">
                    <span className="badness-stars" title={BADNESS_LABELS[Math.round(item.summary.average ?? 5) as 1 | 2 | 3 | 4 | 5]}>
                      {"★".repeat(Math.round(item.summary.average ?? 5))}
                    </span>
                    <strong> {item.summary.average?.toFixed(1) ?? "—"}</strong> / 5.0 ({item.summary.count} roasts)
                  </span>
                </div>

                <h2>
                  <Link className="bottom-100-title-link" href={`/books/${item.book.slug}`}>
                    {item.book.title}
                  </Link>
                </h2>
                <p className="book-meta">By {item.book.authors.join(", ")}</p>
                <p className="bottom-100-desc">{item.book.description}</p>

                <div className="bottom-100-roasts-preview">
                  <h3 className="mono eyebrow receipts-header">Top Receipts ({item.topRoasts.length})</h3>
                  <div className="receipts-list">
                    {item.topRoasts.map((roast) => (
                      <div className="receipt-snippet" key={roast.id}>
                        <div className="receipt-topline">
                          <Link className="roast-author" href={`/u/${roast.author.handle}`}>
                            @{roast.author.handle}
                          </Link>
                          <span className="badness-stars">{"★".repeat(roast.rating)}</span>
                        </div>
                        <p className="receipt-hook"><strong>&ldquo;{roast.hook}&rdquo;</strong></p>
                        <p className="receipt-body">{roast.body}</p>
                        <div className="tag-grid tag-list">
                          {roast.flawTags.map((tag) => (
                            <span className="tag-option selected" key={tag}>
                              {tag.replaceAll("_", " ")}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bottom-100-card-actions">
                  <Link className="button button-coral" href={`/books/${item.book.slug}`}>
                    Read all {item.summary.count} receipts →
                  </Link>
                  <Link className="button button-quiet" href={`/write?book=${item.book.slug}`}>
                    Roast this book
                  </Link>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
