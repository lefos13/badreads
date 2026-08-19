import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { FollowButton } from "@/components/FollowButton";
import { RoastCard } from "@/components/RoastCard";
import { getDomainStore } from "@/src/domain/repository";
import { getSession } from "@/src/lib/session";
import type { ReactionState } from "@/src/domain/types";

type ProfilePageProps = { params: Promise<{ handle: string }> };

/*
 * generateMetadata and the page body both need the profile; caching the lookup
 * per request collapses the two identical queries into one.
 */
const loadProfile = cache(async (handle: string) => getDomainStore().getProfileByHandle(handle));


export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { handle } = await params;
  const profile = await loadProfile(handle);
  return profile ? { title: `@${profile.handle} — Badreads`, description: profile.bio } : {};
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { handle } = await params;
  const store = getDomainStore();
  const profile = await loadProfile(handle);
  if (!profile) notFound();
  const session = await getSession();
  // Author + status filtering happens in the store rather than scanning every roast.
  const [roasts, isFollowingUser] = await Promise.all([
    store.listRoastsByAuthor(profile.id, { status: "PUBLISHED" }),
    session?.user?.id ? store.isFollowing(session.user.id, profile.id) : Promise.resolve(false),
  ]);
  const bookIds = Array.from(new Set(roasts.map((r) => r.bookId)));
  const [books, reactionStates] = await Promise.all([
    store.getBooksByIds(bookIds),
    session?.user?.id
      ? store.getUserReactionStates(session.user.id, roasts.map((r) => r.id))
      : Promise.resolve<Record<string, ReactionState>>({}),
  ]);
  const booksById = new Map(books.map((book) => [book.id, book] as const));
  const isSelf = session?.user?.id === profile.id || session?.user?.id === profile.userId;
  return (
    <main className="page-width section">
      <section className="profile-hero">
        <div className="profile-avatar" aria-hidden="true">{profile.handle.slice(0, 1).toUpperCase()}</div>
        <div>
          <span className="eyebrow mono">Public handle / private email</span>
          <h1 className="book-detail-title">@{profile.handle}</h1>
          <p className="hero-copy">{profile.bio}</p>
          {!isSelf ? <FollowButton initialFollowing={isFollowingUser} profileId={profile.id} /> : null}
        </div>
      </section>
      <section className="section profile-roasts">
        <div className="section-heading"><h2>{roasts.length} public verdicts</h2><p>One score per book. No drive-by insults without evidence.</p></div>
        <div className="roast-list">
          {roasts.length ? roasts.map((roast) => {
            const book = booksById.get(roast.bookId);
            return book ? <RoastCard bookSlug={book.slug} bookTitle={book.title} key={roast.id} reactionState={reactionStates[roast.id]} roast={roast} /> : null;
          }) : <div className="empty-state">This reviewer has not published a verdict yet.</div>}
        </div>
      </section>
    </main>
  );
}
