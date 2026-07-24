-- Stage BZ (supplemental queue): maintenance mode. No mechanism existed to take the app down for a
-- planned migration/deploy without a code change and redeploy. A single-row settings table (`id`
-- pinned to `true` via a `check`, matching a classic "always exactly one row" config pattern) that
-- `src/server.ts`'s Worker fetch handler checks directly, alongside Stage BW's `/health` endpoint --
-- both live in the same raw-request-intercept layer, before any SSR rendering happens.
create table public.app_maintenance_mode (
  id boolean primary key default true,
  enabled boolean not null default false,
  message text not null default 'Havenpaw is temporarily down for maintenance. Please check back shortly.',
  enabled_by uuid references public.profiles (id),
  enabled_at timestamptz,
  updated_at timestamptz not null default now(),
  check (id)
);

insert into public.app_maintenance_mode (id, enabled) values (true, false);

alter table public.app_maintenance_mode enable row level security;

-- Publicly readable (anon included) -- the Worker's own request-time check runs as the ordinary
-- anon-key client (the same isomorphic client every page load already uses, per
-- src/lib/supabase/browser.ts), and an anonymous visitor obviously needs to see the maintenance
-- state too, not just signed-in users.
create policy "anyone can read maintenance mode status"
  on public.app_maintenance_mode for select
  to anon, authenticated
  using (true);

create policy "admins manage maintenance mode"
  on public.app_maintenance_mode for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.app_maintenance_mode to anon, authenticated;
grant update on public.app_maintenance_mode to authenticated;

-- Server-stamps who actually flipped it on and when -- the same forgeable-actor shape this session
-- has closed repeatedly elsewhere (an admin's own RLS-scoped UPDATE could otherwise set
-- `enabled_by` to any profile id it likes). Deliberately re-stamps on *every* update that leaves
-- `enabled = true` (not only the false -> true transition) -- restamping only on transition would
-- let a forged `enabled_by` slip through on a same-value update (e.g. only editing `message` while
-- `enabled` stays true throughout). Disabling always preserves whoever last turned it on, from
-- `old`, never from client-supplied `new` -- a lightweight "who turned this on last" audit trail
-- rather than being nulled out, and never forgeable either way.
create or replace function public.stamp_maintenance_mode_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.enabled then
    new.enabled_by := auth.uid();
    new.enabled_at := now();
  else
    new.enabled_by := old.enabled_by;
    new.enabled_at := old.enabled_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger stamp_maintenance_mode_actor
  before update on public.app_maintenance_mode
  for each row execute function public.stamp_maintenance_mode_actor();
