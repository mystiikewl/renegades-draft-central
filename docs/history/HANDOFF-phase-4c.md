# HANDOFF — Continue the Renegades Draft Central 2026 rebuild (Phase 4c)

You are continuing an in-progress complete rebuild of a web app for a private NBA
ESPN dynasty draft league. Work happens on branch `feature/draft-central-work`.
Read `CLAUDE.md`, `docs/AUDIT-2026-rebuild-baseline.md`, and this file before starting.

## Current state (all committed, build passing)

**Backend: 100% done and live** on Supabase project `xruqdjonzxkzwsslzpdl`
(https://xruqdjonzxkzwsslzpdl.supabase.co):

- Fresh season-aware schema applied (see `supabase/migrations/20260825*`):
  `seasons`, `teams`, `profiles` (id = auth.uid()), `players` (espn_id keyed),
  `player_seasons` (stats JSONB), `rosters` (single source of drafted truth:
  season+team+player, acquisition draft/keeper/trade), `draft_picks` (board slots,
  pick_number is OVERALL 1..N), `draft_settings` (per season), `user_favourites`.
- ALL draft logic is server-side SECURITY DEFINER RPCs with internal authz:
  `make_pick(season,player)` (turn check + atomic), `undo_last_pick`,
  `set_draft_order(season, team uuid[])` (generates snake/linear slots, only pre-draft),
  `set_draft_status(season, status)`, `trade_pick`, `assign_keeper`/`remove_keeper`
  (keeper_limit enforced), `reset_draft`, `claim_team`, `create_season(label)`,
  helper `is_admin()`. Client NEVER writes draft_picks/rosters directly.
- RLS: read-for-authenticated, writes via RPCs only, profiles self-update can't
  touch is_admin. No hardcoded emails.
- Data live: `2025-26` season ARCHIVED (10 teams, 12 profiles w/ real auth users —
  all can log in with old credentials, 80 picks, 170 roster spots); `2026-27` season
  ACTIVE/pre_draft with 547 players + 472 stat rows (ESPN 2025-26 averages) loaded
  via `scripts/import-nba.mjs` (idempotent, re-runnable).
- Old 36 migrations in `supabase/migrations-archive-2025/` (reference only).
- Edge functions deleted. **Still pending from user: rotate old service_role key
  in Supabase dashboard (Settings → API).**

**Frontend: Phase 4a done** — new `src/` app, old app in `legacy/` (excluded from
build/tests; delete when parity reached):

- Stack: Vite + React 18 + TS, TanStack Router (typed, code-based routes in
  `src/App.tsx`), TanStack Query v5, Tailwind 3 + surviving shadcn set in
  `src/components/ui/`, sonner toasts, Zustand available (installed, unused yet).
- `src/api/` is the ONLY data layer: `types.ts` (domain types), `queries.ts`
  (all reads, `qk` key factory), `mutations.ts` (all writes via RPCs),
  `realtime.ts` (ONE channel per season → invalidates query cache).
- `src/auth/AuthContext.tsx` (session + profile), `src/pages/LoginPage.tsx`,
  `src/pages/DraftPage.tsx` (status header, on-clock banner with YOUR PICK state,
  round-grid board, searchable player pool w/ PPG/RPG/APG/GP, team-scoped Pick
  button, admin override, Undo last pick).
- Env: `.env` (gitignored) has VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
  SUPABASE_ACCESS_TOKEN (Management API, for `scripts/db-query.mjs` — runs SQL
  files against the project; `supabase db push` does NOT work on this org).
  Service key for import scripts: still the old one embedded in
  `legacy/../scripts/import-players.js` (grep for JWT) until rotated.

## Your task: Phase 4c — Onboarding, Admin, Rosters

Continue in this order, committing per slice:

1. **Team claim onboarding** — if logged-in profile has `team_id = null`, show a
   team-selection page (unclaimed teams = `teams.owner_profile_id IS NULL`) calling
   `claim_team` RPC. Guard the draft page behind it.
2. **Admin panel** (route `/admin`, gate on `profile.is_admin`):
   - Create season (`create_season` label e.g. '2026-27' — note one already exists),
   - Set draft order: drag-to-reorder team list → `set_draft_order(seasonId, uuid[])`,
   - Start/pause/resume draft → `set_draft_status` ('running'/'paused'/'pre_draft'),
   - Full reset via `reset_draft` (use a real AlertDialog, not window.confirm),
   - Rollback = `undo_last_pick` already exposed on the draft page.
3. **Team rosters page** (`/rosters`): per-team roster for active season grouped by
   acquisition (keepers vs drafted), with archived 2025-26 season switchable.
4. Keep all reads/writes in `src/api/` — add queries/mutations there, never raw
   supabase calls in components.

## Remaining after 4c (for planning)

- **4b hardening:** visible pick clock (pick_time_limit_seconds) w/ pause, pick
  confirm dialog, offline queue, ErrorBoundary on draft route, mobile-first board.
- **4d tests:** pick flow (happy/wrong-turn/conflict), undo, admin ops — vitest
  configured (`src/test/setup.ts`, include src only).
- **Phase 5:** end-to-end draft simulation (set order → run → make picks incl.
  wrong-turn rejection → undo → pause → trade), delete `legacy/`, Netlify deploy
  (`netlify.toml` exists; siteId in `.netlify/state.json`).

## Conventions

- RPC params are `p_`-prefixed (`p_season_id`, `p_player_id`, `p_order`...).
- DraftPick.pick_number is OVERALL (1..80), not per-round.
- Old data quirks are documented in `archive/manifest.json` + `scripts/import-2025-archive.mjs`.
- Never commit `.env`. Never hardcode keys (the leaked service key is being rotated).
