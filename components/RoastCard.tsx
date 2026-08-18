import Link from "next/link";
import { BADNESS_LABELS } from "@/src/domain/core";
import type { Roast } from "@/src/domain/types";

type RoastCardProps = {
  roast: Roast;
  bookTitle: string;
  bookSlug?: string;
};

export function RoastCard({ roast, bookTitle, bookSlug }: RoastCardProps) {
  return (
    <article className="roast-card">
      <div className="roast-topline">
        <Link className="roast-author" href={`/u/${roast.author.handle}`}>@{roast.author.handle}</Link>
        <span className="roast-time mono">{new Date(roast.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
      </div>
      <Link href={`/roasts/${roast.id}`}>
        <h3>{roast.hook}</h3>
        <p>{roast.body}</p>
      </Link>
      <div className="roast-book">
        <Link href={bookSlug ? `/books/${bookSlug}` : "/search"}>{bookTitle}</Link>
        <span aria-hidden="true"> · </span>
        <span className="badness-stars" title={BADNESS_LABELS[roast.rating]}>{"★".repeat(roast.rating)}{"☆".repeat(5 - roast.rating)}</span>
        <span className="mono"> {BADNESS_LABELS[roast.rating]}</span>
      </div>
      <div aria-label="Roast reactions" className="roast-actions">
        <button className="reaction" type="button">◒ Fair {roast.fairCount}</button>
        <button className="reaction" type="button">✦ Funny {roast.funnyCount}</button>
        <button className="reaction" type="button">◇ Save {roast.bookmarkCount}</button>
      </div>
    </article>
  );
}
