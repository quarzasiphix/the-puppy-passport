-- transport_requests is the centre of the platform: every field from the 7-step request form,
-- plus the operational fields ops staff fill in later (status, assignment, compliance result).
-- Exact pickup/destination addresses are kept in dedicated columns so RLS can withhold them from
-- everyone except the requester, the org owner and ops/admin — never exposed via the public
-- community-visible view added in the platform migration.

create type public.transport_request_purpose as enum (
  'own_dog', 'purchased_puppy', 'planned_sale', 'adoption', 'foundation_rescue',
  'relocation', 'exhibition', 'veterinary', 'other'
);

create type public.transport_delivery_type as enum ('home_delivery', 'meeting_point');

create type public.transport_compliance_result as enum (
  'basic_review_required', 'documents_missing', 'veterinary_review_required',
  'international_commercial_review', 'eligible_for_quotation', 'not_currently_eligible',
  'manually_approved'
);

create type public.transport_service_type as enum ('shared', 'individual', 'express', 'vip', 'recommend_best');

create type public.transport_visibility as enum ('private', 'community_visible');

create type public.transport_status as enum (
  'draft', 'submitted', 'initial_review', 'missing_information', 'documents_under_review',
  'quotation_prepared', 'quotation_sent', 'accepted_by_customer', 'awaiting_documents',
  'ready_for_scheduling', 'scheduled', 'driver_assigned', 'pickup_confirmed', 'animal_collected',
  'in_transport', 'rest_or_care_stop', 'approaching_destination', 'delivered',
  'handover_confirmed', 'completed',
  'rejected', 'cancelled_by_customer', 'cancelled_by_operations', 'veterinary_hold',
  'compliance_hold', 'route_postponed'
);

create sequence public.transport_request_seq;

create table public.transport_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text unique,
  requester_profile_id uuid not null references public.profiles (id),

  -- Step 1: request type
  request_purpose public.transport_request_purpose not null default 'other',
  ownership_changing boolean not null default false,

  -- Step 2: animal information (animal_id is optional — many requests won't have a full
  -- marketplace/adoption record, just this inline snapshot)
  animal_id uuid references public.animals (id),
  animal_name text,
  breed_free_text text,
  sex public.dog_sex,
  approximate_age text,
  weight_kg numeric(5, 2),
  size_category public.size_category,
  microchip_number text,
  microchip_known boolean not null default true,
  passport_available boolean,
  vaccination_status text,
  rabies_vaccination_date date,
  health_condition text,
  medication text,
  behavioural_notes text,
  anxiety_or_aggression_notes text,
  can_travel_with_others boolean,
  crate_requirements text,

  -- Step 3: parties
  current_owner_profile_id uuid references public.profiles (id),
  sender_org_id uuid references public.organisations (id),
  sender_profile_id uuid references public.profiles (id),
  recipient_profile_id uuid references public.profiles (id),
  release_authorized_by text,
  receive_authorized_by text,
  payer_profile_id uuid references public.profiles (id),

  -- Step 4: route (approximate columns are the only ones ever public)
  pickup_country text,
  pickup_city text,
  pickup_area_approx text,
  pickup_address_exact text,
  destination_country text,
  destination_city text,
  destination_area_approx text,
  destination_address_exact text,
  earliest_date date,
  latest_date date,
  flexible_dates boolean not null default false,
  delivery_type public.transport_delivery_type not null default 'meeting_point',
  number_of_animals integer not null default 1,

  -- Step 5: compliance questionnaire
  is_domestic boolean,
  is_sale boolean,
  is_ownership_change boolean,
  is_adoption boolean,
  travelling_with_owner boolean,
  owner_travel_within_5_days boolean,
  sender_is_registered_breeder boolean,
  sender_is_verified_org boolean,
  origin_registered_or_approved boolean,
  has_passport boolean,
  has_microchip boolean,
  rabies_valid boolean,
  health_certificate_required boolean,
  traces_notification_required boolean,
  destination_treatment_required boolean,
  medically_fit_for_transport boolean,
  compliance_review_result public.transport_compliance_result not null default 'basic_review_required',

  -- Step 6: service selection
  requested_service_type public.transport_service_type not null default 'recommend_best',

  -- Step 7: declarations
  confirmed_accurate boolean not null default false,
  confirmed_authority boolean not null default false,
  confirmed_will_provide_documents boolean not null default false,
  confirmed_understands_review boolean not null default false,
  confirmed_understands_publication_not_confirmation boolean not null default false,

  -- Operational
  status public.transport_status not null default 'draft',
  visibility public.transport_visibility not null default 'private',
  assigned_route_id uuid,
  assigned_vehicle_id uuid,
  assigned_driver_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_transport_requests_updated_at
  before update on public.transport_requests
  for each row execute function public.set_updated_at();

create or replace function public.set_transport_request_number()
returns trigger
language plpgsql
as $$
begin
  if new.request_number is null then
    new.request_number := 'TR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.transport_request_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger set_transport_requests_number
  before insert on public.transport_requests
  for each row execute function public.set_transport_request_number();

create table public.transport_status_history (
  id uuid primary key default gen_random_uuid(),
  transport_request_id uuid not null references public.transport_requests (id) on delete cascade,
  status public.transport_status not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references public.profiles (id),
  internal_note text,
  customer_note text,
  evidence_url text
);

alter table public.transport_requests enable row level security;
alter table public.transport_status_history enable row level security;

-- A requester sees and manages their own request. Parties named on the request (sender/recipient/
-- current owner) can also view it, but only the requester can edit it.
-- Deliberately select/insert/update only (no delete) — a submitted request can only be cancelled
-- via a status change, never deleted outright. Draft requests are the one exception; see the
-- narrower delete policy added once drafts are supported (20260101002400_animals_transport_fields.sql).
create policy "requesters view their own transport requests"
  on public.transport_requests for select
  to authenticated
  using (requester_profile_id = (select auth.uid()));

create policy "requesters create their own transport requests"
  on public.transport_requests for insert
  to authenticated
  with check (requester_profile_id = (select auth.uid()));

create policy "requesters update their own transport requests"
  on public.transport_requests for update
  to authenticated
  using (requester_profile_id = (select auth.uid()))
  with check (requester_profile_id = (select auth.uid()));

create policy "named parties view the transport request"
  on public.transport_requests for select
  to authenticated
  using (
    current_owner_profile_id = (select auth.uid())
    or sender_profile_id = (select auth.uid())
    or recipient_profile_id = (select auth.uid())
    or payer_profile_id = (select auth.uid())
    or (sender_org_id is not null and public.owns_org(sender_org_id))
  );

create policy "ops staff and admins manage all transport requests"
  on public.transport_requests for all
  to authenticated
  using (public.is_ops_staff())
  with check (public.is_ops_staff());

-- status history follows the same visibility as its parent request, but customer_note only (the
-- internal_note column still comes back over the wire for ops/admin rows since RLS is row-level
-- not column-level — the query layer is responsible for not selecting internal_note for
-- non-staff callers; see src/lib/queries/transport.ts).
create policy "request parties view their status history"
  on public.transport_status_history for select
  to authenticated
  using (
    exists (
      select 1 from public.transport_requests tr
      where tr.id = transport_request_id
        and (
          tr.requester_profile_id = (select auth.uid())
          or tr.current_owner_profile_id = (select auth.uid())
          or tr.sender_profile_id = (select auth.uid())
          or tr.recipient_profile_id = (select auth.uid())
        )
    )
  );

create policy "ops staff manage all status history"
  on public.transport_status_history for all
  to authenticated
  using (public.is_ops_staff())
  with check (public.is_ops_staff());

-- The system (via a server action running as the authenticated requester) always writes the
-- first history row alongside the request itself, so requesters need insert rights for their own
-- request's history too.
create policy "requesters log status on their own request"
  on public.transport_status_history for insert
  to authenticated
  with check (
    exists (
      select 1 from public.transport_requests tr
      where tr.id = transport_request_id and tr.requester_profile_id = (select auth.uid())
    )
  );
