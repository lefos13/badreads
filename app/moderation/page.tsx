import { ModerationAuditLog } from "@/components/ModerationAuditLog";
import { ModerationQueue } from "@/components/ModerationQueue";
import { ReportQueue } from "@/components/ReportQueue";
import { getDomainStore } from "@/src/domain/repository";
import type { ReportWithContext } from "@/src/domain/types";
import { hasModeratorAccess } from "@/src/lib/authorization";

export const dynamic = "force-dynamic";

export default async function ModerationPage() {
  if (!(await hasModeratorAccess())) {
    return <main className="page-width section"><div className="empty-state"><h1>Moderator access required.</h1><p>This queue is private to the founder and approved moderators.</p></div></main>;
  }
  const store = getDomainStore();
  const [allRoasts, allReports, books, auditActions] = await Promise.all([
    store.listRoasts(),
    store.listReports(),
    store.listBooks(),
    store.listModerationActions(),
  ]);
  const pending = allRoasts.filter((roast) => roast.status === "PENDING_REVIEW");
  const openReports = allReports.filter((report) => report.status === "OPEN");
  const booksById = new Map(books.map((b) => [b.id, b]));
  const roastsById = new Map(allRoasts.map((r) => [r.id, r]));

  const hydratedReports: ReportWithContext[] = openReports.map((report) => {
    const roast = roastsById.get(report.roastId);
    const book = roast ? booksById.get(roast.bookId) : undefined;
    return {
      ...report,
      roast: roast
        ? {
            hook: roast.hook,
            body: roast.body,
            rating: roast.rating,
            spoiler: roast.spoiler,
            authorHandle: roast.author.handle,
            bookTitle: book?.title ?? "Unknown book",
            bookSlug: book?.slug,
            status: roast.status,
          }
        : undefined,
    };
  });
  return (
    <main className="page-width section">
      <div className="section-heading"><div><span className="eyebrow mono">Founder console / first-post queue</span><h1 className="book-detail-title">Moderation.</h1></div><p>Approve the evidence, reject the personal attack, and keep the feed sharp enough to trust.</p></div>
      <ModerationQueue roasts={pending} />
      <div className="section-heading moderation-subheading"><div><span className="eyebrow mono">Verified reports</span><h2>Community flags.</h2></div><p>Three distinct reports hide a roast automatically; these are the human decisions.</p></div>
      <ReportQueue reports={hydratedReports} />
      <div className="section-heading moderation-subheading">
        <div>
          <span className="eyebrow mono">Audit trail</span>
          <h2>Recent decisions.</h2>
        </div>
        <p>Immutable log of moderation actions, approvals, dismissals, and removals.</p>
      </div>
      <ModerationAuditLog actions={auditActions.slice(0, 20)} />
    </main>
  );
}
