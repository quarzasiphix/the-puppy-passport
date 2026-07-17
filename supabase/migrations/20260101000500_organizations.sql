-- organisations generalizes what the original brief called "kennels" so the same table (and the
-- same RLS shape) serves kennels, foundations, shelters, rescues, the transport company itself,
-- and kennel clubs. Type-specific UI reads/writes the same columns; nothing here is breeder-only.

create type public.org_type as enum (
  'kennel', 'foundation', 'shelter', 'rescue', 'transport_company', 'kennel_club', 'other'
);
create type public.org_verification_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.org_member_role as enum (
  'owner', 'administrator', 'employee', 'breeder', 'volunteer', 'driver', 'viewer'
);

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  org_type public.org_type not null,
  name text not null,
  slug text not null unique,
  logo_url text,
  cover_image_url text,
  description text,
  country text,
  city text,
  -- Coarse, publicly-safe location (e.g. "Warsaw, Poland" or a district name) — precise
  -- coordinates for map display are a later phase (see docs/PRODUCT_VISION.md). The exact
  -- operational address lives in private_addresses, never here.
  public_location text,
  private_address_id uuid,
  association_name text,
  membership_number text,
  registration_number text,
  years_experience integer,
  response_time text,
  transport_available boolean not null default false,
  international_transport_available boolean not null default false,
  verification_status public.org_verification_status not null default 'pending',
  is_public boolean not null default false,
  owner_user_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_organisations_updated_at
  before update on public.organisations
  for each row execute function public.set_updated_at();

create table public.organisation_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  member_role public.org_member_role not null default 'owner',
  created_at timestamptz not null default now(),
  unique (org_id, profile_id)
);

alter table public.organisations enable row level security;
alter table public.organisation_members enable row level security;

-- organisations: public can only see approved + published orgs; members see their own regardless
-- of status; admins see/manage everything.
create policy "public reads approved published organisations"
  on public.organisations for select
  to anon, authenticated
  using (verification_status = 'approved' and is_public = true);

create policy "members read their own organisation"
  on public.organisations for select
  to authenticated
  using (public.is_org_member(id));

create policy "owners update their own organisation"
  on public.organisations for update
  to authenticated
  using (public.owns_org(id))
  with check (public.owns_org(id));

create policy "admins manage all organisations"
  on public.organisations for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- organisation_members: members can see their own membership rows; owners manage staff on their
-- org; admins manage everything. The first (owner) row is created by approve_user_verification
-- (see the user_verifications migration) — there is no self-insert policy here.
create policy "members read their own membership rows"
  on public.organisation_members for select
  to authenticated
  using (profile_id = (select auth.uid()) or public.owns_org(org_id));

create policy "owners manage staff on their organisation"
  on public.organisation_members for all
  to authenticated
  using (public.owns_org(org_id))
  with check (public.owns_org(org_id));

create policy "admins manage all organisation members"
  on public.organisation_members for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
