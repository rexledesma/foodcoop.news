# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
vp run dev               # Start local dev server
vp run build             # Build production app
vp run preview           # Alias for start
vp run check             # Run vp check + svelte-check + knip
vp run svelte:check      # Run svelte-check --fail-on-warnings
vp run knip              # Run unused code/dependency checks
vp exec convex dev       # Start Convex dev server
vp run backfill          # Trigger /api/cron/backfill-produce with CRON_SECRET
```

**Important:** After generating or modifying code, run `vp run check`. This command should succeed with no errors.

## Architecture

This is a SvelteKit app for Park Slope Food Coop members, with Convex for auth/profile/favorites/subscriptions and S3-backed produce analytics.

**Stack:** SvelteKit 2, Svelte 5, TypeScript strict mode, Tailwind CSS 4, Convex, Better Auth, DuckDB, AWS S3, Vercel Cron, Web Push, Apple/Google Wallet.

**Path alias:** `@/*` -> `./src/*`

## Project Structure

- `src/routes/` - Pages and route handlers
- `src/routes/api/` - API routes:
  - `auth`, `calendar`, `feed`, `foodcoop`, `foodcoopcooks`, `gazette`
  - `concert-series/events`, `wordsprouts/events`, `notifications/test`
  - `me/profile`, `me/produce-favorites`, `me/push-subscriptions`
  - `produce/current|data|metadata|updates|favorite-counts|link-preview`
  - `wallet/pass`, `wallet/google`
  - `cron/scrape-produce*`, `cron/backfill-produce`
- `src/components/` - UI components for auth, navigation, discover, produce, about, integrations
- `src/lib/` - Shared logic: auth helpers, feed parsing, Eventbrite scraping, produce parsing/caching/parquet utils, S3 storage, wallet generation, push helpers
- `convex/` - Schema and backend functions for auth, member profiles, produce favorites, and push subscriptions
- `static/sw.js` - Service worker for push notifications

## Core Data Flows

1. **Auth**: Better Auth + Convex adapter (`convex/auth.ts`, `src/routes/api/auth/[...all]/+server.ts`, `src/lib/auth.ts`).
2. **Member profiles**: Auto-created on signup via Convex auth hook; include member name/id, `calendarId`, `passSerialNumber`, and `jobFilters`.
3. **Discover feed**: `/api/feed` aggregates multiple sources (RSS, Bluesky, Eventbrite, GM events, produce updates), dedupes, and returns merged items.
4. **Calendar integration**: `/api/calendar/[calendarId]` proxies and filters the public coop ICS feed by saved `jobFilters`.
5. **Wallet passes**: `/api/wallet/pass` (Apple `.pkpass`) and `/api/wallet/google` (Google save URL) generated from member profile data.
6. **Produce pipeline**:
   - Cron fetches `foodcoop.com/produce` HTML snapshots into S3 (`produce/YYYY-MM-DD.html`).
   - Server upserts yearly parquet files (`produce-data-yearly/`).
   - Derived parquet datasets are generated (`produce-data-derived/ytd-*`, `long-range-downsampled-*`).
   - `/api/produce/data` queries parquet data with DuckDB.
7. **Push notifications**: Browser subscribes via service worker and VAPID keys; subscriptions stored in Convex; `/api/notifications/test` sends test notifications.

## Caching and Runtime Notes

- Most feed/event endpoints use 5-minute in-memory caches.
- `api/feed` applies source timeouts and partial-success responses.
- Produce metadata has its own cache layer (`src/lib/produce-metadata-cache.ts`) and is invalidated after cron/backfill writes.
- `src/lib/s3-storage.ts` supports S3-compatible endpoints and signed/public URL modes.

## Convex Data Model

Tables in `convex/schema.ts`:

- `memberProfiles` (`by_userId`, `by_memberId`, `by_calendarId`)
- `produceFavorites` (`by_userId`, `by_itemName`, `by_userId_itemName`)
- `pushSubscriptions` (`by_userId`, `by_endpoint`)

## Environment Variables

Set local values in `.env.local`. Deploy equivalents in Vercel/Convex as appropriate.

### Required for baseline app/auth

- `PUBLIC_SITE_URL`
- `PUBLIC_CONVEX_URL`
- `PUBLIC_CONVEX_SITE_URL`

### Required for produce pipeline and cron

- `CRON_SECRET`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `S3_BUCKET_NAME`

### Optional integrations/features

- `EVENTBRITE_API_KEY` - Eventbrite-backed event endpoints
- `GOOGLE_WALLET_ISSUER_ID` - Google Wallet pass generation
- `GOOGLE_APPLICATION_CREDENTIALS` - Base64 service account JSON for Google Wallet signing
- `APPLE_WWDR_CERT_BASE64`
- `APPLE_PASS_CERT_BASE64`
- `APPLE_PASS_KEY_BASE64`
- `APPLE_PASS_KEY_PASSPHRASE`
- `APPLE_PASS_TYPE_ID`
- `APPLE_TEAM_ID`
- `PUBLIC_VAPID_PUBLIC_KEY` - Browser push subscription
- `VAPID_PRIVATE_KEY` - Server push sending
- `VAPID_SUBJECT` - Web push subject (mailto or URL)
- `PUBLIC_NOTIFICATIONS_ALLOWED_EMAILS` - Comma-separated allowlist for notifications UI
- `TRUSTED_ORIGINS` - Comma-separated extra Better Auth trusted origins

### Optional S3 compatibility/runtime tuning

- `S3_ENDPOINT`
- `S3_PUBLIC_BASE_URL`
- `AWS_S3_FORCE_PATH_STYLE` (`true`/`false`)
- `AWS_SESSION_TOKEN`
- `S3_SIGNED_URL_TTL_SECONDS`

## Deployment and Cron

`vercel.json` schedules these cron routes:

- `/api/cron/scrape-produce` at `0 12 * * *`
- `/api/cron/scrape-produce-10am` at `0 15 * * *`
- `/api/cron/scrape-produce-12pm` at `0 17 * * *`
- `/api/cron/scrape-produce-5pm` at `0 22 * * *`
- `/api/cron/scrape-produce-10pm` at `0 3 * * *`

All cron endpoints require `Authorization: Bearer $CRON_SECRET`.

## Working Conventions

- Keep TypeScript strict and lint-clean.
- Prefer existing helpers in `src/lib/` before adding new utilities.
- Preserve current route/API naming patterns and cache behavior when extending endpoints.
- Avoid editing `convex/_generated/*` files directly.
