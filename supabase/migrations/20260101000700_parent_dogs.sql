create type public.dog_sex as enum ('male', 'female');

create table public.parent_dogs (
  id uuid primary key default gen_random_uuid(),
  kennel_id uuid not null references public.organisations (id) on delete cascade,
  breed_id uuid references public.breeds (id),
  registered_name text not null,
  call_name text,
  sex public.dog_sex not null,
  date_of_birth date,
  color text,
  pedigree_number text,
  microchip_number text,
  description text,
  profile_image_url text,
  health_tests jsonb not null default '[]'::jsonb,
  titles text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_parent_dogs_updated_at
  before update on public.parent_dogs
  for each row execute function public.set_updated_at();

alter table public.parent_dogs enable row level security;

create policy "public reads parent dogs of public approved kennels"
  on public.parent_dogs for select
  to anon, authenticated
  using (
    is_active
    and exists (
      select 1 from public.organisations o
      where o.id = kennel_id and o.verification_status = 'approved' and o.is_public
    )
  );

create policy "owners manage their kennel's parent dogs"
  on public.parent_dogs for all
  to authenticated
  using (public.owns_org(kennel_id))
  with check (public.owns_org(kennel_id));

create policy "admins manage all parent dogs"
  on public.parent_dogs for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
