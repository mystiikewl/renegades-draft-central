-- Add ESPN identity columns to teams for the read-only league sync (league 201).
-- Nullable-unique on espn_team_id so a bad re-import can't fork a team.
alter table public.teams
  add column if not exists espn_team_id int,
  add column if not exists espn_owner_id text,
  add column if not exists espn_logo_url text;

create unique index if not exists teams_espn_team_id_key
  on public.teams (espn_team_id)
  where espn_team_id is not null;
