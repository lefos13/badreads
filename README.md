# Badreads

Badreads is an English-first, public roast network for readers who want to explain why a book failed them. A five-star rating is the worst verdict, and every roast asks for a hook, evidence, flaw tags, and an optional spoiler marker.

The repository is a Next.js App Router modular monolith written in strict TypeScript. Domain modules are kept separate so catalog, identity, roasts, social, moderation, and analytics can move behind an API boundary later without changing their contracts.

## Local development

```text
pnpm install
cp .env.example .env.local
pnpm dev
```

The local demo runs without external credentials. It uses seeded in-memory records, a demo session, and the four curated books. `DEMO_MODE=true` remains the safe no-domain path even when `DATABASE_URL` is present, so the sign-in page offers demo access instead of pretending that an email was sent. Set `DEMO_MODE=false` only with a configured database, Better Auth secret, and Resend delivery environment. In production, demo mode is ignored and missing email delivery is surfaced as a configuration error; the app never logs or exposes magic-link tokens.

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
pnpm db:import
pnpm db:seed:bottom100
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

### Vercel environment setup

Add the following variables in the Vercel project settings for the environments you intend to deploy:

- `DATABASE_URL`: the Neon pooled connection string.
- `BETTER_AUTH_SECRET`: a long random secret, different from local development.
- `BETTER_AUTH_URL` and `NEXT_PUBLIC_BETTER_AUTH_URL`: the same canonical HTTPS deployment URL.
- `NEXT_PUBLIC_SITE_URL`: the canonical public HTTPS URL used for metadata and sitemap links.
- `DEMO_MODE=false`, `REGISTRATION_ENABLED=true`, and `POSTING_ENABLED=true` for a real beta.
- `RESEND_API_KEY` and `RESEND_FROM_EMAIL`: add only after the sender domain is verified in Resend.
- `MODERATOR_EMAILS`: a comma-separated list of founder/moderator email addresses.

Preview deployments should use a separate Better Auth URL/secret or remain in read-only/demo mode. After saving variables, redeploy because environment changes do not retroactively update an existing deployment.

Resend's `resend.dev` sender is suitable for testing only and is limited to the Resend account email or documented test recipients; it is not production delivery for arbitrary users. See [Resend's testing guidance](https://resend.com/docs/dashboard/emails/send-test-emails), [the `resend.dev` restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain), and [domain setup](https://resend.com/docs/dashboard/domains/introduction).

The in-memory store is intentionally a development fallback. With `DEMO_MODE=false`, the async domain repository reads and writes through Neon/Drizzle so process restarts and multiple Vercel instances do not lose books, roasts, reactions, follows, reports, or profiles. Keep demo mode enabled until email delivery is configured.
