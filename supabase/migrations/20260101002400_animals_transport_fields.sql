-- Extends the existing `animals` table (already generalized across breeder puppies / adoption /
-- private rehoming / not_listed) with the fields a transport request needs from a reusable animal
-- record, rather than creating a second near-duplicate animals table. Sensitive fields
-- (medication, behavioural/anxiety/aggression notes) are already covered by the table's existing
-- "not public by default" shape — is_published stays false unless the owner explicitly publishes
-- a *listing*, and these specific columns are never selected by the public-facing queries anyway.

alter table public.animals
  add column mixed_breed boolean not null default false,
  add column weight_unit text not null default 'kg',
  add column approximate_age_flag boolean not null default false,
  add column passport_country text,
  add column rabies_vaccination_status text,
  add column rabies_vaccination_date date,
  add column medication text,
  add column behavioural_notes text,
  add column anxiety_notes text,
  add column aggression_notes text,
  add column compatibility_notes text,
  add column transport_crate_requirements text;

-- transport_parties separates who's actually involved in a transport request — legal owner,
-- requester, sender, recipient, payer, pickup contact, delivery contact may all be different
-- people, and not everyone involved is necessarily a Anemalo user.
create type public.transport_party_role as enum (
  'legal_owner', 'requester', 'sender', 'recipient', 'payer', 'pickup_contact', 'delivery_contact'
);

create table public.transport_parties (
  id uuid primary key default gen_random_uuid(),
  transport_request_id uuid not null references public.transport_requests (id) on delete cascade,
  party_role public.transport_party_role not null,
  profile_id uuid references public.profiles (id),
  organisation_id uuid references public.organisations (id),
  -- External (non-Anemalo-user) contact — kept private, never selectable by anyone except the
  -- request owner and ops/admin (same policy shape as the rest of this table).
  external_name text,
  external_phone text,
  external_email text,
  created_at timestamptz not null default now(),
  constraint transport_parties_single_reference check (
    (num_nonnulls(profile_id, organisation_id, external_name) <= 1)
  )
);

alter table public.transport_parties enable row level security;

create policy "requesters manage parties on their own request"
  on public.transport_parties for all
  to authenticated
  using (
    exists (
      select 1 from public.transport_requests tr
      where tr.id = transport_request_id and tr.requester_profile_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.transport_requests tr
      where tr.id = transport_request_id and tr.requester_profile_id = (select auth.uid())
    )
  );

create policy "named profile parties view their own party row"
  on public.transport_parties for select
  to authenticated
  using (profile_id = (select auth.uid()));

create policy "ops staff manage all transport parties"
  on public.transport_parties for all
  to authenticated
  using (public.is_ops_staff())
  with check (public.is_ops_staff());

-- Requesters may delete their own draft requests outright (a submitted request can only be
-- cancelled, via a status change, never deleted — see transport_requests policies).
create policy "requesters delete their own draft requests"
  on public.transport_requests for delete
  to authenticated
  using (requester_profile_id = (select auth.uid()) and status = 'draft');
