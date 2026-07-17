-- animals generalizes the original "puppies" table so the same record type, the same images
-- table and the same saved/application/reservation machinery serve breeder puppies, foundation
-- adoption listings and private rehoming, instead of three near-duplicate tables. A row with
-- listing_category = 'not_listed' is just an animal profile attached to a transport request with
-- no public listing at all.

create type public.animal_listing_category as enum (
  'breeder_puppy', 'adoption', 'private_rehoming', 'not_listed'
);

create type public.animal_availability_status as enum (
  'draft', 'applications_open', 'available', 'reserved', 'sold', 'adopted', 'unavailable', 'withdrawn'
);

create table public.animals (
  id uuid primary key default gen_random_uuid(),
  listing_category public.animal_listing_category not null default 'not_listed',
  litter_id uuid references public.litters (id) on delete set null,
  organization_id uuid references public.organisations (id) on delete set null,
  owner_profile_id uuid references public.profiles (id) on delete set null,
  name text not null,
  slug text unique,
  breed_id uuid references public.breeds (id),
  sex public.dog_sex,
  color text,
  date_of_birth date,
  approximate_age text,
  weight_kg numeric(5, 2),
  size_category public.size_category,
  microchip_number text,
  tattoo_number text,
  registry_country text,
  registry_name text,
  registry_reference text,
  identification_verified_status text not null default 'information_provided_by_user',
  price numeric(10, 2),
  currency text default 'PLN',
  description text,
  temperament text,
  ideal_home text,
  health_tests jsonb not null default '[]'::jsonb,
  availability_status public.animal_availability_status not null default 'draft',
  is_published boolean not null default false,
  transport_available boolean not null default false,
  international_transport_available boolean not null default false,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint animals_org_or_owner check (
    (organization_id is not null and owner_profile_id is null)
    or (organization_id is null and owner_profile_id is not null)
    or (organization_id is null and owner_profile_id is null)
  )
);

create trigger set_animals_updated_at
  before update on public.animals
  for each row execute function public.set_updated_at();

create table public.animal_images (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals (id) on delete cascade,
  image_url text not null,
  display_order integer not null default 0,
  is_cover boolean not null default false,
  caption text
);

create table public.animal_ownership_history (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals (id) on delete cascade,
  owner_profile_id uuid references public.profiles (id),
  owner_organization_id uuid references public.organisations (id),
  ownership_type text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  transfer_reason text
);

create table public.saved_animals (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  animal_id uuid not null references public.animals (id) on delete cascade,
  saved_at timestamptz not null default now(),
  unique (buyer_id, animal_id)
);

alter table public.animals enable row level security;
alter table public.animal_images enable row level security;
alter table public.animal_ownership_history enable row level security;
alter table public.saved_animals enable row level security;

-- Public: breeder puppies and adoption listings, once published, from an approved+public org.
-- (Private rehoming gets its own policy added alongside the rehoming_reviews migration, since it
-- depends on that table existing.)
create policy "public reads published org-listed animals"
  on public.animals for select
  to anon, authenticated
  using (
    is_published
    and listing_category in ('breeder_puppy', 'adoption')
    and organization_id is not null
    and exists (
      select 1 from public.organisations o
      where o.id = organization_id and o.verification_status = 'approved' and o.is_public
    )
  );

create policy "org owners manage their organization's animals"
  on public.animals for all
  to authenticated
  using (organization_id is not null and public.owns_org(organization_id))
  with check (organization_id is not null and public.owns_org(organization_id));

create policy "private owners manage their own animal records"
  on public.animals for all
  to authenticated
  using (owner_profile_id = (select auth.uid()))
  with check (owner_profile_id = (select auth.uid()));

create policy "admins manage all animals"
  on public.animals for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- animal_images mirror the visibility of their parent animal.
create policy "public reads images of visible animals"
  on public.animal_images for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.animals a
      where a.id = animal_id
        and (
          (a.is_published and a.listing_category in ('breeder_puppy', 'adoption')
            and exists (
              select 1 from public.organisations o
              where o.id = a.organization_id and o.verification_status = 'approved' and o.is_public
            ))
          or a.owner_profile_id = (select auth.uid())
          or (a.organization_id is not null and public.owns_org(a.organization_id))
        )
    )
  );

create policy "owners manage images of their own animals"
  on public.animal_images for all
  to authenticated
  using (
    exists (
      select 1 from public.animals a
      where a.id = animal_id
        and (a.owner_profile_id = (select auth.uid()) or (a.organization_id is not null and public.owns_org(a.organization_id)))
    )
  )
  with check (
    exists (
      select 1 from public.animals a
      where a.id = animal_id
        and (a.owner_profile_id = (select auth.uid()) or (a.organization_id is not null and public.owns_org(a.organization_id)))
    )
  );

create policy "admins manage all animal images"
  on public.animal_images for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ownership history: visible to the current owner/org and admins only — this is provenance data,
-- not something a public visitor needs to see.
create policy "owners view their animal's ownership history"
  on public.animal_ownership_history for select
  to authenticated
  using (
    owner_profile_id = (select auth.uid())
    or (owner_organization_id is not null and public.owns_org(owner_organization_id))
    or exists (
      select 1 from public.animals a
      where a.id = animal_id
        and (a.owner_profile_id = (select auth.uid()) or (a.organization_id is not null and public.owns_org(a.organization_id)))
    )
  );

create policy "admins manage all ownership history"
  on public.animal_ownership_history for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- saved_animals: strictly the buyer's own list.
create policy "buyers manage their own saved animals"
  on public.saved_animals for all
  to authenticated
  using (buyer_id = (select auth.uid()))
  with check (buyer_id = (select auth.uid()));

create policy "admins view all saved animals"
  on public.saved_animals for select
  to authenticated
  using (public.is_admin());
