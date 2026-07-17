create table public.compliance_reviews (
  id uuid primary key default gen_random_uuid(),
  transport_request_id uuid not null references public.transport_requests (id) on delete cascade,
  reviewer_profile_id uuid references public.profiles (id),
  authorisation_appropriate boolean,
  vehicle_appropriate boolean,
  animal_fit boolean,
  documents_checked boolean,
  route_planned_ok boolean,
  contingency_contact_available boolean,
  pickup_handover_confirmed boolean,
  notes text,
  reviewed_at timestamptz not null default now()
);

create type public.handover_type as enum ('pickup', 'delivery');

create table public.handover_protocols (
  id uuid primary key default gen_random_uuid(),
  transport_request_id uuid not null references public.transport_requests (id) on delete cascade,
  handover_type public.handover_type not null,
  confirmed_by uuid references public.profiles (id),
  confirmed_at timestamptz not null default now(),
  recipient_name text,
  signature_note text,
  photo_url text,
  notes text
);

alter table public.compliance_reviews enable row level security;
alter table public.handover_protocols enable row level security;

-- Internal operational records — visible to the requester (read-only, so they can see the
-- request has been reviewed) and fully managed by ops/admin.
create policy "requesters view compliance reviews on their own request"
  on public.compliance_reviews for select
  to authenticated
  using (
    exists (
      select 1 from public.transport_requests tr
      where tr.id = transport_request_id and tr.requester_profile_id = (select auth.uid())
    )
  );

create policy "ops staff manage all compliance reviews"
  on public.compliance_reviews for all
  to authenticated
  using (public.is_ops_staff())
  with check (public.is_ops_staff());

create policy "requesters view handover protocols on their own request"
  on public.handover_protocols for select
  to authenticated
  using (
    exists (
      select 1 from public.transport_requests tr
      where tr.id = transport_request_id and tr.requester_profile_id = (select auth.uid())
    )
  );

create policy "ops staff manage all handover protocols"
  on public.handover_protocols for all
  to authenticated
  using (public.is_ops_staff())
  with check (public.is_ops_staff());
