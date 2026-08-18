export const metadata = { title: "Privacy — Badreads", description: "What Badreads stores and why." };

export default function PrivacyPage() {
  return (
    <main className="page-width policy-page">
      <span className="eyebrow mono">Private email / public handle</span>
      <h1>Your byline is public. Your inbox is not.</h1>
      <p className="hero-copy">Badreads stores the minimum needed to run a moderated review network.</p>
      <h2>What we store</h2>
      <p>Your verified email is used for sign-in and is not shown on public pages. We store your handle, profile, roasts, reactions, follows, bookmarks, reports, and moderation history.</p>
      <h2>Safety and analytics</h2>
      <p>Security and rate-limit data may be retained to protect the service. Product analytics accepts an allow-list of events and does not accept raw email or IP addresses.</p>
      <h2>Your choices</h2>
      <p>Use Account to download your data or delete your public profile and roasts. Contact the founder for a privacy request that the self-service tools cannot answer.</p>
    </main>
  );
}
