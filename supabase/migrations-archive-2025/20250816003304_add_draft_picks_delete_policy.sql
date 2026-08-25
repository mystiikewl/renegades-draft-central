CREATE POLICY "Admins can delete draft picks"
ON public.draft_picks FOR DELETE
USING (
  (
    SELECT is_admin
    FROM public.profiles
    WHERE user_id = auth.uid()
  ) = TRUE
);
