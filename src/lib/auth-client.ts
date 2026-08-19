"use client";

import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";
import { normalizeAppUrl } from "./url-config";

function getClientBaseUrl(): string | undefined {
  if (process.env.NEXT_PUBLIC_BETTER_AUTH_URL) {
    return normalizeAppUrl(process.env.NEXT_PUBLIC_BETTER_AUTH_URL);
  }
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return normalizeAppUrl(process.env.NEXT_PUBLIC_SITE_URL);
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return undefined;
}

export const authClient = createAuthClient({
  baseURL: getClientBaseUrl(),
  plugins: [magicLinkClient()],
});
