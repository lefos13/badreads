import Link from "next/link";
import { getDomainStore } from "@/src/domain/repository";
import { hasModeratorAccess } from "@/src/lib/authorization";
import { getSession } from "@/src/lib/session";

export async function SiteHeader() {
  const session = await getSession();
  const store = getDomainStore();
  const [profile, isModerator] = await Promise.all([
    session?.user?.id ? store.getProfile(session.user.id) : Promise.resolve(undefined),
    hasModeratorAccess(),
  ]);

  return (
    <header className="site-header">
      <Link className="brand" href="/">
        <span className="brand-mark">✳</span>badreads
      </Link>
      <nav aria-label="Primary navigation" className="header-nav">
        <Link className="header-link" href="/search">Find a book</Link>
        <Link className="header-link" href="/bottom-100">Bottom 100</Link>
        <Link className="header-link" href="/feed">The feed</Link>
        {session ? (
          <>
            <Link className="header-link" href="/saved">Saved</Link>
            {isModerator ? <Link className="header-link mono" href="/moderation">Moderation</Link> : null}
            <Link className="header-link font-mono" href="/account">
              {profile ? `@${profile.handle}` : "Account"}
            </Link>
          </>
        ) : (
          <Link className="header-link" href="/sign-in">Sign in</Link>
        )}
        <Link className="button button-primary" href="/write">Write a roast</Link>
      </nav>
    </header>
  );
}
