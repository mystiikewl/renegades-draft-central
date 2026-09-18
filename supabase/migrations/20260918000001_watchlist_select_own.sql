-- =====================================================================
-- Watchlist: scope reads to the owner
--
-- user_favourites is the one table users write directly (own rows only).
-- The initial schema left the select policy open (`using (true)`), which
-- leaked every user's watchlist to all authenticated members. Client code
-- now ships against this table, so tighten reads to own rows to match the
-- insert/delete policies.
-- =====================================================================

drop policy favourites_select on public.user_favourites;

create policy favourites_select_own on public.user_favourites
  for select to authenticated
  using (profile_id = auth.uid());
