-- private_addresses holds exact operational addresses separately from public profile/organisation
-- data so they can never leak through a public-facing query — "private addresses must not be
-- publicly readable" is enforced by simply never granting anon/broad-authenticated select here,
-- not by relying on the frontend to hide a field.

create table public.private_addresses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.profiles (id) on delete cascade,
  owner_org_id uuid references public.organisations (id) on delete cascade,
  country text not null,
  postal_code text,
  city text not null,
  street text,
  building_number text,
  apartment text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  address_label text,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint private_addresses_single_owner check (
    (owner_user_id is not null and owner_org_id is null)
    or (owner_user_id is null and owner_org_id is not null)
  )
);

create trigger set_private_addresses_updated_at
  before update on public.private_addresses
  for each row execute function public.set_updated_at();

alter table public.organisations
  add constraint organisations_private_address_fk foreign key (private_address_id) references public.private_addresses (id);

alter table public.private_addresses enable row level security;

create policy "users manage their own private address"
  on public.private_addresses for all
  to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

create policy "org owners manage their organisation's private address"
  on public.private_addresses for all
  to authenticated
  using (owner_org_id is not null and public.owns_org(owner_org_id))
  with check (owner_org_id is not null and public.owns_org(owner_org_id));

create policy "admins manage all private addresses"
  on public.private_addresses for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
