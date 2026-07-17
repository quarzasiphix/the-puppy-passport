-- Found during a legal/GDPR review of the schema: the bulk grant in 20260101002900_table_grants.sql
-- gave `authenticated` SELECT on every column of `profiles`, matching the pre-existing
-- `"profiles are viewable by any authenticated user" ... using (true)` policy. Since that policy
-- makes every row visible to any signed-in user, and the column grant covered every column, any
-- authenticated account could bulk-read every other user's email and phone number with a single
-- raw REST call (`?select=id,email,phone`) — a real personal-data exposure, not just a UI gap
-- (CLAUDE.md: protect private data at the RLS layer, not by hiding UI).
--
-- Fix: drop email/phone from the broad authenticated column grant. Everything else stays visible
-- (display_name, names, avatar, city/country, locale prefs) since existing features legitimately
-- cross-reference it (e.g. a kennel owner seeing a buyer's name/city on their reservations list).
-- The signed-in user still needs their own email/phone on their profile page — get_my_profile() is
-- a SECURITY DEFINER escape hatch that returns the full row but is hard-coded to auth.uid(), so it
-- can never be used to read anyone else's contact details regardless of what a client requests.
revoke select on public.profiles from authenticated;

grant select (
  id, display_name, first_name, last_name, avatar_url, city, country,
  preferred_language, preferred_currency, created_at, updated_at
) on public.profiles to authenticated;

create or replace function public.get_my_profile()
returns public.profiles
language sql
security definer
stable
set search_path = public
as $$
  select * from public.profiles where id = (select auth.uid());
$$;

grant execute on function public.get_my_profile() to authenticated;
