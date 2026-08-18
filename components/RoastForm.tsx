"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FLAW_TAGS } from "@/src/domain/core";
import { submitRoastAction, type RoastActionState } from "@/app/actions";

const initialState: RoastActionState = { ok: false, message: "" };

export function RoastForm({ bookId, bookTitle }: { bookId: string; bookTitle: string }) {
  const [state, action, pending] = useActionState(submitRoastAction, initialState);

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
    <form action={action} className="roast-form">
      <input name="bookId" type="hidden" value={bookId} />
      <div className="field">
        <label htmlFor="hook">The hook</label>
        <input className="text-input" id="hook" maxLength={140} minLength={10} name="hook" placeholder="A fortune cookie wearing a library costume." required />
        <span className="field-help">10–140 characters. Make us stop scrolling.</span>
      </div>
      <div className="field">
        <label htmlFor="body">The receipts</label>
        <textarea className="text-area" id="body" maxLength={3000} minLength={80} name="body" placeholder={`What exactly did ${bookTitle} get wrong?`} required />
        <span className="field-help">80–3,000 characters. Critique the work, not the person.</span>
      </div>
      <fieldset className="field">
        <legend>How bad was it?</legend>
        <div className="rating-grid">
          {[1, 2, 3, 4, 5].map((rating) => (
            <label className="rating-option" key={rating}>
              <input defaultChecked={rating === 3} name="rating" type="radio" value={rating} />
              <span aria-hidden="true">{"★".repeat(rating)}</span>
              <small>{rating === 5 ? "Worst" : rating === 1 ? "Mild" : ""}</small>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="field">
        <legend>What broke?</legend>
        <div className="tag-grid">
          {FLAW_TAGS.map((tag) => (
            <label className="tag-option" key={tag}>
              <input name="flawTags" type="checkbox" value={tag} />
              {tag.replaceAll("_", " ")}
            </label>
          ))}
        </div>
        <span className="field-help">Pick one to three. Specific complaints age better.</span>
      </fieldset>
      <label className="tag-option" htmlFor="spoiler"><input id="spoiler" name="spoiler" type="checkbox" /> This roast contains spoilers.</label>
      {state.message ? <p aria-live="polite" className="form-error">{state.message}</p> : null}
      <button className="button button-coral" disabled={pending} type="submit">{pending ? "Sending to the tribunal…" : "Publish the verdict"}</button>
    </form>
  );
}
