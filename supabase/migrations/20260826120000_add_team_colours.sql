-- Team colours are commissioner-owned identity data used by the draft board.
alter table public.teams
  add column if not exists team_color text not null default '#2563EB'
  check (team_color ~ '^#[0-9A-Fa-f]{6}$');

create or replace function public.set_team_color(p_team_id uuid, p_team_color text)
returns void
language plpgsql
security definer
set search_path = 'public', 'auth'
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  if p_team_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Team colour must be a six-digit hex value';
  end if;

  update public.teams
    set team_color = upper(p_team_color)
    where id = p_team_id;

  if not found then
    raise exception 'Team not found';
  end if;
end;
$$;

grant execute on function public.set_team_color(uuid, text) to authenticated;
