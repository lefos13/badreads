"use client";

import { useEffect, useRef, useState } from "react";
import { BarcodeFormat, BrowserMultiFormatReader, DecodeHintType } from "@zxing/library";

export function IsbnScannerModal({
  onScan,
  onClose,
}: {
  onScan: (isbn: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualIsbn, setManualIsbn] = useState("");

  // Stop camera tracks and decoding cleanly
  function stopCamera() {
    if (readerRef.current) {
      try {
        readerRef.current.reset();
      } catch {
        // Ignore reset errors
      }
      readerRef.current = null;
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => track.stop());
      } catch {
        // Ignore track stopping errors
      }
      streamRef.current = null;
    }
  }

  function handleFoundIsbn(rawValue: string) {
    const cleaned = rawValue.replace(/[^0-9Xx]/g, "");
    if (cleaned.length >= 10 && cleaned.length <= 13) {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(200);
        } catch {
          // Ignore vibrate errors
        }
      }
      stopCamera();
      onScan(cleaned);
    }
  }

  useEffect(() => {
    let isActive = true;

    async function startCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Camera access is not supported on this browser.");
        return;
      }

      try {
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.ITF,
        ]);

        const codeReader = new BrowserMultiFormatReader(hints);
        readerRef.current = codeReader;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (!isActive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          try {
            await codeReader.decodeFromStream(stream, videoRef.current, (result) => {
              if (!isActive) return;
              if (result && result.getText()) {
                handleFoundIsbn(result.getText());
              }
            });
          } catch (decodeErr) {
            if (!isActive) return;
            const msg = decodeErr instanceof Error ? decodeErr.message : "Scanner error";
            setError(`Barcode scanner initialisation failed: ${msg}`);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Camera permission denied.";
        setError(`Unable to access camera: ${message}`);
      }
    }

    startCamera();

    // Close modal on Escape key
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        stopCamera();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      isActive = false;
      stopCamera();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (manualIsbn.trim()) {
      handleFoundIsbn(manualIsbn.trim());
    }
  }

  return (
    <div
      aria-labelledby="scanner-title"
      aria-modal="true"
      className="modal-backdrop"
      role="dialog"
    >
      <div className="modal-card scanner-modal">
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="mono eyebrow">Camera scanner</span>
            <h2 id="scanner-title" style={{ margin: 0, fontSize: "1.2rem" }}>
              Scan Book ISBN Barcode
            </h2>
          </div>
          <button
            aria-label="Close barcode scanner"
            className="button button-quiet"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            type="button"
          >
            ✕ Close
          </button>
        </div>

        <div className="scanner-viewfinder">
          <video
            aria-label="Camera viewfinder"
            className="scanner-video"
            muted
            playsInline
            ref={videoRef}
          />
          <div className="scanner-target-reticle" />
          <div className="scanner-laser" />
        </div>

        <p className="field-help" style={{ textAlign: "center", margin: "0.8rem 0" }}>
          Point camera at the ISBN barcode on the back cover of the book.
        </p>

        {error ? (
          <p className="form-error" role="alert" style={{ fontSize: "0.85rem", margin: "0.5rem 0" }}>
            {error}
          </p>
        ) : null}

        <form onSubmit={handleManualSubmit} style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }} suppressHydrationWarning>
          <input
            className="text-input"
            onChange={(e) => setManualIsbn(e.target.value)}
            placeholder="Or type 10 or 13-digit ISBN..."
            suppressHydrationWarning
            type="text"
            value={manualIsbn}
          />
          <button className="button button-coral" type="submit">
            Use ISBN
          </button>
        </form>
      </div>
    </div>
  );
}
