import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BADNESS_LABELS } from "@/src/domain/core";
import { getDomainStore } from "@/src/domain/repository";
import type { ReactionState } from "@/src/domain/types";
import { ReactionButtons } from "@/components/ReactionButtons";
import { ReportForm } from "@/components/ReportForm";
import { hasModeratorAccess } from "@/src/lib/authorization";
import { getSession } from "@/src/lib/session";

type RoastPageProps = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: RoastPageProps): Promise<Metadata> {
  const { id } = await params;
  const roast = await getDomainStore().getRoast(id);
  return roast && roast.status === "PUBLISHED" ? { title: `${roast.hook} — Badreads`, description: roast.body } : {};
}

export default async function RoastPage({ params }: RoastPageProps) {
  const { id } = await params;
  const store = getDomainStore();
  const roast = await store.getRoast(id);
  if (!roast) notFound();
  const session = await getSession();
  const [viewerProfile, reactionStates] = await Promise.all([
    session ? store.getProfile(session.user.id) : Promise.resolve(undefined),
    session?.user?.id ? store.getUserReactionStates(session.user.id, [roast.id]) : Promise.resolve<Record<string, ReactionState>>({}),
  ]);
  if (roast.status !== "PUBLISHED" && viewerProfile?.id !== roast.authorId && !(await hasModeratorAccess())) notFound();
  const book = await store.getBook(roast.bookId);
  if (!book) notFound();

  return (
    <main className="page-width form-shell">
      <span className="eyebrow mono">A public record of disappointment</span>
      <h1>{roast.hook}</h1>
      <p className="book-meta"><Link href={`/u/${roast.author.handle}`}>@{roast.author.handle}</Link> on <Link href={`/books/${book.slug}`}>{book.title}</Link></p>
      {roast.status !== "PUBLISHED" ? <p className="form-success" role="status">This roast is {roast.status === "PENDING_REVIEW" ? "waiting for moderator review" : roast.status.toLowerCase()}.</p> : null}
      <div className="stat-row">
        <div className="stat"><strong className="badness-stars">{"★".repeat(roast.rating)}{"☆".repeat(5 - roast.rating)}</strong><span>{BADNESS_LABELS[roast.rating]}</span></div>
        <div className="stat"><strong>{roast.fairCount}</strong><span>fair</span></div>
        <div className="stat"><strong>{roast.funnyCount}</strong><span>funny</span></div>
      </div>
      {roast.spoiler ? <details className="spoiler-box roast-long-body"><summary>Spoiler evidence — reveal</summary><p className="hero-copy">{roast.body}</p></details> : <p className="hero-copy roast-long-body">{roast.body}</p>}
      <div className="tag-grid tag-list">{roast.flawTags.map((tag) => <span className="tag-option selected" key={tag}>{tag.replaceAll("_", " ")}</span>)}</div>
      {roast.status === "PUBLISHED" ? <><ReactionButtons initialState={reactionStates[roast.id]} roast={roast} /><ReportForm roastId={roast.id} /></> : null}
      <div className="hero-actions">
        <Link className="button button-primary" href={`/books/${book.slug}`}>See all roasts</Link>
        <Link className="button button-quiet" href={`/write?book=${book.slug}`}>Add your verdict</Link>
      </div>
    </main>
  );
}
