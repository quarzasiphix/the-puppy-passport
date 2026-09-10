-- handle_new_user() originally only understood the metadata shape our own email/password signUp()
-- sends (`first_name`, `last_name`, `phone`, ...). Magic-link signups send that same shape, so
-- they were already fine — but a Google (OIDC) signup hands back `name` / `given_name` /
-- `family_name` / `picture` instead, so those users landed with a NULL name and no avatar, and
-- `display_name` came out as an empty string (concat of two NULLs) rather than NULL, which then
-- blocked every "COALESCE(display_name, ...)" fallback downstream.
--
-- This rewrite makes the trigger tolerant of both shapes: prefer our explicit fields, fall back
-- to the OIDC ones, and never store an empty-string display_name.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_first text := coalesce(meta ->> 'first_name', meta ->> 'given_name');
  v_last  text := coalesce(meta ->> 'last_name', meta ->> 'family_name');
  v_display text := coalesce(
    nullif(meta ->> 'display_name', ''),
    nullif(meta ->> 'full_name', ''),
    nullif(meta ->> 'name', ''),
    nullif(trim(concat_ws(' ', v_first, v_last)), '')
  );
begin
  insert into public.profiles (
    id, display_name, first_name, last_name, email, phone, avatar_url,
    preferred_language, preferred_currency, country, city
  )
  values (
    new.id,
    v_display,
    v_first,
    v_last,
    new.email,
    meta ->> 'phone',
    coalesce(nullif(meta ->> 'avatar_url', ''), nullif(meta ->> 'picture', '')),
    coalesce(meta ->> 'preferred_language', 'en'),
    coalesce(meta ->> 'preferred_currency', 'EUR'),
    meta ->> 'country',
    meta ->> 'city'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
