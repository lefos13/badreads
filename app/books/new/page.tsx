import type { Metadata } from "next";
import Link from "next/link";
import { BookForm } from "@/components/BookForm";
import { getSession } from "@/src/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Add a Community Book | Badreads",
  description: "Manually add a book not found in Open Library or the local database.",
};

type NewBookPageProps = {
  searchParams: Promise<{ isbn?: string }>;
};

export default async function NewBookPage({ searchParams }: NewBookPageProps) {
  const { isbn } = await searchParams;
  const session = await getSession();

  return (
    <main className="page-width form-shell">
      <div className="section-head">
        <span className="eyebrow mono">Manual Catalog Ingestion / Community Contribution</span>
        <h1>Add an untracked book.</h1>
        <p className="hero-copy">
          If a work isn’t in Open Library or Badreads, enter its verified ISBN and details to open the file for evidence.
        </p>
      </div>

      {!session ? (
        <div className="form-error" role="alert">
          <p>You must be signed in to contribute a new book work to the catalog.</p>
          <p>
            <Link href="/sign-in" className="button button-primary">
              Sign In to Continue &rarr;
            </Link>
          </p>
        </div>
      ) : (
        <BookForm mode="create" initialIsbn={isbn ?? ""} />
      )}
    </main>
  );
}
