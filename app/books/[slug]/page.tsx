import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RoastCard } from "@/components/RoastCard";
import { demoBooks } from "@/src/data/demo";
import { getDomainStore } from "@/src/domain/repository";

type BookPageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return demoBooks.map((book) => ({ slug: book.slug }));
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: BookPageProps): Promise<Metadata> {
  const { slug } = await params;
  const book = await getDomainStore().getBookBySlug(slug);
  return book ? { title: `${book.title} — Badreads`, description: book.description } : {};
}

export default async function BookPage({ params }: BookPageProps) {
  const { slug } = await params;
  const store = getDomainStore();
  const book = await store.getBookBySlug(slug);
  if (!book) notFound();
  const [summary, roasts] = await Promise.all([store.getBookSummary(book.id), store.getRoastsForBook(book.id)]);

  return (
    <main>
      <section className="book-hero">
        <div className="page-width book-layout">
          <div className={`book-detail-cover cover-${book.coverTone}`}>
            <span className="cover-title">{book.title}</span>
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
        <div className="roast-list">
          {roasts.length ? roasts.map((roast) => <RoastCard key={roast.id} roast={roast} bookSlug={book.slug} bookTitle={book.title} />) : <div className="empty-state">No roasts yet. You could be the first person to say it.</div>}
        </div>
      </section>
    </main>
  );
}
