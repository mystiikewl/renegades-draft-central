# HANDOFF — Phase 5: E2E simulation, cleanup, deploy (new session prompt)

Copy everything below the line into a fresh session on branch
`feature/draft-central-work` of Renegades Draft Central
(`C:\Users\ataha\Documents\Projects\renegades-draft-central`).

---

You are continuing an in-progress complete rebuild of Renegades Draft Central
(web app for a private NBA ESPN dynasty draft league, ESPN league ID **201**).
Work happens on branch `feature/draft-central-work`. Before starting, read in
full: `CLAUDE.md`, `docs/HANDOFF-phase-4d.md` (state at last phase), and this
file. Skim `docs/AUDIT-2026-rebuild-baseline.md` for background.

## Current state (all committed, build + tests green)

- **Backend live** on Supabase project `xruqdjonzxkzwsslzpdl`. Season-aware
  schema; ALL draft logic in SECURITY DEFINER RPCs (`make_pick`,
  `undo_last_pick`, `set_draft_order`, `set_draft_status`, `trade_pick`,
  `assign_keeper`/`remove_keeper`, `reset_draft`, `claim_team`,
  `create_season`, `is_admin()`). `draft_picks.pick_number` is OVERALL 1..N.
- **Frontend: Phases 4a–4d done** in `src/` (Vite + React 18 + TS, TanStack
  Router/Query, Tailwind + shadcn, sonner, zustand offline queue). Draft page
  with board/player pool, pick clock, confirm dialog, offline queue,
  ErrorBoundary, admin/rosters/onboarding/login pages.
- **Phase 4d tests: 31/31 green** (`npm run test:run`), colocated in `src/`
  (api mutations/offline queue, PickClock, ErrorBoundary, DraftPage render
  tests). Supabase is vi.mocked everywhere — unit tests never touch the DB.
  Known gotchas baked into tests: `usePickClock`'s anchor effect re-triggers
  on a new `anchoredAt` *string identity* (pass one stable string per pick);
  error-boundary resets replay the last-rendered children element.
- **A parallel agent** wired ESPN identity onto teams
  (`supabase/migrations/20260825090000_add_espn_identity_to_teams.sql`,
  `scripts/import-league.mjs`, `scripts/sql/`). It owns: player pool import
  run (import-nba.mjs vs real DB), post-draft ESPN roster mirror, keeper
  carry-over. Its work may be UNCOMMITTED in the tree — do not revert or
  commit unrelated dirty files; commit only files you touch.
- Data: `2026-27` ACTIVE pre_draft, 547 players + 472 stat rows expected
  after their import run (confirm before simulating; an empty pool blocks
  E2E). `2025-26` ARCHIVED with real history — never reset that season.
- Env: `.env` (gitignored) has VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
  SUPABASE_ACCESS_TOKEN. NEVER commit `.env`.
- `supabase db push` does NOT work on this org — use `scripts/db-query.mjs`
  (reads SUPABASE_ACCESS_TOKEN, runs SQL against the project). RPCs can also
  be called from scripts with the anon key + a real user session; for admin
  RPCs use the admin test user's session (ask user for test credentials —
  do NOT log real draft mutations against archived 2025-26).

## Your task: Phase 5

### 1. End-to-end draft simulation (the core deliverable)

Write `scripts/e2e-draft-sim.mjs` (node, uses SUPABASE_URL + anon key from
.env, plus two test users' sessions to exercise RLS properly — or service-role
bypass ONLY if user approves, since it skips turn checks' auth context).
Script flow against a THROWAWAY season (create via `create_season`, e.g.
label `E2E-SIM`, and clean up with a hard delete SQL script at the end —
reset_draft only clears picks, so add an explicit cleanup SQL file under
`scripts/sql/` that deletes the sim season and its rows):

1. `create_season('E2E-SIM')` → get its id.
2. `set_draft_order` with 3–4 teams.
3. `set_draft_status('running')`.
4. Loop 5+ picks via `make_pick` (correct team, correct turn order, overall
   pick numbers).
5. Assert wrong-turn rejection: `make_pick` for a team NOT on the clock must
   return the RPC error.
6. Assert player-taken rejection: repeat a drafted player_id.
7. `undo_last_pick` → verify last pick cleared and it's that team's turn
   again.
8. `set_draft_status('paused')` → `make_pick` should be rejected while
   paused; resume → pick succeeds.
9. `trade_pick` between two teams → board slots swap.
10. Cleanup: delete the E2E-SIM season rows (order: draft_picks, rosters,
    draft_settings, season — respect FKs).

Print PASS/FAIL per step with a non-zero exit code on any failure. Run it,
fix what it finds (script bugs vs genuine RPC bugs — for RPC bugs, write a
migration via scripts/db-query.mjs and note it in the commit message).

Then a short MANUAL two-window realtime check (not scripted): user opens the
draft page in two browsers as two claimed teams, makes a pick in one, confirms
the other window updates without refresh (postgres_changes → cache
invalidation in `src/api/realtime.ts`). Provide the user a checklist; don't
automate this.

### 2. Delete legacy/

- Remove `legacy/` (the parked 2025 app) — confirm vitest config still only
  includes `src/`, `tsconfig`/build excludes reference nothing in legacy/,
  and no import path reaches it. One commit: `git rm -r legacy/` plus any
  config cleanup.

### 3. Netlify deploy

- `netlify.toml` exists; siteId in `.netlify/state.json`. Build command is
  `npm run build`, publish `dist/`. Env vars needed on the site:
  VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (set via dashboard or
  `netlify env put` — ask the user, don't guess values).
- Deploy, then smoke-check: `/` redirects to login, login works against live
  auth, draft route loads for a claimed non-admin user.
- Add redirect/rewrite for the TanStack Router SPA if missing (/* → /index.html).

## Conventions / rules

- ALL reads/writes go through `src/api/` in the app; scripts may call RPCs
  directly with keys from `.env`.
- RPC params are `p_`-prefixed. Never run draft mutations against 2025-26.
- Build must pass: `npm run build`. Lint clean: `npx eslint src`. Tests
  green: `npm run test:run`.
- Commit per slice: sim script + fixes, legacy removal, deploy config.
- ESPN league ID for import scripts is **201**.
- Still pending from user: rotate old service_role key in Supabase dashboard;
  revoke ESPN cookies after import testing wraps.

## After Phase 5

Remaining backlog (parallel agent's track): post-draft ESPN roster mirror
(extend import-league.mjs with ?view=mRoster → upsert rosters matched by
espn_id), keeper carry-over UI/logic, and in-app keeper marking if wanted.
