"use client";

import { useActionState } from "react";
import { createProfileAction, type ProfileActionState } from "@/app/actions";

const initialState: ProfileActionState = { ok: false, message: "" };

/*
 * Onboarding deliberately asks only for a public byline and an age gate. The
 * private email remains in Better Auth, while the profile becomes the stable
 * identity used by roasts, follows, and moderation records.
 */

export function OnboardingForm() {
  const [state, action, pending] = useActionState(createProfileAction, initialState);

  return (
    <form action={action} className="roast-form">
      <div className="field">
        <label htmlFor="handle">Public handle</label>
        <input autoComplete="nickname" className="text-input" id="handle" maxLength={24} minLength={3} name="handle" pattern="[A-Za-z0-9_]+" placeholder="thelastchapter" required />
        <span className="field-help">Letters, numbers, and underscores. This is the only name other readers see.</span>
      </div>
      <div className="field">
        <label htmlFor="displayName">Display name</label>
        <input className="text-input" id="displayName" maxLength={60} name="displayName" placeholder="The Last Chapter" required />
      </div>
      <div className="field">
        <label htmlFor="bio">One-line bio (optional)</label>
        <textarea className="text-area" id="bio" maxLength={160} name="bio" placeholder="I finish books so you can avoid them." />
      </div>
      <label className="tag-option" htmlFor="ageConfirmed">
        <input id="ageConfirmed" name="ageConfirmed" required type="checkbox" /> I confirm I am 16 or older.
      </label>
      {state.message ? <p aria-live="polite" className={state.ok ? "form-success" : "form-error"}>{state.message}</p> : null}
      <button className="button button-primary" disabled={pending} type="submit">{pending ? "Setting the byline…" : "Continue to Badreads"}</button>
    </form>
  );
}
