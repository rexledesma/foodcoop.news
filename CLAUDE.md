# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
pnpm dev              # Development server with Turbopack
pnpm build            # Production build
pnpm lint             # Run ESLint
pnpm build:worker     # Build for Cloudflare Workers (OpenNext adapter)
pnpm dev:worker       # Local Cloudflare dev server (port 8771)
pnpm deploy           # Deploy to Cloudflare Workers
```

## Architecture

This is a Next.js 16 App Router application for Park Slope Food Coop members, deployed to Cloudflare Workers.

**Stack:** Next.js 16.1.1, React 19, TypeScript (strict mode), Tailwind CSS 4

**Path alias:** `@/*` → `./src/*`

### Project Structure

- `src/app/` - Pages and API routes (App Router)
- `src/app/api/` - Backend endpoints: auth, shifts, produce, feed
- `src/components/` - Client-side React components
- `src/lib/` - Utilities, types, and food coop client

### Data Flow

The app scrapes data from the Park Slope Food Coop Member Services portal:

1. **Authentication** (`lib/foodcoop-client.ts`): Extracts CSRF token, submits login, parses member info, decodes PDF417 barcode
2. **API Routes** act as BFF layer to hide credentials and cache responses
3. **Session**: HTTP-only cookies with 24-hour expiry; client-side localStorage fallback for shifts

### Key Technical Details

- **Web scraping**: `cheerio` for HTML parsing of members.foodcoop.com
- **Barcode**: `@zxing/library` + `sharp` for PDF417 decoding server-side
- **Caching**: 5-minute server-side cache for produce and feed APIs
- **Deployment**: Standalone output mode required for OpenNext Cloudflare adapter
