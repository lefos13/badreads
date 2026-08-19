"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { authClient } from "@/src/lib/auth-client";

export function SignInForm({ demoMode, registrationEnabled }: { demoMode: boolean; registrationEnabled: boolean }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!registrationEnabled) {
      setError("Registration is currently paused.");
      return;
    }
    setError(null);
    setMessage(null);
    setPending(true);
    const result = await authClient.signIn.magicLink({ email, callbackURL: "/write" });
    setPending(false);
    if (result.error) setError("We could not send that link. Check the address and try again.");
    else setMessage("Check your inbox. The door is open for five minutes.");
  }

  if (demoMode) {
    return (
      <div className="form-shell">
        <span className="eyebrow mono">Local demo / no email required</span>
        <h1>Come say the quiet part.</h1>
        <p className="form-intro">This local workspace uses a demo session, so no email address or Resend domain is needed.</p>
        <Link className="button button-primary" href="/write">Continue in local demo</Link>
        <p className="field-help">Set <code>DEMO_MODE=false</code> only after configuring a database, Better Auth secret, and email delivery.</p>
      </div>
    );
  }

  return (
    <div className="form-shell">
      <span className="eyebrow mono">Private email / public handle</span>
      <h1>Come say the quiet part.</h1>
      <p className="form-intro">Your email stays private. Your handle gets the byline. Badreads is for sharp criticism of books, not people.</p>
      <form className="roast-form" onSubmit={handleSubmit} suppressHydrationWarning>
        <div className="field">
          <label htmlFor="email">Email address</label>
          <input autoComplete="email" className="text-input" id="email" onChange={(event) => setEmail(event.target.value)} required suppressHydrationWarning type="email" value={email} />
        </div>
        <button className="button button-primary" disabled={pending || !registrationEnabled} type="submit">{pending ? "Sending…" : registrationEnabled ? "Send me a magic link" : "Registration paused"}</button>
      </form>
      {message ? <p aria-live="polite" className="form-success">{message}</p> : null}
      {error ? <p aria-live="polite" className="form-error">{error}</p> : null}
    </div>
  );
}
