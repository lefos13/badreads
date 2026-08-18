import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BADNESS_LABELS } from "@/src/domain/core";
import { demoBooks, getRoastById } from "@/src/data/demo";

type RoastPageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: RoastPageProps): Promise<Metadata> {
  const { id } = await params;
  const roast = getRoastById(id);
  return roast ? { title: `${roast.hook} — Badreads`, description: roast.body } : {};
}

export default async function RoastPage({ params }: RoastPageProps) {
  const { id } = await params;
  const roast = getRoastById(id);
  if (!roast) notFound();
  const book = demoBooks.find((candidate) => candidate.id === roast.bookId);
  if (!book) notFound();

  return (
    <main className="page-width form-shell">
      <span className="eyebrow mono">A public record of disappointment</span>
      <h1>{roast.hook}</h1>
      <p className="book-meta"><Link href={`/u/${roast.author.handle}`}>@{roast.author.handle}</Link> on <Link href={`/books/${book.slug}`}>{book.title}</Link></p>
      <div className="stat-row">
        <div className="stat"><strong className="badness-stars">{"★".repeat(roast.rating)}{"☆".repeat(5 - roast.rating)}</strong><span>{BADNESS_LABELS[roast.rating]}</span></div>
        <div className="stat"><strong>{roast.fairCount}</strong><span>fair</span></div>
        <div className="stat"><strong>{roast.funnyCount}</strong><span>funny</span></div>
      </div>
      <p className="hero-copy roast-long-body">{roast.body}</p>
      <div className="tag-grid tag-list">{roast.flawTags.map((tag) => <span className="tag-option selected" key={tag}>{tag.replaceAll("_", " ")}</span>)}</div>
      <div className="hero-actions">
        <Link className="button button-primary" href={`/books/${book.slug}`}>See all roasts</Link>
        <Link className="button button-quiet" href={`/write?book=${book.slug}`}>Add your verdict</Link>
      </div>
    </main>
  );
}
