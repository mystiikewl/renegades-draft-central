-- players bio enrichment — captured from ESPN feeds by scripts/import-nba.mjs
-- (roster: dateOfBirth/displayHeight/weight; athlete endpoint: displayDraft).
-- experience already exists.
alter table public.players
  add column if not exists birth_date date,
  add column if not exists height text,
  add column if not exists weight int,
  add column if not exists draft_display text;
