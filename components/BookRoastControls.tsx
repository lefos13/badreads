import Link from "next/link";
import type { FlawTag } from "@/src/domain/core";

export type BookSortOption = "newest" | "savage" | "fair";

const SORT_OPTIONS: Array<{ id: BookSortOption; label: string }> = [
  { id: "newest", label: "Newest receipts" },
  { id: "savage", label: "★ Most Savage (5★)" },
  { id: "fair", label: "◒ Most Fair" },
];

export function BookRoastControls({
  bookSlug,
  currentSort = "newest",
  currentFlaw,
  totalCount,
  filteredCount,
}: {
  bookSlug: string;
  currentSort?: BookSortOption;
  currentFlaw?: FlawTag;
  totalCount: number;
  filteredCount: number;
}) {
  return (
    <div className="roast-controls-bar">
      <div className="sort-group">
        <span className="mono eyebrow">Sort by:</span>
        <div className="sort-pills">
          {SORT_OPTIONS.map((opt) => {
            const isActive = currentSort === opt.id;
            const href = `/books/${bookSlug}?sort=${opt.id}${currentFlaw ? `&flaw=${currentFlaw}` : ""}`;
            return (
              <Link
                className={`sort-pill ${isActive ? "sort-pill-active" : ""}`}
                href={href}
                key={opt.id}
              >
                {opt.label}
              </Link>
            );
          })}
        </div>
      </div>
      {currentFlaw ? (
        <div className="filter-status">
          <span className="mono font-semibold">Filtering by {currentFlaw.replaceAll("_", " ")}</span>
          <span className="mono text-muted">({filteredCount} of {totalCount})</span>
          <Link className="sort-pill" href={`/books/${bookSlug}?sort=${currentSort}`}>Clear filter ✕</Link>
        </div>
      ) : null}
    </div>
  );
}
