import Link from "next/link";
import { FLAW_TAGS, type FlawTag } from "@/src/domain/core";

export function FeedFilterBar({
  currentFlaw,
  currentRating,
}: {
  currentFlaw?: FlawTag;
  currentRating?: number;
}) {
  const isAllActive = !currentFlaw && !currentRating;
  const isFiveStarActive = currentRating === 5;

  return (
    <nav aria-label="Feed filter options" className="feed-filter-bar">
      <span className="mono eyebrow">Filter:</span>
      <div className="filter-pills">
        <Link
          className={`sort-pill ${isAllActive ? "sort-pill-active" : ""}`}
          href="/feed"
        >
          All verdicts
        </Link>
        <Link
          className={`sort-pill ${isFiveStarActive ? "sort-pill-active" : ""}`}
          href="/feed?rating=5"
        >
          ★ 5-Star Catastrophic
        </Link>
        {FLAW_TAGS.map((tag) => {
          const isActive = currentFlaw === tag;
          return (
            <Link
              className={`sort-pill ${isActive ? "sort-pill-active" : ""}`}
              href={`/feed?flaw=${tag}`}
              key={tag}
            >
              {tag.replaceAll("_", " ")}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
