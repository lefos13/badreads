import Link from "next/link";
import { BADNESS_LABELS } from "@/src/domain/core";
import type { ReactionState, Roast } from "@/src/domain/types";
import { ReactionButtons } from "./ReactionButtons";

type RoastCardProps = {
  roast: Roast;
  bookTitle: string;
  bookSlug?: string;
  reactionState?: ReactionState;
};

export function RoastCard({ roast, bookTitle, bookSlug, reactionState }: RoastCardProps) {
  return (
    <article className="roast-card">
      <div className="roast-topline">
        <Link className="roast-author" href={`/u/${roast.author.handle}`}>@{roast.author.handle}</Link>
        <span className="roast-time mono">{new Date(roast.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
      </div>
      <Link href={`/roasts/${roast.id}`}><h3>{roast.hook}</h3></Link>
      {roast.spoiler ? <details className="spoiler-box"><summary>Spoiler evidence — reveal</summary><p>{roast.body}</p></details> : <p>{roast.body}</p>}
      <div className="roast-book">
        <Link href={bookSlug ? `/books/${bookSlug}` : "/search"}>{bookTitle}</Link>
        <span aria-hidden="true"> · </span>
        <span className="badness-stars" title={BADNESS_LABELS[roast.rating]}>{"★".repeat(roast.rating)}{"☆".repeat(5 - roast.rating)}</span>
        <span className="mono"> {BADNESS_LABELS[roast.rating]}</span>
      </div>
      <ReactionButtons initialState={reactionState} roast={roast} />
    </article>
  );
}
