import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BookForm } from "@/components/BookForm";
import { getDomainStore } from "@/src/domain/repository";
import { canDeleteCommunityBook, canEditCommunityBook } from "@/src/lib/authorization";
import { DeleteCommunityBookButton } from "@/components/DeleteCommunityBookButton";
export const dynamic = "force-dynamic";

/* Local twin of the loader on the book detail page: Next.js page modules may
 * only export route-recognised fields, so the cached helper is redefined here
 * rather than imported. One lookup per request, encoded/decoded in parallel. */
const loadBookBySlug = cache(async (slug: string) => {
  const store = getDomainStore();
  const cleanSlug = decodeURIComponent(slug);
  if (cleanSlug === slug) return store.getBookBySlug(slug);
  const [decoded, raw] = await Promise.all([
    store.getBookBySlug(cleanSlug),
    store.getBookBySlug(slug),
  ]);
  return decoded ?? raw;
});

type EditBookPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: EditBookPageProps): Promise<Metadata> {
  const { slug } = await params;
  const book = await loadBookBySlug(slug);
  if (!book) return { title: "Book Not Found | Badreads" };
  return {
    title: `Edit ${book.title} | Badreads`,
    description: `Edit community catalog details for ${book.title}.`,
  };
}

export default async function EditBookPage({ params }: EditBookPageProps) {
  const { slug } = await params;
  const book = await loadBookBySlug(slug);
  if (!book) notFound();

  const [authorized, canDelete] = await Promise.all([
    canEditCommunityBook(book),
    canDeleteCommunityBook(book),
  ]);

  return (
    <main className="page-width form-shell">
      <div className="section-head">
        <span className="eyebrow mono">Curator & Staff Workspace / Metadata Maintenance</span>
        <h1>Edit book details.</h1>
        <p className="hero-copy">
          Update the title, author list, publication year, description, or cover image for <strong>{book.title}</strong>.
        </p>
      </div>

      {!authorized ? (
        <div className="form-error" role="alert">
          <p>You do not have permission to edit this book.</p>
          <p>
            <Link href={`/books/${book.slug}`} className="button button-quiet">
              &larr; Back to Book
            </Link>
          </p>
        </div>
      ) : (
        <>
          <BookForm mode="edit" initialData={book} />
          {canDelete ? (
            <div className="admin-danger-zone" style={{ marginTop: "2rem", borderTop: "1px dashed var(--line)", paddingTop: "1.5rem" }}>
              <span className="eyebrow mono" style={{ color: "var(--coral)", display: "block", marginBottom: "0.5rem" }}>Admin Danger Zone</span>
              <p style={{ color: "#45433c", fontSize: "0.9rem", marginBottom: "0.8rem" }}>
                Permanently remove this community book and its receipts from Badreads.
              </p>
              <DeleteCommunityBookButton bookId={book.id} bookTitle={book.title} />
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
