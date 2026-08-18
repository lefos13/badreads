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
      </div>
      <h3>{book.title}</h3>
      <p className="book-meta">{book.authors.join(", ")} · {book.firstPublished}</p>
      <div className="badness-line">
        <span aria-label={average ? `${average} bad stars` : "No ratings yet"} className="badness-stars">
          {average ? "★★★★★".slice(0, Math.round(average)) : "☆☆☆☆☆"}
        </span>
        <span className="badness-label">{roastCount ? `${roastCount} roasts` : "Be first to roast it"}</span>
      </div>
    </Link>
  );
}
