import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { Resend } from "resend";
import { db } from "@/src/db";
import { getAuthRuntimeMode, hasEmailDeliveryConfig, isDemoMode } from "./runtime-config";
import { normalizeAppUrl } from "./url-config";
import { authDatabaseOptions } from "./auth-database";

const secret = process.env.BETTER_AUTH_SECRET?.trim() || (process.env.NODE_ENV === "production" ? null : "badreads-local-development-secret-please-change");
if (!secret) throw new Error("BETTER_AUTH_SECRET is required in production.");

const resend = hasEmailDeliveryConfig() ? new Resend(process.env.RESEND_API_KEY) : null;
const from = process.env.RESEND_FROM_EMAIL?.trim() || "Badreads <onboarding@resend.dev>";

async function sendMagicLink({ email, url }: { email: string; url: string }) {
  if (!resend) {
    const mode = getAuthRuntimeMode();
    throw new Error(mode === "demo" && isDemoMode()
      ? "Magic-link sign-in is disabled in local demo mode."
      : "Magic-link email delivery is not configured.");
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

const authUrl = normalizeAppUrl(process.env.BETTER_AUTH_URL);

const baseOptions = {
  secret,
  baseURL: authUrl,
  trustedOrigins: [authUrl],
  emailAndPassword: { enabled: false },
  plugins: [magicLinkPlugin],
};

export const auth = db
  ? betterAuth({
      ...baseOptions,
      database: drizzleAdapter(db, authDatabaseOptions),
    })
  : betterAuth(baseOptions);
