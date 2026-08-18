import type { ModerationAction } from "@/src/domain/types";

export function ModerationAuditLog({ actions }: { actions: ModerationAction[] }) {
  if (!actions.length) {
    return <div className="empty-state">No recorded moderation actions yet.</div>;
  }

  return (
    <div className="roast-list audit-log-list">
      {actions.map((action) => {
        const date = new Date(action.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });

        const isPositive = action.decision === "APPROVE" || action.decision === "RESTORE";
        const isNegative = action.decision === "REJECT" || action.decision === "REMOVE" || action.decision === "BAN";

        return (
          <article className="roast-card audit-card" key={action.id}>
            <div className="roast-topline">
              <span
                className={`audit-decision-badge font-mono ${
                  isPositive ? "decision-positive" : isNegative ? "decision-negative" : "decision-neutral"
                }`}
              >
                {action.decision}
              </span>
              <span className="roast-time mono">{date}</span>
            </div>
            <p className="book-meta">
              Roast ID: <span className="mono">{action.roastId}</span> · Moderator: <span className="mono">{action.moderatorId}</span>
            </p>
            {action.note ? <p className="field-help"><strong>Note:</strong> {action.note}</p> : null}
          </article>
        );
      })}
    </div>
  );
}
