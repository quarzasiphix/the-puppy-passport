create type public.reservation_status as enum (
  'awaiting_buyer', 'awaiting_breeder', 'confirmed', 'cancelled', 'completed'
);
create type public.deposit_status as enum ('not_required', 'pending', 'paid');
create type public.agreement_status as enum ('not_sent', 'sent', 'signed');

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals (id),
  litter_id uuid references public.litters (id),
  buyer_id uuid not null references public.profiles (id),
  organization_id uuid not null references public.organisations (id),
  application_id uuid not null unique references public.buyer_applications (id),
  status public.reservation_status not null default 'awaiting_breeder',
  agreed_price numeric(10, 2),
  currency text default 'PLN',
  deposit_amount numeric(10, 2),
  deposit_status public.deposit_status not null default 'not_required',
  agreement_status public.agreement_status not null default 'not_sent',
  planned_collection_date date,
  collection_method public.collection_method,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_reservations_updated_at
  before update on public.reservations
  for each row execute function public.set_updated_at();

alter table public.reservations enable row level security;

create policy "buyers view their own reservations"
  on public.reservations for select
  to authenticated
  using (buyer_id = (select auth.uid()));

create policy "org owners view their organization's reservations"
  on public.reservations for select
  to authenticated
  using (public.owns_org(organization_id));

-- Reservations can only ever be created by the owning breeder/admin, and only from an
-- application that has actually been approved for that same animal — "Create reservations only
-- after an application is approved" is enforced here, not just hidden in the UI.
create policy "org owners create reservations from approved applications"
  on public.reservations for insert
  to authenticated
  with check (
    public.owns_org(organization_id)
    and exists (
      select 1 from public.buyer_applications ba
      where ba.id = application_id
        and ba.animal_id = reservations.animal_id
        and ba.status = 'approved'
    )
  );

create policy "org owners update their organization's reservations"
  on public.reservations for update
  to authenticated
  using (public.owns_org(organization_id))
  with check (public.owns_org(organization_id));

create policy "admins manage all reservations"
  on public.reservations for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
