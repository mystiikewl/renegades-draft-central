# HANDOFF — Phase 4b: Draft hardening (new session prompt)

Copy everything below the line into a fresh session on branch
`feature/draft-central-work` of Renegades Draft Central
(`C:\Users\ataha\Documents\Projects\renegades-draft-central`).

---

You are continuing an in-progress complete rebuild of Renegades Draft Central
(web app for a private NBA ESPN dynasty draft league, ESPN league ID **201**).
Work happens on branch `feature/draft-central-work`. Before starting, read in
full: `CLAUDE.md`, `docs/HANDOFF-phase-4c.md`, and
`docs/HANDOFF-phase-4b.md` (this file). Also skim
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

**Frontend: Phases 4a + 4c done.** New app in `src/`, old app parked in
`legacy/` (excluded from build/tests):

- Vite + React 18 + TS, TanStack Router (typed code-based routes in
  `src/App.tsx`) + TanStack Query v5, Tailwind 3 + shadcn set in
  `src/components/ui/`, sonner toasts. dnd-kit is installed (used by Admin).
- `src/api/` is the ONLY data layer: `types.ts`, `queries.ts` (all reads, `qk`
  key factory), `mutations.ts` (all writes via RPCs), `realtime.ts` (ONE
  postgres channel per season → cache invalidation).
- `src/auth/AuthContext.tsx` (session + profile); guards in `src/App.tsx`:
  `RequireAuth` → `RequireTeam` (onboarding at `src/pages/OnboardingPage.tsx`
  via `claim_team`) → `RequireAdmin`.
- Pages: `DraftPage.tsx` (status header, on-clock banner w/ YOUR PICK state,
  round-grid board, searchable player pool w/ PPG/RPG/APG/GP, team-scoped
  Pick, admin override, Undo last pick), `AdminPage.tsx` (create season,
  dnd-kit draft order → `set_draft_order`, start/pause/pre-draft via
  `set_draft_status`, reset behind AlertDialog), `RostersPage.tsx` (per-team
  cards grouped keepers/drafted/trade, season switcher incl. archived
  2025-26), `LoginPage.tsx`. Header nav: Draft/Rosters/Admin.
- A separate agent is working on app DESIGN/visual polish in parallel —
  keep this phase functional; don't do a visual redesign here, and prefer
  minimal, easily-restylable markup.
- Env: `.env` (gitignored) has VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
  SUPABASE_ACCESS_TOKEN. NEVER commit `.env`.

## Your task: Phase 4b — draft hardening

1. **Visible pick clock** — countdown from
   `draft_settings.pick_time_limit_seconds` while status is 'running',
   showing time left for the team on the clock. Pause the visual countdown
   when status is 'paused'. Note: the backend does NOT enforce expiry
   (no auto-pick/skip server-side) — this is a display/UX concern only; do
   NOT add server auto-pick in this phase.
2. **Pick confirm dialog** — clicking Pick in the player pool opens a small
   confirm (Dialog or Popover) showing player name/team/position before
   `make_pick` fires. Keep it fast (one extra click max).
3. **Offline queue** — if `make_pick` fails due to network (supabase-js
   throws a network error, not an RPC rejection), queue the intent and retry
   when connectivity returns; surface queued state in the UI. RPC rejections
   (wrong turn, player taken) must NOT be retried — toast them as today.
   Zustand is installed and unused if you want a small store for this.
4. **ErrorBoundary on the draft route** — wrap the draft page so a render
   crash shows a recovery UI ("Reload draft") instead of a white screen.
5. **Mobile-first board** — make DraftPage usable on phones: collapsible or
   horizontally scrollable board, player pool reachable (Tabs or Drawer —
   both exist in `src/components/ui/`), touch-friendly pick rows.

## Conventions / rules

- ALL reads/writes go through `src/api/` (queries.ts/mutations.ts) — no raw
  supabase calls in components/pages.
- RPC params are `p_`-prefixed. DraftPick.pick_number is OVERALL (1..N).
- Build must pass: `npm run build`. `src/` must lint clean
  (`npx eslint src` — legacy/ has pre-existing errors, ignore it).
- Commit per slice (clock, confirm dialog, offline queue, error boundary,
  mobile board — reasonable groupings fine).
- ESPN league ID for import scripts is **201**.

## Remaining after 4b (for planning)

- **4d tests:** pick flow (happy/wrong-turn/conflict), undo, admin ops —
  vitest configured (`src/test/setup.ts`, include src only).
- **Phase 5:** end-to-end draft simulation (set order → run → make picks
  incl. wrong-turn rejection → undo → pause → trade), delete `legacy/`,
  Netlify deploy (`netlify.toml` exists; siteId in `.netlify/state.json`).
- Still pending from user: rotate old service_role key in Supabase dashboard.
