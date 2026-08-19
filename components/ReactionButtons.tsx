"use client";

import { useState, useTransition } from "react";
import { setBookmarkAction, setReactionAction } from "@/app/actions";
import type { ReactionState } from "@/src/domain/types";

type ReactionButtonsProps = {
  roastId: string;
  fairCount: number;
  funnyCount: number;
  bookmarkCount: number;
  initialState?: ReactionState;
};

export function ReactionButtons({ roastId, fairCount, funnyCount, bookmarkCount, initialState }: ReactionButtonsProps) {
  const [counts, setCounts] = useState({ fair: fairCount, funny: funnyCount, bookmark: bookmarkCount });
  const [active, setActive] = useState<ReactionState>(initialState ?? { fair: false, funny: false, bookmarked: false });
  const [pending, startTransition] = useTransition();

  function react(kind: "FAIR" | "FUNNY") {
    const key = kind === "FAIR" ? "fair" : "funny";
    const nextActive = !active[key];
    setActive((current) => ({ ...current, [key]: nextActive }));
    setCounts((current) => ({ ...current, [key]: current[key] + (nextActive ? 1 : -1) }));
    startTransition(async () => {
      const result = await setReactionAction({ roastId, kind, active: nextActive });
      if (!result.ok) {
        setActive((current) => ({ ...current, [key]: !nextActive }));
        setCounts((current) => ({ ...current, [key]: current[key] + (nextActive ? -1 : 1) }));
      }
    });
  }

  function bookmark() {
    const nextActive = !active.bookmarked;
    setActive((current) => ({ ...current, bookmarked: nextActive }));
    setCounts((current) => ({ ...current, bookmark: current.bookmark + (nextActive ? 1 : -1) }));
    startTransition(async () => {
      const result = await setBookmarkAction({ roastId, active: nextActive });
      if (!result.ok) {
        setActive((current) => ({ ...current, bookmarked: !nextActive }));
        setCounts((current) => ({ ...current, bookmark: current.bookmark + (nextActive ? -1 : 1) }));
      }
    });
  }

  return (
    <div aria-label="Roast reactions" className="roast-actions">
      <button aria-pressed={active.fair} className={`reaction ${active.fair ? "reaction-active" : ""}`} disabled={pending} onClick={() => react("FAIR")} type="button">◒ Fair {counts.fair}</button>
      <button aria-pressed={active.funny} className={`reaction ${active.funny ? "reaction-active" : ""}`} disabled={pending} onClick={() => react("FUNNY")} type="button">✦ Funny {counts.funny}</button>
      <button aria-pressed={active.bookmarked} className={`reaction ${active.bookmarked ? "reaction-active" : ""}`} disabled={pending} onClick={bookmark} type="button">◇ Save {counts.bookmark}</button>
    </div>
  );
}
