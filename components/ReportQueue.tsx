"use client";

import { useState, useTransition } from "react";
import { resolveReportAction } from "@/app/actions";
import type { Report } from "@/src/domain/types";

/*
 * Reports stay separate from first-post review so moderators can see the
 * reason, resolve the report, and leave an auditable outcome for each action.
 */

export function ReportQueue({ reports }: { reports: Report[] }) {
  const [items, setItems] = useState(reports);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function resolve(reportId: string, status: "UPHELD" | "DISMISSED") {
    startTransition(async () => {
      const result = await resolveReportAction({ reportId, status });
      if (result.ok) {
        setItems((current) => current.filter((report) => report.id !== reportId));
        setMessage(status === "UPHELD" ? "Report upheld; roast hidden." : "Report dismissed.");
      } else setMessage(result.message);
    });
  }

  if (!items.length) return <div className="empty-state">No open reports. The community is behaving—for now.</div>;
  return <div className="roast-list">
    {message ? <p aria-live="polite" className="field-help" role="status">{message}</p> : null}
    {items.map((report) => <article className="roast-card" key={report.id}>
      <div className="roast-topline"><span className="roast-author">{report.category.replaceAll("_", " ")}</span><span className="roast-time mono">open report</span></div>
      {report.note ? <p>{report.note}</p> : <p>No additional context supplied.</p>}
      <div className="roast-actions"><button className="button button-coral" disabled={pending} onClick={() => resolve(report.id, "UPHELD")} type="button">Uphold + hide</button><button className="button button-quiet" disabled={pending} onClick={() => resolve(report.id, "DISMISSED")} type="button">Dismiss</button></div>
    </article>)}
  </div>;
}
