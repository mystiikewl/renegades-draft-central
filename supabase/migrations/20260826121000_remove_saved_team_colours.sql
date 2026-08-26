-- Team colours are now calculated in the draft board from each team ID.
drop function if exists public.set_team_color(uuid, text);

alter table public.teams
  drop column if exists team_color;
