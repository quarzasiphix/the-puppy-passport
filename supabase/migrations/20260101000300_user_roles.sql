-- user_roles: additive roles. A profile can hold several rows at once (e.g. customer + breeder +
-- later operations). "Do not store the entire permission model in one profile role column."

create type public.platform_role as enum (
  'customer',
  'buyer',
  'animal_owner',
  'breeder',
  'foundation_member',
  'shelter_member',
  'operations',
  'driver',
  'moderator',
  'admin'
);

create type public.role_status as enum ('pending', 'active', 'suspended', 'rejected');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.platform_role not null,
  status public.role_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create policy "users view their own roles"
  on public.user_roles for select
  to authenticated
  using (user_id = (select auth.uid()));

-- customer / buyer / animal_owner are unrestricted baseline capabilities and activate
-- immediately. breeder / foundation_member / shelter_member / operations are self-*requestable*
-- but always start pending — approval happens through user_verifications, never here. driver,
-- moderator and admin can never be self-inserted at all (admin-only, see role_helpers.sql
-- policies and the acceptance criterion "admin role cannot be self-assigned").
create policy "users self-apply for unrestricted or pending roles"
  on public.user_roles for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      (role in ('customer', 'buyer', 'animal_owner') and status = 'active')
      or (role in ('breeder', 'foundation_member', 'shelter_member', 'operations') and status = 'pending')
    )
  );
