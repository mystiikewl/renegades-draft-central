# HANDOFF — Phase 4d: Tests (new session prompt)

Copy everything below the line into a fresh session on branch
`feature/draft-central-work` of Renegades Draft Central
(`C:\Users\ataha\Documents\Projects\renegades-draft-central`).

---

You are continuing an in-progress complete rebuild of Renegades Draft Central
(web app for a private NBA ESPN dynasty draft league, ESPN league ID **201**).
Work happens on branch `feature/draft-central-work`. Before starting, read in
full: `CLAUDE.md`, `docs/HANDOFF-phase-4b.md`, and
`docs/HANDOFF-phase-4d.md` (this file). Also skim
`docs/AUDIT-2026-rebuild-baseline.md` for background.

## Current state (all committed, build passing)

**Backend: 100% done and live** on Supabase project `xruqdjonzxkzwsslzpdl`
(https://xruqdjonzxkzwsslzpdl.supabase.co):

- Fresh season-aware schema (`supabase/migrations/20260825*`): `seasons`,
  `teams`, `profiles` (id = auth.uid()), `players` (espn_id keyed),
  `player_seasons` (stats JSONB), `rosters` (season+team+player, acquisition
  draft/keeper/trade), `draft_picks` (board slots; **pick_number is OVERALL
  1..N, not per-round**), `draft_settings` (per season), `user_favourites`.
- ALL draft logic lives in SECURITY DEFINER RPCs
  (`supabase/migrations/20260825000003_functions.sql`): `make_pick`,
  `undo_last_pick`, `set_draft_order`, `set_draft_status`, `trade_pick`,
  `assign_keeper`/`remove_keeper`, `reset_draft`, `claim_team`,
  `create_season`, helper `is_admin()`. The client NEVER writes
  draft_picks/rosters directly.
- Data live: `2025-26` ARCHIVED (10 teams, 12 profiles with real auth users,
  80 picks, 170 roster spots); `2026-27` ACTIVE pre_draft with 547 players +
  472 stat rows (ESPN import; scripts/import-nba.mjs is idempotent).
- `supabase db push` does NOT work on this org — use `scripts/db-query.mjs`
  (reads SUPABASE_ACCESS_TOKEN from .env, runs SQL files against the project).
  Tests must NOT touch this live DB — mock supabase in unit tests.

**Frontend: Phases 4a + 4b + 4c done.** New app in `src/`, old app parked in
`legacy/` (excluded from build/tests):

- Vite + React 18 + TS, TanStack Router (typed code-based routes in
  `src/App.tsx`) + TanStack Query v5, Tailwind 3 + shadcn set in
  `src/components/ui/`, sonner toasts, dnd-kit (Admin), zustand (offline
  queue). Vitest configured: `src/test/setup.ts`, include `src` only.
- `src/api/` is the ONLY data layer: `types.ts`, `queries.ts` (all reads, `qk`
  key factory), `mutations.ts` (all writes via RPCs; `useMakePick` takes
  `{playerId, playerName}`), `realtime.ts` (ONE postgres channel per season →
  cache invalidation), `offlineQueue.ts` (zustand store + replay loop;
  `isNetworkError` distinguishes network vs RPC rejection; queuePick enqueues
  and starts retry).
- `src/auth/AuthContext.tsx` (session + profile); guards in `src/App.tsx`:
  `RequireAuth` → `RequireTeam` (onboarding via `claim_team`) → `RequireAdmin`.
  The draft route is wrapped in `src/components/ErrorBoundary.tsx`.
- Pages: `DraftPage.tsx` (status header, on-clock banner with `usePickClock`
  from `src/components/draft/PickClock.tsx` — display-only countdown anchored
  to last pick's `picked_at`, freezes on pause; round-grid board; mobile =
  Board/Player pool Tabs below `lg`, side-by-side grid on desktop; searchable
  player pool with Pick → confirm Dialog → make_pick; queued offline picks
  show badges + banner), `AdminPage.tsx`, `RostersPage.tsx`, `LoginPage.tsx`,
  `OnboardingPage.tsx`. Header nav: Draft/Rosters/Admin.
- A separate agent worked on DESIGN/visual polish in parallel — some of its
  edits (`src/index.css`, `src/main.tsx`, `tailwind.config.ts`,
  `docs/THEME-2026.md`) may still be UNCOMMITTED in the working tree. DO NOT
  revert or commit unrelated dirty files; commit only files you touch. (Known
  wrinkle: commit `4e57dd0` accidentally includes an early slice of the design
  agent's css changes — leave history alone.)
- Env: `.env` (gitignored) has VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
  SUPABASE_ACCESS_TOKEN. NEVER commit `.env`.

## Your task: Phase 4d — test suite

Write Vitest tests (colocated `*.test.ts(x)` in `src/`, following existing
setup) covering the draft flow. Mock `@/lib/supabase` (vi.mock) — never hit
the live DB. Priorities, in order:

1. **Pick flow (`src/api/mutations.ts` + queue integration):**
   - happy path: make_pick resolves → season queries invalidated (assert via
     QueryClient / queryKey), no toast error;
   - RPC rejection (supabase.rpc returns `{ error: { message } }`) →
     toast.error with message, NOT queued;
   - network failure (rpc throws TypeError / navigator.onLine false) →
     `queuePick` called / queue populated, info toast, no error toast;
   - offline replay (`src/api/offlineQueue.ts`): flush succeeds → queue
     drained + success toast; replay RPC rejection → pick dropped + error
     toast; still offline → queue retained.
2. **`isNetworkError`** unit cases (TypeError, fetch-failed message, offline
   navigator, RPC-shaped Error → false).
3. **`usePickClock`** (`src/components/draft/PickClock.tsx`): countdown ticks
   down from limit; freezes on pause; resume continues from frozen remainder;
   resets to full limit on new pick. Use fake timers + renderHook.
4. **Undo:** success toasts + invalidates; RPC rejection toasts.
5. **ErrorBoundary:** renders children normally; a thrown render error shows
   recovery UI with Try again that resets (rerender child succeeds).
6. **Admin ops** (`useSetDraftOrder`, `useSetDraftStatus`, `useResetDraft`):
   params passed to RPC correctly (`p_`-prefixed), success invalidation +
   toasts, error toasts.
7. Light **DraftPage/DraftBoard** render tests (board rounds/slots from mock
  picks, confirm dialog opens on Pick click) if time permits — keep shallow,
  mock all `src/api` hooks.

Match existing test style if any exists (`rg "\.test\." src`). Keep tests
deterministic (fake timers for clock/toasts as needed).

## Conventions / rules

- ALL reads/writes go through `src/api/` — tests mock the supabase client at
  `src/lib/supabase`, or mock `src/api` hooks when testing components.
- RPC params are `p_`-prefixed. DraftPick.pick_number is OVERALL (1..N).
- Build must pass: `npm run build`. `src/` must lint clean (`npx eslint src`).
  Tests: `npm run test:run` must be green.
- Never run draft-mutation RPCs against the live project from tests.
- Commit per slice (mutation/queue tests, clock tests, boundary, admin ops).
- ESPN league ID for import scripts is **201**.

## Remaining after 4d (for planning)

- **Phase 5:** end-to-end draft simulation (set order → run → make picks
  incl. wrong-turn rejection → undo → pause → trade), delete `legacy/`,
  Netlify deploy (`netlify.toml` exists; siteId in `.netlify/state.json`).
- Still pending from user: rotate old service_role key in Supabase dashboard.
