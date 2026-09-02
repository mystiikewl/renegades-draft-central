# Renegades Draft Central

Web app for a private NBA ESPN dynasty league (ESPN league ID **201**):
offline snake draft with keepers, run from laptops/phones in one room.
The 2026 rebuild is complete and lives on `main` — server-authoritative draft
logic, season-aware schema, practice simulator, analytics. The 2025 app was
deleted (`docs/history/` keeps its handoff docs; season data lives archived in
Supabase as `2025-26` — never mutate it).

## Commands

- `npm run dev` — Vite dev server (port 8080)
- `npm run build` / `npm run build:dev` — production / development build
- `npm run lint` — ESLint (`npx eslint src` is the app-only view)
- `npm run test` — Vitest watch; `npm run test:run` for CI; `test:coverage`
- `npm run import-players` / `npm run sync-keepers` — Supabase data scripts
- `npm run test:e2e:trade` — end-to-end trade/draft integrity against the DB

## Stack

- **Vite + React 18 + TypeScript** (SWC), originally scaffolded via Lovable
- **Tailwind CSS 3** + **shadcn/ui** (Radix) + lucide icons
- **TanStack Router** (`src/app/router.tsx`) + **TanStack Query v5**
- **Supabase** — Postgres, Auth, Realtime (`src/api/realtime.ts`), Edge
  Functions (`supabase/functions/`)
- **zustand** — offline pick queue (`src/api/offlineQueue.ts`), practice
  draft session (`src/stores/practiceDraftSession.ts`)
- **Netlify** deployment (`netlify.toml`)

## Structure

```
src/
  api/         # ALL data access: queries.ts, mutations.ts, realtime.ts,
               # offlineQueue.ts, trades/draft helpers, hand view types
  app/         # router.tsx, AppShell, route guards (league/admin)
  auth/        # AuthContext
  components/  # feature-grouped: draft/, admin/, analysis/, keepers/,
               # player/, team-builder/, trades/, layout/, ui/ (shadcn)
  pages/       # route targets (Draft, PlayerPool, PracticeDraft, Admin, …)
  hooks/       # shared hooks (incl. use-mobile)
  lib/         # domain logic: draftIntelligence, projections, stats,
               # practiceDraft engine, teamColours
  stores/      # zustand stores
  test/        # vitest setup
supabase/
  migrations/  # season-aware schema; RLS: reads allowed, writes via RPC only
  functions/   # sync-keepers etc.
scripts/       # import/SQL/sim tooling (reads .env; db-query.mjs runs SQL —
               # `supabase db push` does NOT work on this org)
```

## Architecture rules

- Draft state changes go through `SECURITY DEFINER` RPCs only: `make_pick`,
  `undo_last_pick`, `set_draft_order`, `set_draft_status`, `trade_pick`,
  `swap_picks`, `assign_keeper`/`remove_keeper`, `reset_draft`,
  `finalize_keepers`, `claim_team`, `create_season`. RPC params are
  `p_`-prefixed. Never write draft tables from the client or scripts.
- Reads flow through `src/api/queries.ts` (TanStack Query); realtime
  subscriptions invalidate query keys — don't patch caches by hand.
- Practice drafts are client-side only (`src/lib/practiceDraft.ts` +
  `practiceDraftSession` store) and never touch draft RPCs.
- Tests are colocated `*.test.tsx` (Vitest + RTL, jsdom); Supabase is always
  vi.mocked — unit tests never hit the DB. E2E scripts (scripts/e2e-*) do,
  against throwaway seasons only.
- 2025-26 season is ARCHIVED with real history: no resets, no mutations.

## Env

`.env` (gitignored; see `.env.example`): `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY` for the app; `SUPABASE_ACCESS_TOKEN` (Management
API) and ESPN cookies (`ESPN_S2`, `ESPN_SWID` — rotate periodically) for
scripts. Never commit `.env`; never expose service-role keys to Vite.

## Current docs

- `docs/BACKLOG.md` — prioritized remaining work (start here)
- `docs/SPEC-draft-intelligence.md`, `docs/SPEC-analysis-suite.md` — specs
- `docs/AUDIT-2026-rebuild-baseline.md` — the 2025 audit behind the rebuild
- `docs/history/` — phase handoffs from the rebuild (historical)
- `docs/THEME-2026.md` — design tokens/theme
