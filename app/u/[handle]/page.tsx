import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FollowButton } from "@/components/FollowButton";
import { RoastCard } from "@/components/RoastCard";
import { demoProfiles } from "@/src/data/demo";
import { getDomainStore } from "@/src/domain/repository";
import { getSession } from "@/src/lib/session";
type ProfilePageProps = { params: Promise<{ handle: string }> };

export function generateStaticParams() {
  return demoProfiles.map((profile) => ({ handle: profile.handle }));
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { handle } = await params;
  const profile = await getDomainStore().getProfileByHandle(handle);
  return profile ? { title: `@${profile.handle} — Badreads`, description: profile.bio } : {};
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { handle } = await params;
  const store = getDomainStore();
  const profile = await store.getProfileByHandle(handle);
  if (!profile) notFound();
  const session = await getSession();
  const [allRoasts, books, isFollowingUser] = await Promise.all([
    store.listRoasts(),
    store.listBooks(),
    session?.user?.id ? store.isFollowing(session.user.id, profile.id) : Promise.resolve(false),
  ]);
  const roasts = allRoasts.filter((roast) => roast.authorId === profile.id && roast.status === "PUBLISHED");
  const reactionStates = session?.user?.id
    ? await store.getUserReactionStates(session.user.id, roasts.map((r) => r.id))
    : {};
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
