import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountControls } from "@/components/AccountControls";
import { getDomainStore } from "@/src/domain/repository";
import { getSession } from "@/src/lib/session";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const profile = await getDomainStore().getProfile(session.user.id);
  return (
    <main className="page-width form-shell">
      <span className="eyebrow mono">Private controls / public byline</span>
      <h1>Your data, your exit.</h1>
      <p className="form-intro">Export the profile and roasts Badreads stores for you, or remove your public account and its score-bearing verdicts.</p>
      <div className="hero-actions account-links">
        {profile ? <Link className="button button-quiet" href={`/u/${profile.handle}`}>View public profile (@{profile.handle})</Link> : null}
        <Link className="button button-quiet" href="/saved">View saved receipts</Link>
      </div>
      <AccountControls />
    </main>
  );
}
