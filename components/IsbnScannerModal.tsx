"use client";

import { useEffect, useRef, useState } from "react";

type BarcodeDetectorInstance = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string; format: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats: string[] }): BarcodeDetectorInstance;
      getSupportedFormats?: () => Promise<string[]>;
    };
  }
}

export function IsbnScannerModal({
  onScan,
  onClose,
}: {
  onScan: (isbn: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualIsbn, setManualIsbn] = useState("");
  const [isScanning, setIsScanning] = useState(true);

  // Stop camera tracks cleanly
  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  function handleFoundIsbn(rawValue: string) {
    const cleaned = rawValue.replace(/[^0-9Xx]/g, "");
    if (cleaned.length >= 10 && cleaned.length <= 13) {
      stopCamera();
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(100);
        } catch {
          // Ignore
        }
      }
      onScan(cleaned);
    }
  }

  useEffect(() => {
    let isActive = true;
    let scanInterval: NodeJS.Timeout | null = null;

    async function startCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Camera access is not supported on this browser.");
        setIsScanning(false);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });

        if (!isActive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if (window.BarcodeDetector) {
          const detector = new window.BarcodeDetector({
            formats: ["ean_13", "ean_8", "upc_a", "code_128"],
          });

          scanInterval = setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0 && barcodes[0].rawValue) {
                handleFoundIsbn(barcodes[0].rawValue);
              }
            } catch {
              // Ignore frame detection errors
            }
          }, 250);
        } else {
          setError("Native barcode detection is not available in this browser. You can enter the ISBN directly.");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Camera permission denied.";
        setError(`Unable to access camera: ${message}`);
        setIsScanning(false);
      }
    }

    startCamera();

    // Close modal on Escape
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        stopCamera();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      isActive = false;
      if (scanInterval) clearInterval(scanInterval);
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

        <form onSubmit={handleManualSubmit} style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
          <input
            className="text-input"
            onChange={(e) => setManualIsbn(e.target.value)}
            placeholder="Or type 10 or 13-digit ISBN..."
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
