# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
pnpm dev              # Development server with Turbopack
pnpm build            # Production build
pnpm lint             # Run ESLint
npx convex dev        # Start Convex development server
```

## Architecture

This is a Next.js 16 App Router application for Park Slope Food Coop members, using Convex as the backend database.

**Stack:** Next.js 16.1.1, React 19, TypeScript (strict mode), Tailwind CSS 4, Convex, Better Auth

**Path alias:** `@/*` → `./src/*`

### Project Structure

- `src/app/` - Pages and API routes (App Router)
- `src/app/api/` - Backend endpoints: auth, feed, gazette, foodcoop, foodcoopcooks, calendar, wallet
- `src/components/` - Client-side React components
- `src/lib/` - Utilities, types, auth client
- `convex/` - Convex schema, functions, and auth configuration

### Data Flow

1. **Authentication**: Better Auth with Convex adapter (`convex/auth.ts`, `src/lib/auth.ts`)
2. **Member Profiles**: Stored in Convex (`convex/memberProfiles.ts`) with member ID, name, calendar ID, and shift filters
3. **API Routes**: Aggregate RSS feeds (foodcoop.com, gazette, foodcoopcooks) and Bluesky social posts with 5-minute caching
4. **Calendar Syncing**: Proxies Google Calendar iCal feed, filters events based on user's job preferences

### Key Technical Details

- **Database**: Convex for member profiles and auth state
- **Authentication**: Better Auth with email/password, integrated via `@convex-dev/better-auth`
- **RSS Parsing**: `cheerio` for HTML parsing, custom XML extraction for RSS feeds
- **Wallet Passes**: `passkit-generator` for Apple Wallet, `pdf417-generator` for barcodes
- **Image Processing**: `sharp` for server-side image manipulation
- **Caching**: 5-minute server-side cache for feed APIs

### Environment Variables

Required environment variables (set in `.env.local` and Convex dashboard):

- `NEXT_PUBLIC_CONVEX_URL` - Convex deployment URL
- `NEXT_PUBLIC_CONVEX_SITE_URL` - Convex HTTP actions URL
- `SITE_URL` - Production site URL for auth callbacks
