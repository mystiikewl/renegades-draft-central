-- =====================================================================
-- Trades: scope reads to the two participant teams
--
-- The trade center shipped with open select policies (`using (true)`),
-- so every authenticated member could read the whole league's trade
-- history — offers, assets and notes included. Tighten reads to the
-- participant teams plus admins, matching the notifications and
-- watchlist precedents. Non-admin clients render team-scoped reads
-- (useTeamTrades); AdminTradeOverridesPage keeps the league-wide read
-- via the is_admin() arm.
-- =====================================================================

drop policy if exists "authenticated users can read trades" on public.trades;

create policy "participants and admins can read trades"
on public.trades for select to authenticated
using (
  public.is_admin()
  or from_team_id = (select team_id from public.profiles where id = auth.uid())
  or to_team_id = (select team_id from public.profiles where id = auth.uid())
);

drop policy if exists "authenticated users can read trade assets" on public.trade_assets;

create policy "participants and admins can read trade_assets"
on public.trade_assets for select to authenticated
using (
  public.is_admin()
  or from_team_id = (select team_id from public.profiles where id = auth.uid())
  or to_team_id = (select team_id from public.profiles where id = auth.uid())
);
