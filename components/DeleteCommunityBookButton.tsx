"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCommunityBookAction } from "@/app/actions";

type DeleteCommunityBookButtonProps = {
  bookId: string;
  bookTitle: string;
  redirectUrl?: string;
  className?: string;
};

export function DeleteCommunityBookButton({
  bookId,
  bookTitle,
  redirectUrl = "/search",
  className = "button button-quiet button-delete",
}: DeleteCommunityBookButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${bookTitle}" from the catalog? This will also remove any receipts attached to it.`,
    );
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteCommunityBookAction(bookId);
      if (result.ok) {
        router.push(redirectUrl);
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div className="delete-book-container">
      <button
        aria-busy={isPending}
        className={className}
        disabled={isPending}
        onClick={handleDelete}
        type="button"
      >
        {isPending ? "Deleting..." : "🗑️ Delete book entry"}
      </button>
      {error ? (
        <span className="form-error delete-book-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
