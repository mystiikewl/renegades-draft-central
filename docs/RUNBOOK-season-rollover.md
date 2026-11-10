# Season rollover runbook — 2027 (and beyond)

This is the scripted path for closing out a completed season and opening the
next one. It exists so rollover is never done ad-hoc. Each step is
idempotent and dry-run-gated where it touches data.

## State after the 2026-27 rollover (2026-11-10)

- `2025-26`: `status = archived`, `is_active = false` (legacy import, read-only).
- `2026-27`: `status = complete`, `is_active = false`. Draft history preserved
  (80 picks, 168 roster spots, 4 accepted trades). `keepers_finalized_at` set.
- `2027-28`: `status = pre_draft`, `is_active = true`. Config cloned
  (10 teams / 17 roster / 9 keepers / linear / 120s). `keepers_finalized_at = null`,
  `draft_order = {}`. No rosters, no players-season stats, no keepers yet.

## Pre-conditions (every rollover)

1. The active season's draft is `complete` (`draft_picks` all `is_used = true`,
   no `proposed` trades). `set_draft_status('complete')` enforces the trade
   cancellation.
2. A working Supabase access path: either a fresh `SUPABASE_ACCESS_TOKEN` or
   an admin JWT + the dashboard SQL editor for DDL.
3. ESPN session cookies (`ESPN_S2`, `ESPN_SWID`) refreshed if older than ~2
   weeks.

## Steps

### 1. Close out the completed season (already done for 2026-27)

```sql
select public.set_draft_status('<season_id>', 'complete');
```

This flips season + settings to `complete`, cancels `proposed` trades, clears
timers. Accepted trades and rosters are preserved as history. Verify:

```sql
select status, is_active from public.seasons where label = '2026-27';
select count(*) filter (where not is_used) as unused_picks from public.draft_picks where season_id = (select id from public.seasons where label = '2026-27');
select status, count(*) from public.trades where season_id = (select id from public.seasons where label = '2026-27') group by status;
```

### 2. Create the next season

```sql
select public.create_season('2027-28');   -- returns the new season id
```

Guards: label format `YYYY-YY`, rollover year, no twin start-year, active
season must be `complete`. `is_active` flips from the old season to the new
one. `draft_settings` is cloned from the prior season (migration
`20261110000000_...`); on a fresh DB without that migration, call
`update_draft_settings` afterwards to set `league_size / roster_size /
keeper_limit / draft_type / pick_time_limit_seconds`.

### 3. Refresh the player pool (when data is available)

```sh
node --env-file=.env scripts/import-nba.mjs
node --env-file=.env scripts/import-projections.mjs   # if projections exist for the new season
```

`import-nba` upserts `players` (global) and `player_seasons` (per season).
Run a dry diff first if unsure:

```sh
node --env-file=.env scripts/sync-player-teams.mjs        # diff only
node --env-file=.env scripts/sync-player-teams.mjs --apply # write
```

### 4. Mirror ESPN rosters into the new season

```sh
node --env-file=.env scripts/import-league.mjs --season 2027 --dry-run   # preview
node --env-file=.env scripts/import-league.mjs --season 2027              # apply
```

`import-league` upserts `teams` (match by `espn_team_id`, never inserts) and
mirrors rosters. It infers keepers from the upcoming-season ESPN feed. It is
read-only once `keepers_finalized_at` is set, so it is safe to re-run.

### 5. Keeper selection (manager-driven, later)

Managers tag keepers via the app (KeeperManager) or `assign_keeper` RPC.
Eligibility: player must have been on that team's roster in the prior season
(`2026-27`). Limits: 9 keepers of 17 roster spots (configurable via
`update_draft_settings` before finalizing).

### 6. Finalize keepers

Commissioner runs Finalize in the app (or `finalize_keepers(season_id)` RPC).
This drops every non-keeper roster row and generates the empty pick grid
(`roster_size - keeper_limit` rounds). Sets `keepers_finalized_at`.

### 7. Set the draft order

Admin → Draft order (or `set_draft_order` RPC). Starts empty; reorder as
needed. Accepted pick trades are re-applied automatically on regeneration.

### 8. Start drafting

```sql
select public.set_draft_status('<season_id>', 'running');
```

## Rollback / repair

- Twin season created by mistake: see `scripts/sql/remove-duplicate-26-27-season.sql`
  and `scripts/sql/revert-stale-proposed-trade-2026-27.sql` for the repair pattern.
- Keeper set wrong before finalizing: `unfinalize_keepers(season_id)` reopens it
  (does not restore dropped rows; re-run `import-league` then finalize).
- Draft grid wrong: `set_draft_order` regenerates while preserving accepted
  trades.

## Pending code changes (apply via dashboard SQL editor / management API)

- `supabase/migrations/20261110000000_create_season_clone_settings.sql` —
  `create_season` clones `draft_settings` from the prior season.
- `supabase/migrations/20261110000001_assign_keeper_prior_season_by_label.sql` —
  `assign_keeper` resolves the prior season by label (year-1) instead of
  "most recent inactive".

Until these are applied, use `update_draft_settings` after `create_season` (as
done for 2027-28) and rely on the existing (working) eligibility check.