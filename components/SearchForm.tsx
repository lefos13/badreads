"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

// The scanner pulls in @zxing/library (~356 KB min). Keep it out of the
// /search entry bundle and only fetch the chunk when the user shows intent.
const loadIsbnScannerModal = () =>
  import("./IsbnScannerModal").then((m) => m.IsbnScannerModal);

const IsbnScannerModal = dynamic(loadIsbnScannerModal, { ssr: false });

export function SearchForm({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const hasPreloadedScanner = useRef(false);

  function preloadScanner() {
    if (hasPreloadedScanner.current) return;
    hasPreloadedScanner.current = true;
    void loadIsbnScannerModal().catch(() => {
      // Preload is best-effort; the real render path surfaces any failure.
      hasPreloadedScanner.current = false;
    });
  }

  function handleScan(scannedIsbn: string) {
    setIsScannerOpen(false);
    setQuery(scannedIsbn);
    router.push(`/search?q=${encodeURIComponent(scannedIsbn)}`);
  }

  return (
    <>
      <form action="/search" className="search-form" method="get" suppressHydrationWarning>
        <label className="sr-only" htmlFor="book-search">
          Search books by title, author, or ISBN
        </label>
        <div className="search-input-wrapper">
          <input
            className="text-input search-text-input"
            id="book-search"
            name="q"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try The Alchemist, Fourth Wing, or scan ISBN..."
            suppressHydrationWarning
            type="search"
            value={query}
          />
          <button
            aria-label="Scan book ISBN barcode with camera"
            className="search-camera-btn"
            onClick={() => setIsScannerOpen(true)}
            onFocus={preloadScanner}
            onPointerEnter={preloadScanner}
            title="Scan book barcode with camera"
            type="button"
          >
            📷 <span className="search-camera-label">Scan ISBN</span>
          </button>
        </div>
        <button className="button button-primary" type="submit">
          Search
        </button>
      </form>

      {isScannerOpen ? (
        <IsbnScannerModal
          onClose={() => setIsScannerOpen(false)}
          onScan={handleScan}
        />
      ) : null}
    </>
  );
}
