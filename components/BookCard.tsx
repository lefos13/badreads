import Image from "next/image";
import Link from "next/link";
import type { BookWork } from "@/src/domain/types";

type BookCardProps = {
  book: BookWork;
  average?: number | null;
  roastCount?: number;
};

export function BookCard({ book, average, roastCount = 0 }: BookCardProps) {
  return (
    <Link className="book-card" href={`/books/${book.slug}`}>
      <div className={`book-cover cover-${book.coverTone}`}>
        <span className="cover-title">{book.title}</span>
        {book.coverUrl ? (
          <Image
            alt={`Cover of ${book.title}`}
            className="book-cover-image"
            fill
            sizes="(max-width: 520px) 100vw, (max-width: 768px) 50vw, 250px"
            src={book.coverUrl}
          />
        ) : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
        <h3>{book.title}</h3>
        {book.isCommunityAdded ? (
          <span className="community-badge mono" style={{ fontSize: "0.65rem", padding: "0.1rem 0.35rem" }}>
            ✳ Community Added
          </span>
        ) : null}
      </div>
      <p className="book-meta">{book.authors.join(", ")} · {book.firstPublished ?? "unknown year"}</p>
      <div className="badness-line">
        <span aria-label={average ? `${average} bad stars` : "No ratings yet"} className="badness-stars">
          {average ? "★★★★★".slice(0, Math.round(average)) : "☆☆☆☆☆"}
        </span>
        <span className="badness-label">{roastCount ? `${roastCount} roasts` : "Be first to roast it"}</span>
      </div>
    </Link>
  );
}
