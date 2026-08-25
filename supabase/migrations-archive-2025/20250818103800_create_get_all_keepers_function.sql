drop function if exists get_all_keepers(text);

create or replace function get_all_keepers(p_season text)
returns table (
  id uuid,
  name text,
  "position" text,
  nba_team text,
  is_drafted boolean,
  is_keeper boolean
)
language plpgsql
security invoker
as $$
begin
  return query
  select
    p.id,
    p.name,
    p.position,
    p.nba_team,
    p.is_drafted,
    true as is_keeper
  from keepers k
  join players p on k.player_id = p.id
  where k.season = p_season;
end;
$$;
