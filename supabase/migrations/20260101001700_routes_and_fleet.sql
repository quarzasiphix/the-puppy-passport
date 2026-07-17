create type public.route_status as enum ('planning', 'confirmed', 'in_progress', 'completed', 'cancelled');
create type public.route_stop_type as enum ('pickup', 'dropoff', 'rest');
create type public.driver_verification_status as enum ('unverified', 'documents_submitted', 'verified');

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  registration_number text unique,
  vehicle_type text,
  active boolean not null default true,
  crates jsonb not null default '[]'::jsonb,
  ventilation_info text,
  temperature_monitoring boolean not null default false,
  camera_available boolean not null default false,
  cleaning_status text,
  last_service_date date,
  next_service_date date,
  authorisation_notes text,
  document_expiry_date date,
  internal_notes text,
  created_at timestamptz not null default now()
);

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id),
  name text not null,
  contact text,
  availability_status text default 'available',
  internal_verification_status public.driver_verification_status not null default 'unverified',
  training_documents jsonb not null default '[]'::jsonb,
  document_expiry_date date,
  emergency_contact text,
  internal_notes text,
  created_at timestamptz not null default now()
);

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  route_name text not null,
  departure_date date,
  origin_country text,
  origin_region text,
  destination_countries text[] not null default '{}',
  destination_regions text[] not null default '{}',
  planned_stops jsonb not null default '[]'::jsonb,
  vehicle_id uuid references public.vehicles (id),
  driver_id uuid references public.drivers (id),
  max_capacity integer not null default 1,
  internal_cost_estimate numeric(10, 2),
  customer_revenue_estimate numeric(10, 2),
  status public.route_status not null default 'planning',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_routes_updated_at
  before update on public.routes
  for each row execute function public.set_updated_at();

create table public.route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes (id) on delete cascade,
  stop_order integer not null,
  city text,
  country text,
  stop_type public.route_stop_type not null default 'rest',
  planned_time timestamptz
);

create table public.route_assignments (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes (id) on delete cascade,
  transport_request_id uuid not null references public.transport_requests (id) on delete cascade,
  compatibility_checked boolean not null default false,
  compatibility_notes text,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles (id),
  unique (route_id, transport_request_id)
);

create type public.operator_authorisation_type as enum ('type_1', 'type_2', 'other', 'not_yet_approved', 'awaiting_renewal');
create type public.operator_authorisation_status as enum ('active', 'expired', 'pending');

create table public.transport_operator_authorisations (
  id uuid primary key default gen_random_uuid(),
  authorisation_type public.operator_authorisation_type not null,
  authorisation_number text,
  issuing_authority text,
  valid_from date,
  expiry_date date,
  countries_covered text[] not null default '{}',
  supporting_document_url text,
  status public.operator_authorisation_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- Now that vehicles/drivers/routes exist, wire up the forward references left on
-- transport_requests.
alter table public.transport_requests
  add constraint transport_requests_route_fk foreign key (assigned_route_id) references public.routes (id),
  add constraint transport_requests_vehicle_fk foreign key (assigned_vehicle_id) references public.vehicles (id),
  add constraint transport_requests_driver_fk foreign key (assigned_driver_id) references public.drivers (id);

alter table public.vehicles enable row level security;
alter table public.drivers enable row level security;
alter table public.routes enable row level security;
alter table public.route_stops enable row level security;
alter table public.route_assignments enable row level security;
alter table public.transport_operator_authorisations enable row level security;

-- Fleet, driver, route and authorisation records are internal operations data — nothing here is
-- publicly readable (the "authorised" badge shown publicly reads only a boolean derived from this
-- table via a narrow function/view added later, never the raw records).
create policy "ops staff manage vehicles"
  on public.vehicles for all to authenticated
  using (public.is_ops_staff()) with check (public.is_ops_staff());

create policy "ops staff manage drivers"
  on public.drivers for all to authenticated
  using (public.is_ops_staff()) with check (public.is_ops_staff());

create policy "drivers view their own driver record"
  on public.drivers for select to authenticated
  using (profile_id = (select auth.uid()));

create policy "ops staff manage routes"
  on public.routes for all to authenticated
  using (public.is_ops_staff()) with check (public.is_ops_staff());

create policy "ops staff manage route stops"
  on public.route_stops for all to authenticated
  using (public.is_ops_staff()) with check (public.is_ops_staff());

create policy "ops staff manage route assignments"
  on public.route_assignments for all to authenticated
  using (public.is_ops_staff()) with check (public.is_ops_staff());

create policy "requesters view route assignment of their own request"
  on public.route_assignments for select to authenticated
  using (
    exists (
      select 1 from public.transport_requests tr
      where tr.id = transport_request_id and tr.requester_profile_id = (select auth.uid())
    )
  );

create policy "admins manage transport operator authorisations"
  on public.transport_operator_authorisations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "authenticated users read active authorisations"
  on public.transport_operator_authorisations for select
  to anon, authenticated
  using (status = 'active');
