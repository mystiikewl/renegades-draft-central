-- players.experience — ESPN years-of-league-experience (0 = rookie).
-- Populated by scripts/import-nba.mjs from the roster feed's `experience` field.
alter table public.players
  add column if not exists experience int;
