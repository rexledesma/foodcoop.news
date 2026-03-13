# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
pnpm dev              # Development server (Vite/SvelteKit)
pnpm build            # Production build
pnpm start            # Preview built app locally
pnpm check            # Run lint, svelte-check, knip, format, and TypeScript checks
pnpm typecheck        # Run tsgo --noEmit (TypeScript Go)
pnpm lint             # Run Oxlint only
pnpm svelte:check     # Run svelte-check only
pnpm knip             # Run knip unused code/deps checks
pnpm format           # Format with Oxfmt
pnpm format:check     # Check formatting with Oxfmt
npx convex dev        # Start Convex development server
```

**Important:** After generating or modifying code, run `pnpm check` to fix any lint/svelte-check/knip/format/TypeScript errors. This command should always succeed with no errors.

## Architecture

This is a SvelteKit application for Park Slope Food Coop members, using Convex as the backend database.

**Stack:** SvelteKit 2, Svelte 5, TypeScript (strict mode), Tailwind CSS 4, Convex, Better Auth, DuckDB WASM, Amazon S3

**Path alias:** `@/*` → `./src/*`

### Project Structure

- `src/routes/` - Pages and API routes
- `src/routes/api/` - Backend endpoints: auth, feed, gazette, foodcoop, foodcoopcooks, events, calendar, wallet, produce, cron
- `src/components/` - Svelte components
- `src/lib/` - Utilities, shared types, auth client, feed/produce helpers, wallet utilities
- `convex/` - Convex schema, functions, and auth configuration

### Data Flow

1. **Authentication**: Better Auth with Convex adapter (`convex/auth.ts`, `src/lib/auth.ts`, `src/routes/api/auth/[...all]/+server.ts`)
2. **Member Profiles**: Stored in Convex (`convex/memberProfiles.ts`) with member ID, name, calendar ID, job filters, and pass serial number
3. **Discover Feed**: Aggregates RSS (foodcoop.com, Gazette, Food Coop Cooks), Bluesky posts, and Eventbrite/GM events with 5-minute caching
4. **Calendar Syncing**: Proxies Google Calendar iCal feed, filters events by member job filters via `src/routes/api/calendar/[calendarId]/+server.ts`
5. **Wallet Passes**: Generates Apple Wallet `.pkpass` and Google Wallet save URLs from member profiles
6. **Produce Pipeline**: Cron scrapes the Coop produce page, stores HTML + monthly Parquet in Amazon S3, client loads via DuckDB WASM for analytics

### Key Technical Details

- **Database**: Convex for member profiles and auth state
- **Authentication**: Better Auth with email/password, integrated via `@convex-dev/better-auth`
- **Feeds**: RSS parsing + Bluesky API, 5-minute in-memory caching for feed/event APIs
- **Events**: Eventbrite organizers for Food Coop Cooks, Wordsprouts, and Concert Series; GM events scraped from foodcoop.com
- **Wallet Passes**: `passkit-generator` for Apple Wallet, Google Wallet JWTs with PDF417 barcodes
- **Produce Analytics**: Scrape + Parquet generation on the server, DuckDB WASM on the client
- **Image Processing**: `sharp` for server-side image manipulation

### Environment Variables

Required environment variables (set in `.env.local` and Convex dashboard):

- `PUBLIC_CONVEX_URL` - Convex deployment URL
- `PUBLIC_CONVEX_SITE_URL` - Convex HTTP actions URL
- `PUBLIC_SITE_URL` - Production site URL for auth callbacks
- `EVENTBRITE_API_KEY` - Eventbrite API token for event feeds
- `CRON_SECRET` - Authorization secret for cron scraping endpoints
- `AWS_ACCESS_KEY_ID` - IAM access key ID for S3 access
- `AWS_SECRET_ACCESS_KEY` - IAM secret access key for S3 access
- `AWS_REGION` - AWS region for the S3 bucket
- `S3_BUCKET_NAME` - S3 bucket name for produce data
- `GOOGLE_WALLET_ISSUER_ID` - Google Wallet issuer ID
- `GOOGLE_APPLICATION_CREDENTIALS` - Base64-encoded Google service account JSON
- `APPLE_WWDR_CERT_BASE64` - Apple WWDR certificate (base64)
- `APPLE_PASS_CERT_BASE64` - Apple pass certificate (base64)
- `APPLE_PASS_KEY_BASE64` - Apple pass private key (base64)
- `APPLE_PASS_KEY_PASSPHRASE` - Apple pass key passphrase
- `APPLE_PASS_TYPE_ID` - Apple pass type identifier
- `APPLE_TEAM_ID` - Apple developer team ID
