import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { Resend } from "resend";
import { db } from "@/src/db";
import { cleanEnvString, getAuthRuntimeMode, hasEmailDeliveryConfig, isDemoMode } from "./runtime-config";
import { normalizeAppUrl } from "./url-config";
import { authDatabaseOptions } from "./auth-database";

const secret = cleanEnvString(process.env.BETTER_AUTH_SECRET) || (process.env.NODE_ENV === "production" ? null : "badreads-local-development-secret-please-change");
if (!secret) throw new Error("BETTER_AUTH_SECRET is required in production.");

const resendApiKey = cleanEnvString(process.env.RESEND_API_KEY);
const from = cleanEnvString(process.env.RESEND_FROM_EMAIL) || "Badreads <onboarding@resend.dev>";
const resend = hasEmailDeliveryConfig() && resendApiKey ? new Resend(resendApiKey) : null;
export const BYPASS_DEMO_EMAILS = [
  "lefterisevagelinos1996@gmail.com",
  "demo@badreads.local",
  "mara@badreads.local",
  "otto@badreads.local",
  "jules@badreads.local",
];

export function isBypassEmail(email: string): boolean {
  return BYPASS_DEMO_EMAILS.includes(email.trim().toLowerCase());
}

export type DevMagicLinkEntry = {
  email: string;
  url: string;
  token?: string;
  createdAt: number;
};

const devMagicLinks = new Map<string, DevMagicLinkEntry>();

export function getLatestDevMagicLink(email?: string): DevMagicLinkEntry | null {
  if (email) {
    return devMagicLinks.get(email.trim().toLowerCase()) ?? null;
  }
  let newest: DevMagicLinkEntry | null = null;
  for (const entry of devMagicLinks.values()) {
    if (!newest || entry.createdAt > newest.createdAt) {
      newest = entry;
    }
  }
  return newest;
}

export function setLatestDevMagicLink(email: string, url: string, token?: string): void {
  devMagicLinks.set(email.trim().toLowerCase(), {
    email: email.trim().toLowerCase(),
    url,
    token,
    createdAt: Date.now(),
  });
}
function getCanonicalAuthUrl(): string {
  const custom = cleanEnvString(process.env.BETTER_AUTH_URL)
    || cleanEnvString(process.env.NEXT_PUBLIC_BETTER_AUTH_URL)
    || cleanEnvString(process.env.NEXT_PUBLIC_SITE_URL);
  if (custom) return normalizeAppUrl(custom);

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return normalizeAppUrl(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }

  if (process.env.NODE_ENV === "production") {
    return "https://badreads.vercel.app";
  }

  if (process.env.VERCEL_URL) {
    return normalizeAppUrl(`https://${process.env.VERCEL_URL}`);
  }

  return "http://localhost:3000";
}

const authUrl = getCanonicalAuthUrl();

function toCanonicalUrl(rawUrl: string, canonicalBase: string): string {
  try {
    const parsed = new URL(rawUrl);
    const base = new URL(canonicalBase);
    parsed.protocol = base.protocol;
    parsed.host = base.host;
    parsed.port = base.port;
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

async function sendMagicLink({ email, url, token }: { email: string; url: string; token?: string }) {
  const normalizedEmail = email.trim().toLowerCase();
  const isDev = process.env.NODE_ENV !== "production";
  const allowDevBypass = isDev && (isBypassEmail(normalizedEmail) || !resend);
  const destinationUrl = toCanonicalUrl(url, authUrl);

  if (allowDevBypass) {
    setLatestDevMagicLink(normalizedEmail, destinationUrl, token);
    // eslint-disable-next-line no-console
    console.info("\n========================================================");
    // eslint-disable-next-line no-console
    console.info(`[Badreads Dev Auth] Magic link generated for ${email}:`);
    // eslint-disable-next-line no-console
    console.info(`  --> ${destinationUrl}`);
    // eslint-disable-next-line no-console
    console.info("========================================================\n");
    return;
  }

  if (!resend) {
    const mode = getAuthRuntimeMode();
    throw new Error(mode === "demo" && isDemoMode()
      ? "Magic-link sign-in is disabled in local demo mode."
      : "Magic-link email delivery is not configured.");
  }
  try {
    const response = await resend.emails.send({
      from,
      to: [email],
      subject: "Your Badreads door is open",
      html: `<p>One click and you can tell the truth about that book.</p><p><a href="${destinationUrl}">Enter Badreads</a></p><p>This link expires in five minutes.</p>`,
    });
    if (response.error) {
      // eslint-disable-next-line no-console
      console.error("[Resend Error]:", JSON.stringify(response.error, null, 2));
      throw new Error(`Unable to send your sign-in email: ${response.error.message || response.error.name}`);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[Resend Send Exception]:", err);
    throw err instanceof Error ? err : new Error("Unable to send your sign-in email.");
  }
}

const magicLinkPlugin = magicLink({
  sendMagicLink,
  storeToken: "hashed",
  expiresIn: 300,
  rateLimit: { window: 60, max: 5 },
});

const trustedOrigins = Array.from(new Set([
  authUrl,
  "https://badreads.vercel.app",
  ...(process.env.NEXT_PUBLIC_SITE_URL ? [normalizeAppUrl(process.env.NEXT_PUBLIC_SITE_URL)] : []),
  ...(process.env.NEXT_PUBLIC_BETTER_AUTH_URL ? [normalizeAppUrl(process.env.NEXT_PUBLIC_BETTER_AUTH_URL)] : []),
  ...(process.env.BETTER_AUTH_URL ? [normalizeAppUrl(process.env.BETTER_AUTH_URL)] : []),
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ...(process.env.VERCEL_PROJECT_PRODUCTION_URL ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`] : []),
])).filter(Boolean);

const baseOptions = {
  secret,
  baseURL: authUrl,
  trustedOrigins,
  emailAndPassword: { enabled: false },
  plugins: [magicLinkPlugin],
};

export const auth = db
  ? betterAuth({
      ...baseOptions,
      database: drizzleAdapter(db, authDatabaseOptions),
    })
  : betterAuth(baseOptions);
