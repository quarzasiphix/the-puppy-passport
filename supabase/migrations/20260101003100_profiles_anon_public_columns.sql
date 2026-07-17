-- Public marketplace pages embed the kennel owner's display name
-- (organisations!organisations_owner_user_id_fkey -> profiles.display_name, see
-- listApprovedKennels in src/lib/queries/marketplace.ts) for anonymous visitors. profiles has no
-- anon policy at all today, so that embed hard-fails with "permission denied" before RLS even
-- runs (Postgres checks table/column privileges first).
--
-- Fix scope is deliberately narrow: anon gets a row-visibility policy (mirrors the existing
-- `to authenticated using (true)` policy) plus a *column-level* grant limited to the handful of
-- fields that are meant to be publicly displayable. Sensitive columns (email, phone, first_name,
-- last_name, country, city) are simply never granted to anon, so no policy change or app-code
-- discipline can accidentally leak them to an unauthenticated request.
create policy "public reads basic profile display info"
  on public.profiles for select
  to anon
  using (true);

grant select (id, display_name, avatar_url) on public.profiles to anon;
