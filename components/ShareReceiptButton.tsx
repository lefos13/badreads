"use client";

import { useState } from "react";

export function ShareReceiptButton({
  roastId,
  hook,
  bookTitle,
  authorHandle,
  rating,
}: {
  roastId: string;
  hook: string;
  bookTitle: string;
  authorHandle: string;
  rating: number;
}) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/roasts/${roastId}`;
    const shareText = `"${hook}" — @${authorHandle} on ${bookTitle} (${rating}/5 badness)`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Badreads receipt: ${bookTitle}`,
          text: shareText,
          url,
        });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(`${shareText}\n${url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        // Fallback
      }
    }
  }

  return (
    <button
      aria-label={`Share receipt for ${bookTitle}`}
      className={`reaction share-button ${copied ? "reaction-active" : ""}`}
      onClick={handleShare}
      type="button"
    >
      {copied ? "✓ Copied!" : "↗ Share"}
    </button>
  );
}
