"use client";

import { useState, useTransition } from "react";
import { moderateRoastAction } from "@/app/actions";
import type { Roast } from "@/src/domain/types";

export function ModerationQueue({ roasts }: { roasts: Roast[] }) {
  const [items, setItems] = useState(roasts);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function decide(roastId: string, decision: "APPROVE" | "REJECT") {
    startTransition(async () => {
      const result = await moderateRoastAction({ roastId, decision });
      if (result.ok) {
        setItems((current) => current.filter((roast) => roast.id !== roastId));
        setMessage(decision === "APPROVE" ? "Published." : "Rejected and kept out of the feed.");
      } else setMessage(result.message);
    });
  }

  return (
    <div className="roast-list">
      {message ? <p aria-live="polite" className="field-help" role="status">{message}</p> : null}
      {items.length ? items.map((roast) => (
        <article className="roast-card" key={roast.id}>
          <div className="roast-topline"><span className="roast-author">@{roast.author.handle}</span><span className="roast-time mono">pending review</span></div>
          <h3>{roast.hook}</h3>
          <p>{roast.body}</p>
          <div className="roast-actions"><button className="button button-primary" disabled={pending} onClick={() => decide(roast.id, "APPROVE")} type="button">Approve</button><button className="button button-quiet" disabled={pending} onClick={() => decide(roast.id, "REJECT")} type="button">Reject</button></div>
        </article>
      )) : <div className="empty-state">No first roasts waiting. The queue is clean.</div>}
    </div>
  );
}
