-- Trade assets are historical snapshots. Keep the source UUIDs for audit/debug
-- purposes, but do not let ledger rows prevent roster deletion or pick-board
-- regeneration later in the season lifecycle.

alter table public.trade_assets
  drop constraint if exists trade_assets_roster_id_fkey;

alter table public.trade_assets
  drop constraint if exists trade_assets_draft_pick_id_fkey;
