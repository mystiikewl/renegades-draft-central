-- Allow non-admin users to insert keepers for their own team
create policy "Users can add keepers to their own team"
  on keepers for insert
  with check (
    team_id in (
      select team_id from profiles where user_id = auth.uid()
    )
  );