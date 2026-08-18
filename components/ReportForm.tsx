"use client";

import { useState, useTransition } from "react";
import { reportRoastAction } from "@/app/actions";
import type { ReportCategory } from "@/src/domain/types";

export function ReportForm({ roastId }: { roastId: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ReportCategory>("PERSONAL_ATTACK");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await reportRoastAction({ roastId, category, note: note || undefined });
      setMessage(result.ok ? "Thanks. A moderator will take a look." : result.message);
      if (result.ok) setOpen(false);
    });
  }

  return (
    <div className="report-box">
      <button className="reaction" onClick={() => setOpen((value) => !value)} type="button">Report this roast</button>
      {open ? <div className="report-form">
        <label className="field"><span>Reason</span><select className="select-input" onChange={(event) => setCategory(event.target.value as ReportCategory)} value={category}><option value="PERSONAL_ATTACK">Personal attack</option><option value="HATE">Hate or threat</option><option value="SPOILER">Unmarked spoiler</option><option value="SPAM">Spam</option><option value="COPYRIGHT">Copyright concern</option><option value="OTHER">Other</option></select></label>
        <label className="field"><span>Context (optional)</span><textarea className="text-area report-note" maxLength={500} onChange={(event) => setNote(event.target.value)} value={note} /></label>
        <button className="button button-coral" disabled={pending} onClick={submit} type="button">{pending ? "Sending…" : "Send report"}</button>
      </div> : null}
      {message ? <span className="field-help" role="status">{message}</span> : null}
    </div>
  );
}
