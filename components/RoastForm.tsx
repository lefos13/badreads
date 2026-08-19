"use client";

import Link from "next/link";
import { useEffect, useState, useActionState } from "react";
import { FLAW_TAGS, type FlawTag } from "@/src/domain/core";
import { submitRoastAction, type RoastActionState } from "@/app/actions";

const initialState: RoastActionState = { ok: false, message: "" };

export function RoastForm({ bookId, bookTitle }: { bookId: string; bookTitle: string }) {
  const [state, action, pending] = useActionState(submitRoastAction, initialState);
  const storageKey = `badreads_draft_${bookId}`;

  const [hook, setHook] = useState("");
  const [body, setBody] = useState("");
  const [selectedTags, setSelectedTags] = useState<FlawTag[]>([]);
  const [rating, setRating] = useState(3);
  const [hasRestored, setHasRestored] = useState(false);

  // Restore draft from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.hook) setHook(parsed.hook);
        if (parsed.body) setBody(parsed.body);
        if (parsed.rating) setRating(parsed.rating);
        if (Array.isArray(parsed.selectedTags)) setSelectedTags(parsed.selectedTags);
        setHasRestored(true);
      }
    } catch {
      // Ignore storage read failures
    }
  }, [storageKey]);

  // Persist draft to sessionStorage
  useEffect(() => {
    if (!state.ok) {
      try {
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({ hook, body, rating, selectedTags }),
        );
      } catch {
        // Ignore storage write failures
      }
    }
  }, [hook, body, rating, selectedTags, storageKey, state.ok]);

  // Clear draft on successful submission
  useEffect(() => {
    if (state.ok) {
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        // Ignore
      }
    }
  }, [state.ok, storageKey]);

  function handleTagToggle(tag: FlawTag) {
    setSelectedTags((current) => {
      if (current.includes(tag)) {
        return current.filter((t) => t !== tag);
      }
      if (current.length >= 3) {
        return current;
      }
      return [...current, tag];
    });
  }

  if (state.ok && state.roastId) {
    return (
      <div className="empty-state" role="status">
        <span className="eyebrow mono">Transmission received</span>
        <h2>{state.message}</h2>
        <div className="hero-actions">
          <Link className="button button-primary" href={`/roasts/${state.roastId}`}>Open your roast</Link>
          <Link className="button button-quiet" href="/feed">Read the feed</Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="roast-form" suppressHydrationWarning>
      {hasRestored ? (
        <p className="form-success mono text-xs" role="status">
          ✓ Draft restored from your browser session.
        </p>
      ) : null}
      <input name="bookId" type="hidden" value={bookId} />
      <div className="field">
        <div className="field-label-row">
          <label htmlFor="hook">The hook</label>
          <span className="field-counter mono">{hook.length}/140</span>
        </div>
        <input
          className="text-input"
          id="hook"
          maxLength={140}
          minLength={10}
          name="hook"
          onChange={(e) => setHook(e.target.value)}
          placeholder="A fortune cookie wearing a library costume."
          required
          suppressHydrationWarning
          value={hook}
        />
        <span className="field-help">10–140 characters. Make us stop scrolling.</span>
      </div>

      <div className="field">
        <div className="field-label-row">
          <label htmlFor="body">The receipts</label>
          <span className={`field-counter mono ${body.length < 80 ? "counter-warn" : ""}`}>
            {body.length}/3,000 {body.length < 80 ? `(needs ${80 - body.length} more)` : ""}
          </span>
        </div>
        <textarea
          className="text-area"
          id="body"
          maxLength={3000}
          minLength={80}
          name="body"
          onChange={(e) => setBody(e.target.value)}
          placeholder={`What exactly did ${bookTitle} get wrong?`}
          required
          value={body}
        />
        <span className="field-help">80–3,000 characters. Critique the work, not the person.</span>
      </div>

      <fieldset className="field">
        <legend>How bad was it?</legend>
        <div className="rating-grid">
          {[1, 2, 3, 4, 5].map((val) => (
            <label className={`rating-option ${rating === val ? "selected" : ""}`} key={val}>
              <input
                checked={rating === val}
                name="rating"
                onChange={() => setRating(val)}
                type="radio"
                value={val}
              />
              <span aria-hidden="true">{"★".repeat(val)}</span>
              <small>{val === 5 ? "Worst" : val === 1 ? "Mild" : ""}</small>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <div className="field-label-row">
          <legend>What broke?</legend>
          <span className="field-counter mono">{selectedTags.length}/3 selected</span>
        </div>
        <div className="tag-grid">
          {FLAW_TAGS.map((tag) => {
            const isChecked = selectedTags.includes(tag);
            return (
              <label className={`tag-option ${isChecked ? "selected" : ""}`} key={tag}>
                <input
                  checked={isChecked}
                  name="flawTags"
                  onChange={() => handleTagToggle(tag)}
                  type="checkbox"
                  value={tag}
                />
                {tag.replaceAll("_", " ")}
              </label>
            );
          })}
        </div>
        <span className="field-help">Pick one to three. Specific complaints age better.</span>
      </fieldset>

      <label className="tag-option" htmlFor="spoiler">
        <input id="spoiler" name="spoiler" type="checkbox" /> This roast contains spoilers.
      </label>

      {state.message ? <p aria-live="polite" className="form-error">{state.message}</p> : null}
      <button className="button button-coral" disabled={pending} type="submit">
        {pending ? "Sending to the tribunal…" : "Publish the verdict"}
      </button>
    </form>
  );
}
