# Spec: Viral Receipt Sharing, Dynamic Open Graph Cards, RSS Syndication, and Caching

## Assumptions
1. Dynamic Open Graph image generation uses built-in Next.js `ImageResponse` (`next/og`) running on edge/node runtime without adding external heavy font or canvas binaries.
2. The editorial brutalist design language (`coral`, `acid`, `ink`, `paper`, mono accents, 5-star inverted badness scale) is preserved in all generated OG images.
3. RSS / Atom feeds (`/feed.xml`, `/bottom-100.xml`) conform to standard RSS 2.0 XML schema for RSS readers (Feedly, NetNewsWire, Miniflux, etc.).
4. Share button supports Web Share API (`navigator.share`) where available and falls back to clipboard copy (`navigator.clipboard.writeText`) with toast/copied feedback.
5. All code adheres to Next.js 16 App Router conventions and strict TypeScript.

---

## 1. Objective
Enable high-conversion receipt sharing and external discovery for Badreads criticism:
1. **Dynamic OG Cards (`/api/og/roast/[id]`, `/api/og/book/[slug]`, `/api/og/bottom-100`)**: Generate high-contrast, brutalist social preview images containing hook, evidence snippet, star rating, author byline, and book details for iMessage, WhatsApp, Twitter/X, and Discord unfurls.
2. **One-Click Share Receipt Control (`components/ShareReceiptButton.tsx`)**: Allow readers on `RoastCard` and `RoastPage` to share direct receipt links or copy formatted receipt quotes to clipboard.
3. **RSS / Atom Syndication (`app/feed.xml/route.ts`, `app/bottom-100.xml/route.ts`)**: Distribute verified roasts and Bottom 100 disaster movements to open web readers.
4. **Caching & ISR Optimization**: Add granular `Cache-Control` headers and cache tags on RSS feeds and OG endpoints.

---

## 2. Tech Stack & Key Dependencies
- **Framework**: Next.js 16.3.1 (App Router, `next/og` `ImageResponse`)
- **Language**: TypeScript 5.7 (strict mode)
- **Styling**: Native CSS (`app/globals.css`)
- **Data Access**: `DomainStore` (`src/domain/repository.ts`)
- **Testing**: Vitest (`vitest`), React Testing Library, Playwright (`@playwright/test`)

---

## 3. Commands
- **Build**: `pnpm build`
- **Test (Unit & Integration)**: `pnpm test`
- **Test (E2E)**: `pnpm test:e2e`
- **Typecheck**: `pnpm typecheck`
- **Lint**: `pnpm lint`
- **Dev Server**: `pnpm dev`

---

## 4. Project Structure
```
app/
  api/
    og/
      roast/[id]/route.tsx    → Dynamic 1200x630 OG image for individual roasts
      book/[slug]/route.tsx   → Dynamic 1200x630 OG image for books & badness scores
      bottom-100/route.tsx    → Dynamic 1200x630 OG image for the Bottom 100 ranking
    feed.xml/route.ts         → RSS 2.0 XML endpoint for latest roasts
    bottom-100.xml/route.ts   → RSS 2.0 XML endpoint for Bottom 100 list
components/
  ShareReceiptButton.tsx      → Client component for Web Share API & clipboard copy
  ShareReceiptButton.test.tsx → Unit/interaction tests for share button
docs/
  specs/
    spec-viral-sharing-rss-caching.md → This specification
```

---

## 5. Code Style & Conventions
- Pure JSX text rendering; zero `dangerouslySetInnerHTML` on user input.
- Strong TypeScript typing with domain models from `src/domain/types.ts`.
- Server Components by default; `"use client"` only for client hooks (`useState`, `useTransition`, `navigator`).

Example OG card generator pattern:
```tsx
import { ImageResponse } from "next/og";
import { getDomainStore } from "@/src/domain/repository";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const roast = await getDomainStore().getRoast(id);
  if (!roast || roast.status !== "PUBLISHED") {
    return new Response("Not found", { status: 404 });
  }

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", backgroundColor: "#f6f4ee", padding: 60 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 28, fontWeight: 800, color: "#121110" }}>✳ badreads</span>
          <span style={{ fontSize: 24, fontFamily: "monospace", color: "#ff4d2e" }}>5 STARS = WORST</span>
        </div>
        <h1 style={{ fontSize: 52, fontWeight: 900, color: "#121110", marginTop: 40 }}>{roast.hook}</h1>
        <p style={{ fontSize: 28, color: "#45433c", marginTop: 20 }}>{roast.body.slice(0, 180)}...</p>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
```

---

## 6. Testing Strategy
1. **Unit & Route Tests**:
   - Test XML structure and MIME type of `/feed.xml` and `/bottom-100.xml`.
   - Test OG route responses (status 200 on valid IDs, 404 on missing/unpublished roasts).
2. **Component Tests**:
   - `ShareReceiptButton.test.tsx` testing clipboard copy fallback and `navigator.share` invocation.
3. **E2E Tests**:
   - Verify meta tags (`og:image`, `twitter:image`) on `/roasts/[id]` and `/books/[slug]`.
   - Verify `/feed.xml` returns valid `application/xml` content.

---

## 7. Boundaries
- **Always**: Use typed domain getters from `getDomainStore()`; validate XML escaping on feeds; clean up DOM side-effects in component tests.
- **Ask First**: Introducing external font CDNs or heavy canvas binaries.
- **Never**: Render unpublished or pending-review roasts in public RSS feeds or OG routes.

---

## 8. Success Criteria
1. `/api/og/roast/[id]` returns a 1200x630 PNG with roast hook, rating stars, author handle, and book title.
2. `/api/og/book/[slug]` returns a 1200x630 PNG with book title, author, badness rating average, and roast count.
3. `/api/og/bottom-100` returns a 1200x630 PNG with Bottom 100 leaderboard branding.
4. `app/roasts/[id]/page.tsx` and `app/books/[slug]/page.tsx` include dynamic `openGraph` and `twitter` image tags pointing to their respective OG endpoints.
5. `ShareReceiptButton` allows users to copy direct quote + URL with feedback ("Copied!").
6. `/feed.xml` and `/bottom-100.xml` return valid RSS 2.0 XML with appropriate `Content-Type: application/xml`.
7. `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm test:e2e`, and `pnpm build` pass with 0 errors.

---

## 9. Open Questions & Resolution
- *Image generation runtime*: Using Node.js runtime with `next/og` `ImageResponse` for compatibility with domain store.
- *RSS feed size*: Top 50 most recent published roasts in `/feed.xml` and top 100 ranked books in `/bottom-100.xml`.
