import Link from "next/link";
import { redirect } from "next/navigation";
import { RoastForm } from "@/components/RoastForm";
import { memoryStore } from "@/src/domain/store";
import { getSession } from "@/src/lib/session";

type WritePageProps = { searchParams: Promise<{ book?: string }> };

export const dynamic = "force-dynamic";

export default async function WritePage({ searchParams }: WritePageProps) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (!memoryStore.getProfile(session.user.id)) redirect("/onboarding");
  const params = await searchParams;
  const books = memoryStore.listBooks();
  const book = books.find((candidate) => candidate.slug === params.book || candidate.id === params.book);

  if (!book) {
    return (
      <main className="page-width section">
        <div className="form-shell">
          <span className="eyebrow mono">Step 01 / choose your target</span>
          <h1>Which book earned this?</h1>
          <p className="form-intro">Pick a book first. If it is not here yet, search the catalog and come back with the title.</p>
          <div className="roast-list write-book-list">
            {books.map((candidate) => <Link className="search-result" href={`/write?book=${candidate.slug}`} key={candidate.id}><span><strong>{candidate.title}</strong><span className="book-meta">{candidate.authors.join(", ")}</span></span><span className="mono search-arrow">→</span></Link>)}
          </div>
          <Link className="button button-quiet" href="/search">Search the catalog</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page-width section">
      <div className="form-shell">
        <span className="eyebrow mono">Step 02 / submit evidence</span>
        <h1>Roast {book.title}.</h1>
        <p className="form-intro">Your first roast goes through a quick human review. After that, you can publish immediately—provided you keep the receipts.</p>
        <RoastForm bookId={book.id} bookTitle={book.title} />
      </div>
    </main>
  );
}
