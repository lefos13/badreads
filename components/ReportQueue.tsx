"use client";

import { useState, useTransition } from "react";
import { resolveReportAction } from "@/app/actions";
import Link from "next/link";
import { BADNESS_LABELS } from "@/src/domain/core";
import type { ReportWithContext } from "@/src/domain/types";
/*
 * Reports stay separate from first-post review so moderators can see the
 * reason, resolve the report, and leave an auditable outcome for each action.
 */

export function ReportQueue({ reports }: { reports: ReportWithContext[] }) {
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

  return (
    <div className="roast-list">
      {message ? <p aria-live="polite" className="field-help" role="status">{message}</p> : null}
      {items.length ? (
        items.map((report) => (
      <article className="roast-card" key={report.id}>
        <div className="roast-topline">
          <span className="roast-author font-mono">Flag: {report.category.replaceAll("_", " ")}</span>
          <span className="roast-time mono">open report</span>
        </div>
        {report.note ? <p className="field-help"><strong>Reporter note:</strong> {report.note}</p> : null}
        {report.roast ? (
          <div className="reported-roast-preview">
            <span className="eyebrow mono">Reported verdict</span>
            <p className="book-meta">
              By @{report.roast.authorHandle} on {report.roast.bookSlug ? <Link href={`/books/${report.roast.bookSlug}`}>{report.roast.bookTitle}</Link> : report.roast.bookTitle}
              {" · "}
              <span className="badness-stars">{"★".repeat(report.roast.rating)}{"☆".repeat(5 - report.roast.rating)}</span>
              <span className="mono"> {BADNESS_LABELS[report.roast.rating]}</span>
            </p>
            <h3>{report.roast.hook}</h3>
            {report.roast.spoiler ? (
              <details className="spoiler-box">
                <summary>Spoiler evidence — reveal</summary>
                <p>{report.roast.body}</p>
              </details>
            ) : (
              <p>{report.roast.body}</p>
            )}
          </div>
        ) : (
          <p className="empty-state">Target roast was already deleted or not found.</p>
        )}
        <div className="roast-actions">
          <button className="button button-coral" disabled={pending} onClick={() => resolve(report.id, "UPHELD")} type="button">Uphold + hide</button>
          <button className="button button-quiet" disabled={pending} onClick={() => resolve(report.id, "DISMISSED")} type="button">Dismiss</button>
        </div>
      </article>
        ))
      ) : (
        <div className="empty-state">No open reports. The community is behaving—for now.</div>
      )}
    </div>
  );
}
