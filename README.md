# Badreads

Badreads is an English-first, public roast network for readers who want to explain why a book failed them. A five-star rating is the worst verdict, and every roast asks for a hook, evidence, flaw tags, and an optional spoiler marker.

The repository is a Next.js App Router modular monolith written in strict TypeScript. Domain modules are kept separate so catalog, identity, roasts, social, moderation, and analytics can move behind an API boundary later without changing their contracts.

## Local development

```text
pnpm install
cp .env.example .env.local
pnpm dev
```

The local demo runs without external credentials. It uses seeded in-memory records, a demo session, and the four curated books. Set `DEMO_MODE=false` with a configured database and Better Auth/Resend environment before enabling a real beta. The Drizzle schema and versioned migrations live in `src/db` and `drizzle/`.

Useful commands:

```text
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm audit --prod
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

## Product boundaries

- Public reading and indexable book, roast, and profile pages.
- Private email magic links, public handles, and a 16+ onboarding gate.
- Canonical work-level catalog records through an Open Library provider adapter with validation, timeout, caching, and a local demo fallback.
- One editable score-bearing roast per user/work; first-post moderation; Fair/Funny reactions; bookmarks; follows; reporting; feed blending; account export/deletion.
- No comments, direct messages, custom shelves, clubs, imports, user uploads, generated reviews, recommendations, native apps, or monetization in the MVP.

The public parody brand is original and independent. Do not copy Goodreads code, data, assets, layouts, or wording. Complete trademark and copyright review before launch.

## Environment

See `.env.example` for the complete list. Production requires `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_SITE_URL`, and Resend delivery credentials. `OPEN_LIBRARY_LIVE=true` enables low-volume upstream catalog lookup; growth should move to a licensed dump or another provider.

The in-memory store is intentionally a development fallback. Before a public beta, wire the same domain operations to Neon through the Drizzle schema so process restarts and multiple Vercel instances do not lose writes.
