const LOCAL_APP_URL = "http://localhost:3000";
const HTTP_PROTOCOLS = new Set(["http:", "https:"]);

/* Keep build-time metadata, sitemap generation, and auth configuration resilient to empty or malformed deployment variables. A blank value is different from an unset value in Vercel, so nullish coalescing alone is not sufficient. */
export function resolveAppUrl(value: string | undefined, fallback = LOCAL_APP_URL): URL {
  const candidate = value?.trim();
  if (!candidate) return new URL(fallback);

  try {
    const url = new URL(candidate);
    return HTTP_PROTOCOLS.has(url.protocol) ? url : new URL(fallback);
  } catch {
    return new URL(fallback);
  }
}

export function normalizeAppUrl(value: string | undefined, fallback = LOCAL_APP_URL): string {
  return resolveAppUrl(value, fallback).toString().replace(/\/$/, "");
}
