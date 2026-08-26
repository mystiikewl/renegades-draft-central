# Renegades Draft Central

Web app for a private group of friends to run an **offline NBA ESPN Dynasty Draft** (snake draft, keepers, live draft board). Built for the 2025 season; this branch (`feature/draft-central-work`) is a **complete rebuild targeting the 2026 season**. The 2025 code is the reference for domain logic — expect significant rework of UX and architecture.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` / `npm run build:dev` — production / development build
- `npm run lint` — ESLint
- `npm run test` — Vitest (watch); `npm run test:run` for CI; `test:coverage` for coverage
- `npm run import-players` — run `scripts/import-players.js` to seed player data into Supabase

## Stack

- **Vite + React 18 + TypeScript** (SWC), originally generated via Lovable
- **Tailwind CSS 3** + **shadcn/ui** (Radix primitives) + lucide/react-icons
- **React Router v6** (`src/App.tsx` holds routes), **TanStack Query v5**, react-hook-form + zod
- **Supabase** — Postgres, Auth, Realtime, Edge Functions
  - Client: `src/integrations/supabase/client.ts`
  - Migrations: `supabase/migrations/` (~36 files — RLS-heavy; players/keepers/draft_picks/draft_settings/teams/profiles)
  - Edge functions: `supabase/functions/` (`invite-user`, `admin-actions`, `_shared`)
- **Netlify** deployment (`netlify.toml`)

## Structure

```
src/
  components/       # Feature-grouped: admin/, draft/, player-pool/, league-analysis/, etc.
  pages/            # Route targets: Draft, Admin, Team, Onboarding, LeagueAnalysis, admin/*
  hooks/            # Data hooks incl. realtime (useRealTimeDraftPicks, useTeamPresence, etc.)
  integrations/supabase/  # client, schema, services, types (modular per-table types)
  contexts/         # AuthContext, OnboardingContext
  services/         # draftTabService
  lib/, types/, config/, data/
```

## Domain model (key tables)

- `profiles` — users, with `is_admin` flag and onboarding state
- `teams` — league teams (claimable by users via `claim_team` function)
- `players` / `player_seasons` — NBA player pool with per-season stats
- `draft_picks` — the draft board; deletable per RLS policy
- `draft_settings` — draft config (order, timing, status)
- `keepers` — keeper assignments per team/season, RLS-restricted

## Conventions

- Components use shadcn/ui primitives; Tailwind for styling
- Data fetching via Supabase client + TanStack Query; realtime via Supabase subscriptions in `useRealTime*` hooks
- Tests colocated as `*.test.tsx` next to components/hooks (Vitest + React Testing Library, jsdom)
- Feature folders include a `shared/` subfolder for cross-cutting UI (ErrorBoundary, LoadingSkeleton, MobileTable)
- Known tech debt: `DraftTabs.tsx` vs `DraftTabs-refactored.tsx` (see `DraftTabs-Refactoring-Plan.md`), ESLint warnings outstanding, mock data in `src/data/mockData.ts`

## Rebuild context (2026)

**Read [`docs/AUDIT-2026-rebuild-baseline.md`](docs/AUDIT-2026-rebuild-baseline.md) first** — full audit of the 2025 codebase: critical security findings (leaked service-role key, unauthenticated edge functions, permissive RLS), missing season modeling, dead code, and the rebuild pillars.

- Prior season's data lives in Supabase; the rebuild must handle a new season reset (fresh player import, keeper carry-over, new draft settings) without destroying 2025 history
- Player import pipeline: `scripts/import-players.js` + `AutoPlayerImport` component
- Admin surfaces: draft order, pick trading, rollback, keepers, team/user management (`src/components/admin/`, `src/pages/admin/`)
