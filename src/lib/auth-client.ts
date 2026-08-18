"use client";

import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";
import { normalizeAppUrl } from "./url-config";

export const authClient = createAuthClient({
  baseURL: normalizeAppUrl(process.env.NEXT_PUBLIC_BETTER_AUTH_URL),
  plugins: [magicLinkClient()],
});
