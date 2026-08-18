"use client";

import Link from "next/link";
import type { Bottom100SortOption } from "@/src/domain/types";

const SORT_OPTIONS: Array<{ value: Bottom100SortOption; label: string; description: string }> = [
  { value: "shuffle", label: "🎲 Shuffled", description: "Randomized order on each load" },
  { value: "badness", label: "★ Worst Badness", description: "Sorted by highest average score (5★ is worst)" },
  { value: "roasts", label: "🔥 Most Roasted", description: "Sorted by total number of complaints" },
  { value: "title", label: "A–Z Title", description: "Alphabetical by book title" },
];

export function Bottom100SortControls({ currentSort }: { currentSort: Bottom100SortOption }) {
  return (
    <nav aria-label="Sort bottom 100 books" className="bottom-100-sort-bar">
      <span className="mono eyebrow">Sort by:</span>
      <div className="bottom-100-sort-options">
        {SORT_OPTIONS.map((opt) => {
          const isActive = currentSort === opt.value;
          return (
            <Link
              className={`sort-pill ${isActive ? "sort-pill-active" : ""}`}
              href={`/bottom-100?sort=${opt.value}`}
              key={opt.value}
              title={opt.description}
            >
              {opt.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
