-- Post-apply advisor fixup (function_search_path_mutable): set_dog_slug() is a plain SECURITY
-- INVOKER BEFORE-INSERT trigger doing only string manipulation on NEW (lower/regexp_replace/
-- coalesce/substr — all built-ins, no schema-qualified object access), so a mutable search_path is
-- functionally harmless here, but the security advisor flags every function without an explicit
-- one and this project's convention is to keep that list clean. `= ''` is the tightest safe
-- choice for a function that references nothing outside pg_catalog.
create or replace function public.set_dog_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug is null then
    new.slug := lower(regexp_replace(coalesce(nullif(btrim(new.registered_name), ''), 'dog'), '[^a-zA-Z0-9]+', '-', 'g'))
      || '-' || substr(new.id::text, 1, 8);
  end if;
  return new;
end;
$$;

revoke all on function public.set_dog_slug() from public, anon, authenticated;
