import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.1.2", "192.168.*", "10.*", "*.local", "eevangelinos-MacBook-Pro.local", "*.loca.lt", "*.trycloudflare.com"],
  outputFileTracingRoot: path.resolve(__dirname),
  /*
   * These headers establish a conservative browser boundary for public pages
   * and server actions. The development-only eval allowance is kept out of
   * production so the same policy remains useful during a real launch.
   */
  async headers() {
    const development = process.env.NODE_ENV !== "production";
    const contentSecurityPolicy = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https://covers.openlibrary.org https://*.archive.org https://archive.org https://*.us.archive.org https://images.unsplash.com",
      "connect-src 'self' https://openlibrary.org",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; ");

    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ...(development ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
      ],
    }];
  },
  images: {
    minimumCacheTTL: 2592000,
    remotePatterns: [
      { protocol: "https", hostname: "covers.openlibrary.org" },
      { protocol: "https", hostname: "*.archive.org" },
      { protocol: "https", hostname: "archive.org" },
      { protocol: "https", hostname: "*.us.archive.org" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
