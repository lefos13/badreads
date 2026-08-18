import { ModerationQueue } from "@/components/ModerationQueue";
import { ReportQueue } from "@/components/ReportQueue";
import { getDomainStore } from "@/src/domain/repository";
import { hasModeratorAccess } from "@/src/lib/authorization";

export const dynamic = "force-dynamic";

export default async function ModerationPage() {
  if (!(await hasModeratorAccess())) {
    return <main className="page-width section"><div className="empty-state"><h1>Moderator access required.</h1><p>This queue is private to the founder and approved moderators.</p></div></main>;
  }
  const store = getDomainStore();
  const [allRoasts, allReports] = await Promise.all([store.listRoasts(), store.listReports()]);
  const pending = allRoasts.filter((roast) => roast.status === "PENDING_REVIEW");
  const reports = allReports.filter((report) => report.status === "OPEN");

  return (
    <main className="page-width section">
      <div className="section-heading"><div><span className="eyebrow mono">Founder console / first-post queue</span><h1 className="book-detail-title">Moderation.</h1></div><p>Approve the evidence, reject the personal attack, and keep the feed sharp enough to trust.</p></div>
      <ModerationQueue roasts={pending} />
      <div className="section-heading moderation-subheading"><div><span className="eyebrow mono">Verified reports</span><h2>Community flags.</h2></div><p>Three distinct reports hide a roast automatically; these are the human decisions.</p></div>
      <ReportQueue reports={reports} />
    </main>
  );
}
