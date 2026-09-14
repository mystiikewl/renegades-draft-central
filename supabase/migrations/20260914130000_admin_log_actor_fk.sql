-- FK from admin_log.actor to profiles so PostgREST can embed the actor's
-- display name (admin_log card shows "who did what" without a second query).

alter table public.admin_log
  add constraint admin_log_actor_fkey
  foreign key (actor) references public.profiles (id) on delete set null;
