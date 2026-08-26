-- Shadow teams: exist for E2E/guest testing only; hidden from the real app.
alter table public.teams add column if not exists is_shadow boolean not null default false;
update public.teams set is_shadow = true where name = 'E2E Shadow Squad';
