"use client";

import { useActionState, type FormEvent } from "react";
import { deleteAccountAction, type AccountActionState } from "@/app/actions";

const initialState: AccountActionState = { ok: false, message: "" };

/*
 * Export is a private, cache-disabled download. Deletion is an explicit
 * browser-confirmed server action so an accidental click cannot erase a
 * reader's public byline without a second deliberate step.
 */

export function AccountControls() {
  const [state, action, pending] = useActionState(deleteAccountAction, initialState);

  function confirmDeletion(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm("Delete your public profile and roasts? This cannot be undone.")) event.preventDefault();
  }

  return (
    <div className="account-controls">
      <a className="button button-quiet" download href="/api/account/export">Download my data</a>
      <form action={action} onSubmit={confirmDeletion}>
        <button className="button button-coral" disabled={pending} type="submit">{pending ? "Deleting…" : "Delete public account"}</button>
      </form>
      {state.message ? <p aria-live="polite" className={state.ok ? "form-success" : "form-error"}>{state.message}</p> : null}
    </div>
  );
}
