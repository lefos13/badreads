import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BookRoastControls, type BookSortOption } from "@/components/BookRoastControls";
import { RoastCard } from "@/components/RoastCard";
import { FLAW_TAGS, type FlawTag } from "@/src/domain/core";
import { getDomainStore } from "@/src/domain/repository";
import { canDeleteCommunityBook, canEditCommunityBook } from "@/src/lib/authorization";
import { getSession } from "@/src/lib/session";
import { DeleteCommunityBookButton } from "@/components/DeleteCommunityBookButton";

type BookPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; flaw?: string }>;
};


export const dynamic = "force-dynamic";

/* Resolve the book once per request. generateMetadata and the page body share
 * this memoized loader, and the encoded/decoded slug variants are queried
 * concurrently instead of as a serial fallback chain. */
const loadBookBySlug = cache(async (slug: string) => {
  const store = getDomainStore();
  const cleanSlug = decodeURIComponent(slug);
  if (cleanSlug === slug) return store.getBookBySlug(slug);
  const [decoded, raw] = await Promise.all([
    store.getBookBySlug(cleanSlug),
    store.getBookBySlug(slug),
  ]);
  return decoded ?? raw;
});

export async function generateMetadata({ params }: BookPageProps): Promise<Metadata> {
  const { slug } = await params;
  const book = await loadBookBySlug(slug);
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
  const book = await loadBookBySlug(slug);
  if (!book) notFound();
  const session = await getSession();
  const [summary, rawRoasts, canEdit, canDelete] = await Promise.all([
    store.getBookSummary(book.id),
    store.getRoastsForBook(book.id),
    canEditCommunityBook(book),
    canDeleteCommunityBook(book),
  ]);
  let roasts = [...rawRoasts];
  if (flaw) {
    roasts = roasts.filter((r) => r.flawTags.includes(flaw));
  }
  if (sort === "savage" || sort === "fair") {
    /* Engagement is computed once per roast instead of twice per comparison. */
    const ranked = roasts.map((roast) => ({ roast, engagement: 2 * roast.fairCount + roast.funnyCount }));
    ranked.sort(
      sort === "savage"
        ? (a, b) => b.roast.rating - a.roast.rating || b.engagement - a.engagement || b.roast.createdAt.localeCompare(a.roast.createdAt)
        : (a, b) => b.engagement - a.engagement || b.roast.createdAt.localeCompare(a.roast.createdAt),
    );
    roasts = ranked.map((entry) => entry.roast);
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
              <Image
                alt={`Cover of ${book.title}`}
                className="book-cover-image"
                fill
                loading="eager"
                sizes="(max-width: 768px) 192px, 256px"
                src={book.coverUrl}
              />
            ) : null}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "0.4rem" }}>
              <span className="eyebrow mono">The case against / {book.firstPublished ?? "unknown year"}</span>
              {book.isCommunityAdded ? (
                <span className="community-badge mono">✳ Community Added</span>
              ) : null}
            </div>
            <h1 className="book-detail-title">{book.title}</h1>
            <p className="book-meta">
              By {book.authors.join(", ")}
              {book.isbn ? ` · ISBN: ${book.isbn}` : ""}
            </p>
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
              {canEdit ? (
                <Link className="button button-quiet" href={`/books/${book.slug}/edit`}>
                  ✏️ Edit details
                </Link>
              ) : null}
              {canDelete ? (
                <DeleteCommunityBookButton bookId={book.id} bookTitle={book.title} />
              ) : null}
              <Link className="button button-quiet" href="/search">Find another</Link>
            </div>
          </div>
        </div>
      </section>
      <section className="section page-width">
        <div className="section-heading">
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
