-- Extensions and shared helpers used across every later migration.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- Generic updated_at maintenance, attached per-table via `create trigger ... execute function
-- public.set_updated_at()` so every table keeps the same behaviour without repeating the body.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
