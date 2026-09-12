-- Achievements (breeder-claimed titles/diplomas per dog) had only owner + is_admin()-only RLS —
-- a moderator opening this review page would see an empty list, and even if they could see rows,
-- approving/rejecting (plain client UPDATEs) would be silently blocked by RLS. No cascading side
-- effects here (unlike organisation/user_verifications approval), so a direct moderator-scoped
-- policy is enough rather than a new RPC.
create policy "moderators view all achievements"
  on public.achievements for select
  to authenticated
  using (public.is_moderator());

create policy "moderators verify achievements"
  on public.achievements for update
  to authenticated
  using (public.is_moderator())
  with check (public.is_moderator());
