import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookRoastControls, type BookSortOption } from "@/components/BookRoastControls";
import { RoastCard } from "@/components/RoastCard";
import { demoBooks } from "@/src/data/demo";
import { FLAW_TAGS, type FlawTag } from "@/src/domain/core";
import { getDomainStore } from "@/src/domain/repository";
import { getSession } from "@/src/lib/session";

type BookPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; flaw?: string }>;
};

export function generateStaticParams() {
  return demoBooks.map((book) => ({ slug: book.slug }));
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: BookPageProps): Promise<Metadata> {
  const { slug } = await params;
  const book = await getDomainStore().getBookBySlug(slug);
  if (!book) return {};
  const ogImageUrl = `/api/og/book/${encodeURIComponent(book.slug)}`;
  return {
    title: `${book.title} — Badreads`,
    description: book.description,
    openGraph: {
      title: `${book.title} — Badreads`,
      description: book.description,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: book.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${book.title} — Badreads`,
      description: book.description,
      images: [ogImageUrl],
    },
  };
}

export default async function BookPage({ params, searchParams }: BookPageProps) {
  const { slug } = await params;
  const search = await searchParams;
  const rawFlaw = search.flaw?.toUpperCase();
  const flaw: FlawTag | undefined = rawFlaw && (FLAW_TAGS as readonly string[]).includes(rawFlaw)
    ? (rawFlaw as FlawTag)
    : undefined;
  const sort: BookSortOption = search.sort === "savage" || search.sort === "fair" ? search.sort : "newest";

  const store = getDomainStore();
  const book = await store.getBookBySlug(slug);
  if (!book) notFound();
  const session = await getSession();
  const [summary, rawRoasts] = await Promise.all([store.getBookSummary(book.id), store.getRoastsForBook(book.id)]);

  let roasts = [...rawRoasts];
  if (flaw) {
    roasts = roasts.filter((r) => r.flawTags.includes(flaw));
  }
  if (sort === "savage") {
    roasts.sort((a, b) => b.rating - a.rating || (2 * b.fairCount + b.funnyCount) - (2 * a.fairCount + a.funnyCount) || b.createdAt.localeCompare(a.createdAt));
  } else if (sort === "fair") {
    roasts.sort((a, b) => (2 * b.fairCount + b.funnyCount) - (2 * a.fairCount + a.funnyCount) || b.createdAt.localeCompare(a.createdAt));
  } else {
    roasts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const reactionStates = session?.user?.id
    ? await store.getUserReactionStates(session.user.id, roasts.map((r) => r.id))
    : {};
  const topFlaws = Object.entries(summary.flawCounts)
    .filter(([_, count]) => count > 0)
    .sort(([, a], [, b]) => b - a);
  return (
    <main>
      <section className="book-hero">
        <div className="page-width book-layout">
          <div className={`book-detail-cover cover-${book.coverTone}`}>
            <span className="cover-title">{book.title}</span>
            {book.coverUrl ? (
              <img
                alt={`Cover of ${book.title}`}
                className="book-cover-image"
                loading="eager"
                src={book.coverUrl}
              />
            ) : null}
          </div>
          <div>
            <span className="eyebrow mono">The case against / {book.firstPublished ?? "unknown year"}</span>
            <h1 className="book-detail-title">{book.title}</h1>
            <p className="book-meta">By {book.authors.join(", ")}</p>
            <p className="book-description">{book.description}</p>
            <div className="stat-row">
              <div className="stat"><strong>{summary.average ?? "—"}</strong><span>badness / 5</span></div>
              <div className="stat"><strong>{summary.count}</strong><span>roasts</span></div>
              <div className="stat"><strong>{summary.worstCount}</strong><span>catastrophic</span></div>
            </div>
            {topFlaws.length ? (
              <div className="book-flaws">
                <span className="eyebrow mono">Reported flaws</span>
                <div className="tag-grid tag-list">
                  {topFlaws.map(([tag, count]) => {
                    const isActive = flaw === tag;
                    const href = isActive ? `/books/${book.slug}?sort=${sort}` : `/books/${book.slug}?sort=${sort}&flaw=${tag}`;
                    return (
                      <Link
                        className={`tag-option ${isActive ? "selected" : ""}`}
                        href={href}
                        key={tag}
                      >
                        {tag.replaceAll("_", " ")} ({count})
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="hero-actions">
              <Link className="button button-coral" href={`/write?book=${book.slug}`}>Roast this book</Link>
              <Link className="button button-quiet" href="/search">Find another</Link>
            </div>
          </div>
        </div>
      </section>
      <section className="section page-width">
        <div className="section-heading">
          <h2>The evidence</h2>
          <p>Every verdict below is one person&apos;s score, not an objective truth. That&apos;s why it has a receipts section.</p>
        </div>
        <BookRoastControls
          bookSlug={book.slug}
          currentFlaw={flaw}
          currentSort={sort}
          filteredCount={roasts.length}
          totalCount={rawRoasts.length}
        />
        <div className="roast-list">
          {roasts.length ? roasts.map((roast) => <RoastCard bookSlug={book.slug} bookTitle={book.title} key={roast.id} reactionState={reactionStates[roast.id]} roast={roast} />) : <div className="empty-state">No roasts match this criteria.</div>}
        </div>
      </section>
    </main>
  );
}
