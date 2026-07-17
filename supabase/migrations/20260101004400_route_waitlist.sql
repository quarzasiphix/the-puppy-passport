-- Lets a visitor register interest in a route that doesn't exist yet ("I need Poland → Spain
-- sometime in August") without committing to a full transport request. Ops uses the aggregate of
-- these (grouped by country pair) to decide which routes are worth planning next — "demand
-- clustering" per docs/IMPLEMENTATION_PLAN.md.
create type public.route_waitlist_status as enum ('open', 'matched', 'cancelled');

create table public.route_waitlist (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  origin_country text not null,
  destination_country text not null,
  earliest_date date,
  latest_date date,
  notes text,
  status public.route_waitlist_status not null default 'open',
  matched_route_id uuid references public.routes (id),
  created_at timestamptz not null default now()
);

alter table public.route_waitlist enable row level security;

create policy "users manage their own waitlist entries"
  on public.route_waitlist for all
  to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "ops staff manage all waitlist entries"
  on public.route_waitlist for all
  to authenticated
  using (public.is_ops_staff())
  with check (public.is_ops_staff());

grant select, insert, update, delete on public.route_waitlist to authenticated;
