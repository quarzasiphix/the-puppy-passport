-- Transport-company "Trips" — a lightweight, org-owned multi-stop dispatch tool for a company's
-- own internally-organized runs (e.g. "trip to Netherlands, 6 dogs"), as opposed to the heavy,
-- customer-facing, compliance-driven `transport_requests` model (26 statuses, a full legal/health
-- questionnaire, ops review). Deliberately NOT built on transport_requests: there is no existing
-- path today for an org to create a transport_requests row for itself at all (orgs can only be
-- assigned an *existing* customer job, via assign_own_driver_to_job/assign_own_vehicle_to_job,
-- 20260914000000_transport_company_dispatch.sql) — forcing "I'm personally driving my own dogs"
-- through that model would mean fabricating fake compliance/declaration answers for no reason.
--
-- Reuses the org-ownership pattern from 20260912150000_fleet_multi_tenancy.sql exactly
-- (organization_id + is_org_member()-gated RLS) but needs no RPCs: unlike dispatch (reassigning
-- someone else's existing job across a trust boundary), a trip is the org's own data from the
-- moment it's created, so plain RLS-scoped CRUD is the right amount of mechanism — same shape as
-- the existing "company members manage their own vehicles/drivers" policies.

create type public.trip_status as enum ('planning', 'in_progress', 'completed', 'cancelled');
create type public.trip_stop_status as enum ('pending', 'picked_up', 'delivered');

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organisations(id),
  name text not null,
  status public.trip_status not null default 'planning',
  departure_date date,
  -- A manually-pasted whole-trip Google Maps link (e.g. a multi-waypoint directions URL the user
  -- builds themselves in Google Maps) — MVP explicitly wants pasted links, not geocoding or an
  -- auto-generated route from the individual stop addresses.
  route_maps_url text,
  vehicle_id uuid references public.vehicles(id),
  driver_id uuid references public.drivers(id),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trips_organization_id_idx on public.trips(organization_id);

create table public.trip_stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  stop_order integer not null,
  -- Free-text animal identifier (e.g. "Bella (Golden Retriever)") — no FK required. Same
  -- "optional link, always keep a usable snapshot" pattern already established twice in this
  -- schema (transport_requests.animal_id, transport_request_animals.animal_id).
  animal_label text not null,
  -- Optional forward-linkage to a real customer booking, unused by the MVP UI — kept nullable and
  -- unenforced so a future feature (e.g. reporting, or folding a real transport_request into a
  -- trip) doesn't need a schema change to attach one.
  transport_request_id uuid references public.transport_requests(id),
  pickup_maps_url text,
  pickup_contact_name text,
  pickup_contact_phone text,
  pickup_notes text,
  dropoff_maps_url text,
  dropoff_contact_name text,
  dropoff_contact_phone text,
  dropoff_notes text,
  status public.trip_stop_status not null default 'pending',
  picked_up_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, stop_order)
);

alter table public.trips enable row level security;
create policy "org members manage their own trips" on public.trips
  for all to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
create policy "admins manage all trips" on public.trips
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.trip_stops enable row level security;
create policy "org members manage their own trip stops" on public.trip_stops
  for all to authenticated
  using (exists (
    select 1 from public.trips t
    where t.id = trip_stops.trip_id and public.is_org_member(t.organization_id)
  ))
  with check (exists (
    select 1 from public.trips t
    where t.id = trip_stops.trip_id and public.is_org_member(t.organization_id)
  ));
create policy "admins manage all trip stops" on public.trip_stops
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.trips from public, anon;
revoke all on public.trip_stops from public, anon;
grant select, insert, update, delete on public.trips to authenticated;
grant select, insert, update, delete on public.trip_stops to authenticated;
