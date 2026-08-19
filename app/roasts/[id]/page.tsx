import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BADNESS_LABELS } from "@/src/domain/core";
import { getDomainStore } from "@/src/domain/repository";
import type { ReactionState } from "@/src/domain/types";
import { ReactionButtons } from "@/components/ReactionButtons";
import { ReportForm } from "@/components/ReportForm";
import { ShareReceiptButton } from "@/components/ShareReceiptButton";
import { hasModeratorAccess } from "@/src/lib/authorization";
import { getSession } from "@/src/lib/session";

type RoastPageProps = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

/* One roast lookup per request: generateMetadata and the page body share this
 * memoized loader instead of issuing the same query twice. */
const loadRoast = cache(async (id: string) => getDomainStore().getRoast(id));

export async function generateMetadata({ params }: RoastPageProps): Promise<Metadata> {
  const { id } = await params;
  const roast = await loadRoast(id);
  if (!roast || roast.status !== "PUBLISHED") return {};
  const ogImageUrl = `/api/og/roast/${roast.id}`;
  return {
    title: `${roast.hook} — Badreads`,
    description: roast.body,
    openGraph: {
      title: `${roast.hook} — Badreads`,
      description: roast.body,
      type: "article",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: roast.hook }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${roast.hook} — Badreads`,
      description: roast.body,
      images: [ogImageUrl],
    },
  };
}

export default async function RoastPage({ params }: RoastPageProps) {
  const { id } = await params;
  const store = getDomainStore();
  const [roast, session] = await Promise.all([loadRoast(id), getSession()]);
  if (!roast) notFound();
  /* The book depends only on the already-resolved roast, so it loads alongside
   * the viewer profile and reaction states rather than after them. */
  const [viewerProfile, reactionStates, book] = await Promise.all([
    session ? store.getProfile(session.user.id) : Promise.resolve(undefined),
    session?.user?.id ? store.getUserReactionStates(session.user.id, [roast.id]) : Promise.resolve<Record<string, ReactionState>>({}),
    store.getBook(roast.bookId),
  ]);
  if (roast.status !== "PUBLISHED" && viewerProfile?.id !== roast.authorId && !(await hasModeratorAccess())) notFound();
  if (!book) notFound();

  return (
    <main className="page-width form-shell">
      <span className="eyebrow mono">A public record of disappointment</span>
      <h1>{roast.hook}</h1>
      <p className="book-meta"><Link href={`/u/${roast.author.handle}`}>@{roast.author.handle}</Link> on <Link href={`/books/${book.slug}`}>{book.title}</Link></p>
      {roast.sourceLabel ? (
        <div className="roast-source-banner">
          <span className="mono eyebrow">Imported Web Review</span>
          <p>
            Original source:{" "}
            {roast.sourceUrl ? (
              <a
                className="roast-source-link"
                href={roast.sourceUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <strong>{roast.sourceLabel}</strong> ↗
              </a>
            ) : (
              <strong>{roast.sourceLabel}</strong>
            )}
          </p>
        </div>
      ) : null}
      {roast.status !== "PUBLISHED" ? <p className="form-success" role="status">This roast is {roast.status === "PENDING_REVIEW" ? "waiting for moderator review" : roast.status.toLowerCase()}.</p> : null}
      <div className="stat-row">
        <div className="stat"><strong className="badness-stars">{"★".repeat(roast.rating)}{"☆".repeat(5 - roast.rating)}</strong><span>{BADNESS_LABELS[roast.rating]}</span></div>
        <div className="stat"><strong>{roast.fairCount}</strong><span>fair</span></div>
        <div className="stat"><strong>{roast.funnyCount}</strong><span>funny</span></div>
      </div>
      {roast.spoiler ? <details className="spoiler-box roast-long-body"><summary>Spoiler evidence — reveal</summary><p className="hero-copy">{roast.body}</p></details> : <p className="hero-copy roast-long-body">{roast.body}</p>}
      <div className="tag-grid tag-list">{roast.flawTags.map((tag) => <span className="tag-option selected" key={tag}>{tag.replaceAll("_", " ")}</span>)}</div>
      {roast.status === "PUBLISHED" ? (
        <div className="roast-actions-row">
          <ReactionButtons
            bookmarkCount={roast.bookmarkCount}
            fairCount={roast.fairCount}
            funnyCount={roast.funnyCount}
            initialState={reactionStates[roast.id]}
            roastId={roast.id}
          />
          <ShareReceiptButton
            authorHandle={roast.author.handle}
            bookTitle={book.title}
            hook={roast.hook}
            rating={roast.rating}
            roastId={roast.id}
          />
          <ReportForm roastId={roast.id} />
        </div>
      ) : null}
      <div className="hero-actions">
        <Link className="button button-primary" href={`/books/${book.slug}`}>See all roasts</Link>
        <Link className="button button-quiet" href={`/write?book=${book.slug}`}>Add your verdict</Link>
      </div>
    </main>
  );
}
