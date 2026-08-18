import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/OnboardingForm";
import { getDomainStore } from "@/src/domain/repository";
import { getSession } from "@/src/lib/session";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (await getDomainStore().getProfile(session.user.id)) redirect("/write");

  return (
    <main className="page-width form-shell">
      <span className="eyebrow mono">Step 01 / choose your byline</span>
      <h1>Keep the email private. Keep the opinion public.</h1>
      <p className="form-intro">Pick a handle people can remember. Badreads is for evidence-backed criticism of books, not pile-ons against authors or readers.</p>
      <OnboardingForm />
    </main>
  );
}
