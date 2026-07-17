create type public.housing_type as enum ('house', 'apartment');
create type public.collection_method as enum ('pickup', 'domestic_transport', 'international_transport');
create type public.application_type as enum ('purchase', 'adoption', 'rehoming_inquiry');
create type public.buyer_application_status as enum (
  'submitted', 'under_review', 'more_info_requested', 'call_requested', 'waiting_list',
  'approved', 'rejected', 'withdrawn', 'converted_to_reservation'
);

create table public.buyer_applications (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals (id) on delete cascade,
  litter_id uuid references public.litters (id),
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid references public.organisations (id),
  application_type public.application_type not null default 'purchase',
  buyer_city text,
  buyer_country text,
  phone text,
  housing_type public.housing_type,
  has_garden boolean,
  has_children boolean,
  children_ages text,
  other_animals text,
  previous_experience text,
  breed_knowledge text,
  working_schedule text,
  alone_time text,
  intended_purpose text,
  collection_method public.collection_method,
  transport_required boolean not null default false,
  preferred_collection_date date,
  message text,
  status public.buyer_application_status not null default 'submitted',
  breeder_response text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_buyer_applications_updated_at
  before update on public.buyer_applications
  for each row execute function public.set_updated_at();

-- One *active* application per buyer/animal — withdrawn, rejected or converted applications don't
-- block a fresh one.
create unique index buyer_applications_active_unique
  on public.buyer_applications (buyer_id, animal_id)
  where status not in ('withdrawn', 'rejected', 'converted_to_reservation');

alter table public.buyer_applications enable row level security;

create policy "buyers manage their own applications"
  on public.buyer_applications for all
  to authenticated
  using (buyer_id = (select auth.uid()))
  with check (buyer_id = (select auth.uid()));

create policy "org owners view and update applications for their animals"
  on public.buyer_applications for select
  to authenticated
  using (organization_id is not null and public.owns_org(organization_id));

create policy "org owners update applications for their animals"
  on public.buyer_applications for update
  to authenticated
  using (organization_id is not null and public.owns_org(organization_id))
  with check (organization_id is not null and public.owns_org(organization_id));

create policy "admins manage all buyer applications"
  on public.buyer_applications for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
