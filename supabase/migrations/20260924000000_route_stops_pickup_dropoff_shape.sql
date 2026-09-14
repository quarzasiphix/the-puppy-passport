-- Redesigns route_stops to match trip_stops: one row = one animal with BOTH a pickup leg and a
-- dropoff leg embedded, not one row = one point (the shape added last turn in
-- 20260922000000_route_stops_planning_fields.sql). route_stops is one turn old with no real
-- production rows, so this is a clean redesign, not a data migration.
alter table public.route_stops
  drop column address_text,
  drop column maps_url,
  drop column contact_name,
  drop column contact_phone,
  drop column notes;

alter table public.route_stops
  add column pickup_maps_url text,
  add column pickup_address_text text,
  add column pickup_contact_name text,
  add column pickup_contact_phone text,
  add column pickup_notes text,
  add column dropoff_maps_url text,
  add column dropoff_address_text text,
  add column dropoff_contact_name text,
  add column dropoff_contact_phone text,
  add column dropoff_notes text;

-- Exact structural mirror of trip_stop_contacts (20260917000000) — a stop's primary pickup/dropoff
-- contact fields cover the common case; real handovers sometimes need a 2nd or 3rd person.
create table public.route_stop_contacts (
  id uuid primary key default gen_random_uuid(),
  route_stop_id uuid not null references public.route_stops(id) on delete cascade,
  role_label text,
  contact_name text not null,
  contact_phone text,
  messenger_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index route_stop_contacts_route_stop_id_idx on public.route_stop_contacts(route_stop_id);

alter table public.route_stop_contacts enable row level security;

-- Routes have no company-facing side (unlike trips) — ops-only.
create policy "ops staff manage route stop contacts" on public.route_stop_contacts
  for all to authenticated using (public.is_ops_staff()) with check (public.is_ops_staff());

revoke all on public.route_stop_contacts from public, anon;
grant select, insert, update, delete on public.route_stop_contacts to authenticated;

create trigger set_route_stop_contacts_updated_at
  before update on public.route_stop_contacts
  for each row execute function public.set_updated_at();

-- Parity gap: "ops staff manage all trips"/"...trip stops" (20260923000000) never extended to
-- trip_stop_contacts, which until now only had is_org_member()/is_admin() policies — an ops
-- staffer opening a company's trip stop couldn't see or manage its extra contacts.
create policy "ops staff manage all trip stop contacts" on public.trip_stop_contacts
  for all to authenticated using (public.is_ops_staff()) with check (public.is_ops_staff());
