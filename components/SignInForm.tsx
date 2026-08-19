"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { authClient } from "@/src/lib/auth-client";
import { requestDevBypassMagicLinkAction } from "@/app/actions";
export function SignInForm({ demoMode, registrationEnabled }: { demoMode: boolean; registrationEnabled: boolean }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleQuickBypass(targetEmail = "lefterisevagelinos1996@gmail.com") {
    setError(null);
    setMessage(null);
    setPending(true);
    setEmail(targetEmail);
    const result = await requestDevBypassMagicLinkAction(targetEmail);
    setPending(false);
    if (result.ok && result.url) {
      setMessage("Bypass magic link generated (Resend bypassed). Entering Badreads…");
      window.location.href = result.url;
    } else if (result.ok) {
      setMessage("Magic link generated. Check your server terminal.");
    } else {
      setError(result.message || "Could not generate bypass link.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!registrationEnabled) {
      setError("Registration is currently paused.");
      return;
    }
    setError(null);
    setMessage(null);
    setPending(true);

    if (email.trim().toLowerCase() === "lefterisevagelinos1996@gmail.com") {
      const result = await requestDevBypassMagicLinkAction(email);
      setPending(false);
      if (result.ok && result.url) {
        setMessage("Bypass magic link generated (Resend bypassed). Entering Badreads…");
        window.location.href = result.url;
      } else if (result.ok) {
        setMessage("Magic link generated. Check your server terminal.");
      } else {
        setError(result.message || "Could not generate bypass link.");
      }
      return;
    }

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
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <button className="button button-primary" disabled={pending || !registrationEnabled} type="submit">{pending ? "Sending…" : registrationEnabled ? "Send me a magic link" : "Registration paused"}</button>
          <button className="button button-quiet" disabled={pending} onClick={() => handleQuickBypass("lefterisevagelinos1996@gmail.com")} type="button">1-Click Local DB Bypass (Lefteris)</button>
        </div>
      </form>
      {message ? <p aria-live="polite" className="form-success">{message}</p> : null}
      {error ? <p aria-live="polite" className="form-error">{error}</p> : null}
    </div>
  );
}
