"use client";

import { useActionState, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { COVER_TONES, type CoverTone } from "@/src/domain/core";
import {
  createCommunityBookAction,
  updateCommunityBookAction,
  type CommunityBookActionState,
} from "@/app/actions";
import type { BookWork } from "@/src/domain/types";

const initialState: CommunityBookActionState = { ok: false, message: "" };
function downscaleImage(file: File, maxDim = 256): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve("");
    reader.onload = () => {
      const rawResult = typeof reader.result === "string" ? reader.result : "";
      if (!rawResult || typeof window === "undefined" || typeof document === "undefined") {
        return resolve(rawResult);
      }
      try {
        const img = new Image();
        img.onerror = () => resolve(rawResult);
        img.onload = () => {
          try {
            let { width, height } = img;
            if (!width || !height) {
              return resolve(rawResult);
            }
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              return resolve(rawResult);
            }
            ctx.drawImage(img, 0, 0, width, height);
            let dataUrl = canvas.toDataURL("image/webp", 0.85);
            if (!dataUrl || !dataUrl.startsWith("data:image/webp")) {
              dataUrl = canvas.toDataURL("image/jpeg", 0.85);
            }
            resolve(dataUrl || rawResult);
          } catch {
            resolve(rawResult);
          }
        };
        img.src = rawResult;
      } catch {
        resolve(rawResult);
      }
    };
    reader.readAsDataURL(file);
  });
}

type BookFormProps = {
  mode: "create" | "edit";
  initialIsbn?: string;
  initialData?: Partial<BookWork>;
};

export function BookForm({ mode, initialIsbn = "", initialData }: BookFormProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    mode === "create" ? createCommunityBookAction : updateCommunityBookAction,
    initialState,
  );

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [authors, setAuthors] = useState(initialData?.authors?.join(", ") ?? "");
  const [isbn, setIsbn] = useState(initialData?.isbn ?? initialIsbn);
  const [firstPublished, setFirstPublished] = useState(
    initialData?.firstPublished ? String(initialData.firstPublished) : "",
  );
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [coverTone, setCoverTone] = useState<CoverTone>(initialData?.coverTone ?? "acid");
  const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialData?.coverUrl ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Please select an image smaller than 5MB.");
      return;
    }
    const downscaled = await downscaleImage(file, 256);
    if (downscaled) {
      setCoverDataUrl(downscaled);
      setPreviewUrl(downscaled);
    }
  }

  useEffect(() => {
    if (state.ok && state.bookSlug) {
      router.push(`/books/${state.bookSlug}`);
    }
  }, [state.ok, state.bookSlug, router]);

  return (
    <form action={action} className="roast-form book-form">
      {mode === "edit" && initialData?.id ? (
        <input type="hidden" name="bookId" value={initialData.id} />
      ) : null}

      {coverDataUrl ? (
        <input type="hidden" name="coverDataUrl" value={coverDataUrl} />
      ) : null}
      <div className="field">
        <label htmlFor="book-title">Title *</label>
        <input
          id="book-title"
          name="title"
          className="text-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. The Untold Chronicle"
          required
          maxLength={200}
        />
      </div>

      <div className="field">
        <label htmlFor="book-authors">Author(s) *</label>
        <input
          id="book-authors"
          name="authors"
          className="text-input"
          value={authors}
          onChange={(e) => setAuthors(e.target.value)}
          placeholder="e.g. Jane Doe, John Smith"
          required
        />
        <span className="field-help">Separate multiple authors with commas.</span>
      </div>

      <div className="field">
        <label htmlFor="book-isbn">ISBN (10 or 13 digits) *</label>
        {mode === "edit" ? (
          <>
            <input
              id="book-isbn"
              className="text-input font-mono"
              value={isbn}
              disabled
              readOnly
            />
            <span className="field-help">ISBN is permanently locked to preserve identifier integrity.</span>
          </>
        ) : (
          <>
            <input
              id="book-isbn"
              name="isbn"
              className="text-input font-mono"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              placeholder="e.g. 9780306406157"
              required
            />
            <span className="field-help">Must be an untracked 10- or 13-digit ISBN.</span>
          </>
        )}
      </div>

      <div className="field">
        <label htmlFor="book-year">Publication Year (optional)</label>
        <input
          id="book-year"
          name="firstPublished"
          className="text-input"
          type="number"
          min={1000}
          max={new Date().getFullYear() + 5}
          value={firstPublished}
          onChange={(e) => setFirstPublished(e.target.value)}
          placeholder="e.g. 2024"
        />
      </div>

      <div className="field">
        <label htmlFor="book-description">Description / Synopsis (optional)</label>
        <textarea
          id="book-description"
          name="description"
          className="text-area"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this book about? Provide brief context for future roasters."
          maxLength={4000}
          rows={4}
        />
      </div>

      <div className="field">
        <label htmlFor="book-cover-tone">Cover Tone Palette</label>
        <div className="tone-selector-group">
          {COVER_TONES.map((tone) => (
            <label key={tone} className={`tone-option-label ${coverTone === tone ? "selected" : ""}`}>
              <input
                type="radio"
                name="coverTone"
                value={tone}
                checked={coverTone === tone}
                onChange={() => setCoverTone(tone)}
              />
              <span className={`tone-pill tone-${tone}`}>{tone}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="book-cover-image">Cover Image Upload (JPG, PNG, WebP &le; 3MB)</label>
        <input
          ref={fileInputRef}
          id="book-cover-image"
          name="coverImage"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          onChange={handleFileChange}
          className="file-input"
        />
        {previewUrl ? (
          <div className="cover-preview-wrapper">
            <span className="eyebrow mono">Cover Preview:</span>
            <img src={previewUrl} alt="Cover preview" className="cover-preview-image" />
          </div>
        ) : null}
      </div>

      {state.message ? (
        <div className={state.ok ? "form-success" : "form-error"} role="alert">
          <p>{state.message}</p>
          {state.bookSlug ? (
            <p>
              <Link href={`/books/${state.bookSlug}`} className="button button-quiet">
                View Book &rarr;
              </Link>
            </p>
          ) : null}
          {state.providerWorkId ? (
            <p>
              <Link
                href={`/catalog/choose?providerWorkId=${encodeURIComponent(state.providerWorkId)}`}
                className="button button-primary"
              >
                Import from Open Library &rarr;
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="form-actions">
        <button className="button button-primary" disabled={pending} type="submit">
          {pending
            ? mode === "create"
              ? "Adding Book…"
              : "Updating Details…"
            : mode === "create"
              ? "Add Book to Catalog"
              : "Save Changes"}
        </button>
        <Link href={mode === "edit" && initialData?.slug ? `/books/${initialData.slug}` : "/search"} className="button button-quiet">
          Cancel
        </Link>
      </div>
    </form>
  );
}
