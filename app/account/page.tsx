import { redirect } from "next/navigation";
import { AccountControls } from "@/components/AccountControls";
import { getSession } from "@/src/lib/session";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  if (!(await getSession())) redirect("/sign-in");

  return (
    <main className="page-width form-shell">
      <span className="eyebrow mono">Private controls / public byline</span>
      <h1>Your data, your exit.</h1>
      <p className="form-intro">Export the profile and roasts Badreads stores for you, or remove your public account and its score-bearing verdicts.</p>
      <AccountControls />
    </main>
  );
}
