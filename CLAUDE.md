# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
pnpm dev              # Development server
pnpm build            # Production build (Webpack)
pnpm start            # Start production server
pnpm check            # Run lint, format, and TypeScript checks
pnpm lint             # Run ESLint
pnpm format           # Format with Prettier
pnpm format:check     # Check formatting
npx convex dev        # Start Convex development server
```

**Important:** After generating or modifying code, run `pnpm check` to fix any lint/format/TypeScript errors. This command should always succeed with no errors.

## Architecture

This is a Next.js 16 App Router application for Park Slope Food Coop members, using Convex as the backend database.

**Stack:** Next.js 16.1.1, React 19.2.3, TypeScript (strict mode), Tailwind CSS 4, Convex, Better Auth, DuckDB WASM, Vercel Blob

**Path alias:** `@/*` → `./src/*`

### Project Structure

- `src/app/` - Pages and API routes (App Router)
- `src/app/api/` - Backend endpoints: auth, feed, gazette, foodcoop, foodcoopcooks, events, calendar, wallet, produce, cron
- `src/components/` - Client-side React components
- `src/lib/` - Utilities, types, auth client, feed/produce helpers, wallet utilities
- `convex/` - Convex schema, functions, and auth configuration

### Data Flow

1. **Authentication**: Better Auth with Convex adapter (`convex/auth.ts`, `src/lib/auth.ts`, `src/app/api/auth/[...all]/route.ts`)
2. **Member Profiles**: Stored in Convex (`convex/memberProfiles.ts`) with member ID, name, calendar ID, job filters, and pass serial number
3. **Discover Feed**: Aggregates RSS (foodcoop.com, Gazette, Food Coop Cooks), Bluesky posts, and Eventbrite/GM events with 5-minute caching
4. **Calendar Syncing**: Proxies Google Calendar iCal feed, filters events by member job filters via `src/app/api/calendar/[calendarId]/route.ts`
5. **Wallet Passes**: Generates Apple Wallet `.pkpass` and Google Wallet save URLs from member profiles
6. **Produce Pipeline**: Cron scrapes the Coop produce page, stores HTML + monthly Parquet in Vercel Blob, client loads via DuckDB WASM for analytics

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

- `NEXT_PUBLIC_CONVEX_URL` - Convex deployment URL
- `NEXT_PUBLIC_CONVEX_SITE_URL` - Convex HTTP actions URL
- `SITE_URL` - Production site URL for auth callbacks
- `EVENTBRITE_API_KEY` - Eventbrite API token for event feeds
- `CRON_SECRET` - Authorization secret for cron scraping endpoints
- `VERCEL_BLOB_READ_WRITE_TOKEN` - Vercel Blob access token for produce data
- `GOOGLE_WALLET_ISSUER_ID` - Google Wallet issuer ID
- `GOOGLE_APPLICATION_CREDENTIALS` - Base64-encoded Google service account JSON
- `APPLE_WWDR_CERT_BASE64` - Apple WWDR certificate (base64)
- `APPLE_PASS_CERT_BASE64` - Apple pass certificate (base64)
- `APPLE_PASS_KEY_BASE64` - Apple pass private key (base64)
- `APPLE_PASS_KEY_PASSPHRASE` - Apple pass key passphrase
- `APPLE_PASS_TYPE_ID` - Apple pass type identifier
- `APPLE_TEAM_ID` - Apple developer team ID
