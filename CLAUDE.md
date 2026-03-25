@AGENTS.md

# Santiago's World — Project Context

## What is this?
A PWA travel map app where Santiago checks in at locations worldwide, builds a visual life map, and chats with an AI agent (Claude) that knows his travel history and gives location-aware recommendations.

## Tech Stack
- **Frontend**: Next.js 16 + TypeScript + Tailwind CSS
- **Database**: IndexedDB via `idb` library (local browser storage)
- **Map**: Google Maps JavaScript API (manual script loading, dark theme via styles array)
- **Geocoding**: Google Geocoding API (proxied through `/api/geocode` route)
- **AI Agent**: Anthropic Claude API (`@anthropic-ai/sdk`) — claude-sonnet-4-20250514
- **Deployment**: Vercel (auto-deploys on push to main)
- **PWA**: Custom service worker + manifest.json

## Project Structure
```
src/
├── app/
│   ├── layout.tsx          # Root layout with fonts (Plus Jakarta Sans, DM Sans, JetBrains Mono)
│   ├── page.tsx            # Map page (home)
│   ├── globals.css         # Theme: dark luxury with glassmorphism, CSS variables
│   ├── checkin/page.tsx    # Check-in page
│   ├── chat/page.tsx       # Chat page (placeholder UI — Phase 3 pending)
│   ├── history/page.tsx    # History/timeline page
│   └── api/
│       ├── geocode/route.ts      # Reverse geocoding proxy (validates lat/lng)
│       └── test-claude/route.ts  # Test route for Claude API (DELETE after Phase 3)
├── components/
│   ├── BottomNav.tsx       # Fixed bottom nav with glassmorphism, SVG icons
│   ├── MapView.tsx         # Full-screen Google Map with colored pins
│   ├── CheckInFlow.tsx     # Check-in button + location detection + save flow
│   ├── CheckInDetail.tsx   # Pin detail popup when tapping a marker
│   └── ServiceWorkerRegister.tsx
├── lib/
│   ├── db.ts               # IndexedDB setup with version migration scaffolding
│   ├── geo.ts              # GPS + reverse geocoding + country-to-continent (195+ countries)
│   ├── constants.ts        # Centralized theme colors, continent colors, pin config
│   └── events.ts           # Typed pub/sub system for cross-component communication
```

## Design System
- **Theme**: Dark luxury ("Uber dark mode meets Apple Maps meets travel journal")
- **Colors**: --bg-primary: #0a0a0f, --accent: #06d6a0 (minty teal), --accent-secondary: #118ab2
- **Fonts**: Plus Jakarta Sans (headings), DM Sans (body), JetBrains Mono (stats)
- **Style**: Glassmorphism cards (backdrop-blur, semi-transparent, subtle borders)
- **Continent pin colors**: Europe=#118ab2, Africa=#06d6a0, LATAM=#ffd166, Asia=#ef476f

## Environment Variables
```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=  # Client-side map rendering
GOOGLE_MAPS_API_KEY=              # Server-side geocoding
ANTHROPIC_API_KEY=                # Claude API (server-side only)
```

## Build Status
- ✅ Phase 1: Foundation (Next.js, PWA, IndexedDB, bottom nav)
- ✅ Phase 2: Map + Check-in (Google Maps, GPS, reverse geocode, colored pins)
- ⬜ Phase 3: AI Agent (chat UI, Claude API route, Places API, streaming)
- ⬜ Phase 4: History polish, stats, dark mode refinements, deploy final

## Phase 3 Plan (next session)
Build the AI chat agent:
1. Chat UI component (replace placeholder) — real messaging interface
2. Next.js API route `/api/chat` — calls Claude with streaming
3. Next.js API route `/api/places` — proxies Google Places API (New)
4. System prompt with check-in history injection
5. Tool: `search_nearby_places` — agent calls Google Places via API route
6. Tool: `query_checkin_history` — searches IndexedDB and passes results
7. Streaming responses for real-time feel
8. Delete `/api/test-claude` route after chat works

## Key Architecture Decisions
- Google Maps loaded via promise-based singleton (no duplicate script loads)
- IndexedDB has version migration scaffolding (bump DB_VERSION + add `if (oldVersion < N)` blocks)
- Cross-component communication uses typed pub/sub (`events.ts`), not window events
- All theme colors centralized in `constants.ts` — components import from there
- API routes validate inputs and keep API keys server-side
- Service worker skips /api/ routes, caches static assets only, max 100 entries

## Commands
- `npm run dev` — local dev server
- `npm run build` — production build (must pass before push)
- Push to `main` → auto-deploys to Vercel
