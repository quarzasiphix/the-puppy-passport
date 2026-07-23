-- docs/adr/TRANSPORT_DATA_MODEL.md: transport_requests.number_of_animals was always a plain integer
-- the customer typed in, with zero linkage to which additional animals those actually are — a
-- request for 3 dogs could only ever reference 1 real/snapshot animal record via animal_id. This
-- table gives "more than one animal" an explicit, queryable, safe representation without touching
-- the existing single-animal inline columns on transport_requests (those stay exactly as they are —
-- the booking-time snapshot of the *first* animal, read by every existing page today).
--
-- Same "registered or not" shape as transport_requests itself: animal_id links to a real
-- public.animals row when one exists, but every field is also duplicated as a snapshot column here
-- so this row keeps meaning what it meant at booking time even if the linked animal record later
-- changes or the row's owner deletes their account (animal_id would go null via the FK's own
-- behaviour on delete, the snapshot survives — this is exactly why snapshot columns exist here
-- rather than a join-only model, see the ADR's "Immutable historical..." row).
create table public.transport_request_animals (
  id uuid primary key default gen_random_uuid(),
  transport_request_id uuid not null references public.transport_requests (id) on delete cascade,
  position integer not null default 1,
  animal_id uuid references public.animals (id) on delete set null,
  name text,
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
  created_at timestamptz not null default now(),
  unique (transport_request_id, position)
);

alter table public.transport_request_animals enable row level security;

-- Same shape as transport_parties: the requester manages animals on their own request, ops manage
-- everything. Additionally, an org that owns the linked animal_id can read the row (parity with the
-- pre-existing listTransportRequestsForKennel() capability — a kennel could already see, via
-- animal_id, that one of their sold puppies is on a transport request; that must not regress once a
-- request can carry more than one animal).
create policy "requesters manage animals on their own request"
  on public.transport_request_animals for all
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

create policy "org owners view their animals linked from a transport request"
  on public.transport_request_animals for select
  to authenticated
  using (
    animal_id is not null
    and exists (
      select 1 from public.animals a
      where a.id = animal_id
        and (a.owner_profile_id = (select auth.uid()) or (a.organization_id is not null and public.owns_org(a.organization_id)))
    )
  );

create policy "ops staff manage all transport request animals"
  on public.transport_request_animals for all
  to authenticated
  using (public.is_ops_staff())
  with check (public.is_ops_staff());

-- Lossless 1:1 backfill: every existing transport_requests row already has exactly one animal's
-- worth of information inline (animal_id may be null for an unregistered animal, which is fine —
-- the snapshot columns still carry whatever the customer entered). This creates position 1 for
-- every existing request from data that's already there — nothing invented, nothing guessed.
insert into public.transport_request_animals (
  transport_request_id, position, animal_id, name, breed_free_text, sex, approximate_age,
  weight_kg, size_category, microchip_number, microchip_known, passport_available,
  vaccination_status, rabies_vaccination_date, health_condition, medication, behavioural_notes,
  anxiety_or_aggression_notes, can_travel_with_others, crate_requirements
)
select
  id, 1, animal_id, animal_name, breed_free_text, sex, approximate_age,
  weight_kg, size_category, microchip_number, microchip_known, passport_available,
  vaccination_status, rabies_vaccination_date, health_condition, medication, behavioural_notes,
  anxiety_or_aggression_notes, can_travel_with_others, crate_requirements
from public.transport_requests;
