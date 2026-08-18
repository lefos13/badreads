<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Badreads — Agent & Contributor Guide

Badreads is an English-first, public roast network for readers who want to explain why a book failed them. A five-star rating is the worst possible verdict, and every roast requires a hook, evidence ("receipts"), flaw tags, and an optional spoiler marker.

This repository is built as a Next.js App Router modular monolith written in strict TypeScript.

---

## 1. Tech Stack & Key Dependencies

- **Framework**: Next.js 16 (App Router), React 19, TypeScript 5 (strict mode)
- **Styling**: Custom modern CSS (`app/globals.css`) — no Tailwind, no CSS modules, semantic class names
- **Database & ORM**: PostgreSQL via Neon Serverless (`@neondatabase/serverless` + `drizzle-orm/neon-http`), Drizzle Kit (`drizzle-kit`) for migrations
- **Authentication**: Better Auth (`better-auth`) with Drizzle adapter and `magicLink` plugin; mock session fallback in demo mode
- **Email Delivery**: Resend (`resend`)
- **Validation**: Zod 3 (`zod`)
- **Icons**: Lucide React (`lucide-react`) + Unicode symbols
- **Testing**:
  - Unit & Integration: Vitest (`vitest`), JSDOM (`jsdom`), React Testing Library (`@testing-library/react`, `@testing-library/jest-dom`)
  - End-to-End: Playwright (`@playwright/test`)
- **Package Manager**: `pnpm` (v11+)

---

## 2. Common Commands & Workflows

```bash
# Development
pnpm dev              # Start Next.js development server (localhost:3000)
pnpm build            # Build application with Webpack bundler
pnpm start            # Start built production server

# Quality Gates (must pass before completing tasks)
pnpm lint             # Run ESLint (eslint .)
pnpm typecheck        # Generate Next.js route types and verify TS (next typegen && tsc --noEmit)
pnpm test             # Run Vitest unit/integration test suite
pnpm test:watch       # Run Vitest in interactive watch mode
pnpm test:e2e         # Run Playwright end-to-end tests

# Database & Migrations
pnpm db:generate      # Generate Drizzle migration files from src/db/schema.ts
pnpm db:migrate       # Apply migrations to configured DATABASE_URL
pnpm db:seed          # Seed launch dataset into Postgres (tsx scripts/seed.ts)
pnpm db:import        # Import starter catalog or custom books into Postgres (tsx scripts/import-books.ts)
pnpm audit --prod     # Audit production dependencies for vulnerabilities
```

---

## 3. Architecture & Design Principles

### Modular Monolith with Clean Domain Seams
Code is strictly segregated into domain layers so catalog, identity, roasts, social, moderation, and analytics can be moved behind separate API boundaries in the future without breaking contracts:

- `src/domain/`: Pure TypeScript domain types, schemas, validation rules, algorithms, and data access interfaces. Zero HTTP or Next.js dependencies.
- `src/db/`: PostgreSQL Drizzle schema, relations, enums, and database client initialization.
- `src/catalog/`: External catalog provider adapters (Open Library) with sanitization, timeouts, and fallback handling.
- `src/lib/`: Server utilities (auth, session extraction, role authorization, rate limiting, URL normalization, runtime mode detection).
- `src/data/`: Static seed and demo records (`demo.ts`, `launch-seed.ts`).
- `app/`: Next.js App Router presentation layer, route handlers (`app/api/`), server actions (`app/actions.ts`), metadata, sitemaps.
- `components/`: Reusable React components (Server Components by default; `"use client"` only where client hooks/interactions are required).

### Domain Repository & Dual-Store Strategy
All data access goes through the unified `DomainStore` async interface (`src/domain/repository.ts`):
- **Memory Domain Store** (`src/domain/store.ts`): Fully functional, seeded in-memory store for local demo mode and unit tests.
- **Postgres Domain Store** (`src/domain/repository.ts`): Drizzle/Neon-backed store for production and live staging.
- **Resolution via `getDomainStore()`**: Automatically resolves to the memory store in demo mode or the Postgres store when configured. Server components and actions **MUST ALWAYS** call `getDomainStore()` rather than querying Drizzle tables directly for business operations.

### Runtime Environment & Demo Mode Strategy (`src/lib/runtime-config.ts`)
- `DEMO_MODE=true` (default in development): Runs with zero external credentials needed. Uses seeded in-memory records, provides a demo session ("Mara Reads"), disables magic-link email sending (surfaces demo access in UI), and grants moderator access.
- `DEMO_MODE=false`: Requires `DATABASE_URL`, `BETTER_AUTH_SECRET`, and Resend credentials. Production (`NODE_ENV === "production"`) **always forces demo mode to false**, regardless of environment variables.
- Missing email credentials in live mode are surfaced as explicit configuration errors; magic-link tokens are never logged or exposed.

### Standard Result Contract (`src/domain/contracts.ts`)
Mutations and domain operations return typed `ActionResult<T>` or `StoreResult<T>` envelopes:
```typescript
export type ActionErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UPSTREAM_UNAVAILABLE";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ActionErrorCode; message: string } };
```

---

## 4. Key Business & Domain Rules

### Inverted Badness Rating Scale
Badreads uses an inverted 1–5 star rating system where **5 stars is the worst**:
- `5`: **Catastrophic** (Worst possible score)
- `4`: **Awful**
- `3`: **Painful**
- `2`: **Disappointing**
- `1`: **Barely Bad** (Mildest disappointment)

### Roast Submission Rules (`src/domain/core.ts`)
- **Hook**: 10 to 140 characters.
- **Body / Receipts**: 80 to 3,000 characters. Must critique the book, not the author or other readers.
- **Rating**: Integer from 1 to 5.
- **Flaw Tags**: Array of 1 to 3 tags from `FLAW_TAGS`:
  `PACING`, `PROSE`, `PLOT`, `CHARACTERS`, `ARGUMENTS`, `WORLD_BUILDING`, `ENDING`, `EDITING`, `OTHER`.
- **Spoiler Flag**: Boolean indicating whether evidence contains spoilers.
- **One Roast Per Book Per User**: A user may only have one active score-bearing roast per book (duplicate submissions return a `CONFLICT` error).

### Moderation & Trust Workflow
- **First-Post Review**: A user's first roast is placed in `PENDING_REVIEW` status and sent to `/moderation`. Once approved, subsequent roasts by that user are immediately `PUBLISHED`.
- **Visibility**: Roasts with `PENDING_REVIEW`, `REJECTED`, or `REMOVED` status are only visible to their author and moderators.
- **Community Flags**: 3 distinct user reports against a roast automatically flip its status to `REMOVED`.
- **Moderator Access**: Governed by `hasModeratorAccess()` (`src/lib/authorization.ts`). Granted to users with `MODERATOR`/`ADMIN` role, or emails listed in `MODERATOR_EMAILS`, or anyone in demo mode.

### Feed Composition Algorithm (`composeFeed`)
The feed blends roasts from followed profiles and general discovery roasts in a deterministic **2:1 ratio** (2 followed posts for every 1 discovery post).

### Reactions & Bookmarks
- Reactions: `FAIR` and `FUNNY` binary toggles.
- Bookmarks: Save roast toggle.
- All reaction actions are idempotent and update counter caches.

### Local-First & Open Library Catalog Ingestion (`src/catalog/`)
- **Local-First Search**: `searchCatalog` in `src/catalog/service.ts` searches the local domain database first via `getDomainStore().searchBooks()`.
- **Starter Catalog & Bulk Importer**: `pnpm db:import` imports 120+ curated titles from `src/data/starter-catalog.json` or custom files (`--file=...`) / Open Library subjects (`--subject=...`).
- **Open Library Integration**: When `OPEN_LIBRARY_LIVE=true`, upstream results are queried and merged with local results; `/catalog/choose` dynamically imports selected upstream works into `book_work`.
- **Fallback Handling**: In demo mode or when offline (`OPEN_LIBRARY_LIVE !== "true"`), search works out of the box using local/demo books without external network calls.
### Dual-Mode Rate Limiting (`src/lib/rate-limit.ts`)
- When Postgres is connected, rate limits are persisted and incremented atomically in `rate_limit_buckets` using `onConflictDoUpdate`.
- In demo mode / fallback, uses an in-memory sliding window bucket map.
- Applied to catalog search (60 req / min), analytics (120 req / hr), and magic-link requests.

### Privacy & Account Controls
- Email addresses are strictly private and never displayed publicly.
- Profiles use a public `@handle` (3–24 alphanumeric characters, underscores, hyphens).
- Users must confirm they are 16+ on onboarding.
- Users can export their full account data as JSON (`/api/account/export`) or permanently delete their account and associated verdicts (`deleteAccountAction`).

---

## 5. Product Boundaries & Non-Goals (MVP Scope)

Do **NOT** add the following out-of-scope features without explicit instruction:
- **No comment sections or discussion threads** on roasts (only Fair/Funny reactions).
- **No direct messaging or private chat**.
- **No custom shelves or complex reading lists** (only 1 roast per book + bookmarks).
- **No reading clubs, forums, or groups**.
- **No user file/image uploads** (covers use Open Library or predetermined tone palettes: `coral`, `acid`, `lavender`, `ink`).
- **No AI-generated reviews or automated summaries**.
- **No recommendation algorithms or ML models**.
- **No native mobile apps or monetization/ads**.
- **Independent Parody Brand**: Do not copy Goodreads code, data, assets, layouts, or wording.

---

## 6. Code & Implementation Conventions

### Next.js 16 & React 19 Patterns
- **Asynchronous Route Props**: In Next.js 16, page and layout props `params` and `searchParams` are Promises. Always `await` them:
  ```typescript
  type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string }> };
  export default async function Page({ params, searchParams }: Props) {
    const { slug } = await params;
    const { q } = await searchParams;
    // ...
  }
  ```
- **Server Actions**: Defined in `app/actions.ts` with `"use server"`. Use Zod validation, authenticate via `getSession()`, check rate limits, and revalidate affected paths using `revalidatePath()`.
- **Form State Handling**: Use React 19's `useActionState` and native `FormData` for form submissions (e.g. `RoastForm.tsx`, `OnboardingForm.tsx`).
- **Client Components**: Keep components as Server Components by default. Add `"use client"` only at the leaf level where client state, transitions (`useTransition`), or event handlers are required.

### Styling & Design Conventions
- All styles reside in `app/globals.css`.
- Use existing semantic classes (`page-width`, `hero`, `form-shell`, `roast-card`, `button button-primary`, `button-coral`, `button-quiet`, `badness-stars`, `mono`, `eyebrow`, `stat-row`, etc.).
- Maintain the editorial, high-contrast, brutalist aesthetic with mono accents and tone palettes (`coral`, `acid`, `lavender`, `ink`).

### Security Standards
- **XSS Prevention**: Never use `dangerouslySetInnerHTML` for user-generated content. All user text must be rendered through standard JSX text nodes (tested in `RoastCard.test.tsx`).
- **Security Headers**: Managed in `next.config.ts` (strict CSP, HSTS, frame-ancestors none, permissions policy).
- **Secrets & Tokens**: Never log or return magic-link tokens or session secrets in API responses.

---

## 7. Testing & Verification Checklist

When making changes, ensure:
1. **Domain Logic**: Covered by unit tests in `src/domain/*.test.ts` (business rules, feed blending, validation, memory store).
2. **Components**: Covered by React Testing Library tests in `components/*.test.tsx`.
3. **Adapters & Utilities**: Covered in `src/lib/*.test.ts` and `src/catalog/*.test.ts`.
4. **End-to-End**: Critical user flows pass Playwright tests in `e2e/*.spec.ts`.
5. **Quality Checks**: Run and pass `pnpm typecheck`, `pnpm lint`, and `pnpm test`.
