create type public.litter_status as enum (
  'planned', 'born', 'applications_open', 'fully_reserved', 'completed', 'cancelled'
);

create table public.litters (
  id uuid primary key default gen_random_uuid(),
  kennel_id uuid not null references public.organisations (id) on delete cascade,
  breed_id uuid references public.breeds (id),
  code text not null,
  mother_id uuid references public.parent_dogs (id),
  father_id uuid references public.parent_dogs (id),
  birth_date date,
  expected_birth_date date,
  ready_date date,
  puppy_count integer,
  male_count integer,
  female_count integer,
  description text,
  association text,
  registration_number text,
  health_info jsonb not null default '{}'::jsonb,
  status public.litter_status not null default 'planned',
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_litters_updated_at
  before update on public.litters
  for each row execute function public.set_updated_at();

alter table public.litters enable row level security;

create policy "public reads published litters of public approved kennels"
  on public.litters for select
  to anon, authenticated
  using (
    is_published
    and exists (
      select 1 from public.organisations o
      where o.id = kennel_id and o.verification_status = 'approved' and o.is_public
    )
  );

create policy "owners manage their kennel's litters"
  on public.litters for all
  to authenticated
  using (public.owns_org(kennel_id))
  with check (public.owns_org(kennel_id));

create policy "admins manage all litters"
  on public.litters for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
