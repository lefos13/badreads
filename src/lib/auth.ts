import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { Resend } from "resend";
import { db } from "@/src/db";
import * as schema from "@/src/db/schema";

const secret = process.env.BETTER_AUTH_SECRET ?? "badreads-local-development-secret-please-change";
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const from = process.env.RESEND_FROM_EMAIL ?? "Badreads <hello@example.com>";

async function sendMagicLink({ email, url }: { email: string; url: string }) {
  if (!resend) {
    if (process.env.NODE_ENV === "production") throw new Error("Email delivery is not configured.");
    return;
  }
  const response = await resend.emails.send({
    from,
    to: [email],
    subject: "Your Badreads door is open",
    html: `<p>One click and you can tell the truth about that book.</p><p><a href="${url}">Enter Badreads</a></p><p>This link expires in five minutes.</p>`,
  });
  if (response.error) throw new Error("Unable to send your sign-in email.");
}

const magicLinkPlugin = magicLink({
  sendMagicLink,
  storeToken: "hashed",
  expiresIn: 300,
  rateLimit: { window: 60, max: 5 },
});

const baseOptions = {
  secret,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
  emailAndPassword: { enabled: false },
  plugins: [magicLinkPlugin],
};

export const auth = db
  ? betterAuth({
      ...baseOptions,
      database: drizzleAdapter(db, { provider: "pg", schema, usePlural: false }),
    })
  : betterAuth(baseOptions);
