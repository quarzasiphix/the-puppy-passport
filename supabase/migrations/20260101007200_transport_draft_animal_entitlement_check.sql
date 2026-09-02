-- Phase 3/4 (transport-domain hardening): create_transport_draft() (20260101006700) links an
-- arbitrary animal_id to the new request, on both the mirrored transport_requests.animal_id column
-- and every transport_request_animals row, with no check that the caller has any legitimate
-- connection to that animal. Confirmed exploitable, not just theoretical:
-- listTransportRequestsForKennel() (src/lib/queries/transport.ts) shows an organisation *every*
-- transport request whose linked animal belongs to them, regardless of who created the request — a
-- customer who merely knows (or enumerates) a real animal's uuid could attach it to their own
-- request and have it appear on an unrelated breeder/foundation's dashboard as if it were genuinely
-- theirs.
--
-- The correct rule is not "must own the animal" — a buyer legitimately requests transport for a
-- breeder's puppy they've purchased, an adopter for a foundation's animal they've been approved
-- for, matching this ADR's own "sender != owner" scenario. It's "must have some real, database-
-- backed connection to it": direct ownership, organisation membership, or an existing
-- application/reservation naming them as the buyer for that specific animal.
create or replace function public.can_reference_animal_for_transport(p_animal_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.animals a
    where a.id = p_animal_id
      and (
        a.owner_profile_id = auth.uid()
        or (a.organization_id is not null and public.is_org_member(a.organization_id))
      )
  )
  or exists (
    select 1 from public.buyer_applications ba
    where ba.animal_id = p_animal_id and ba.buyer_id = auth.uid()
  )
  or exists (
    select 1 from public.reservations r
    where r.animal_id = p_animal_id and r.buyer_id = auth.uid()
  )
  or public.is_ops_staff();
$$;

create or replace function public.create_transport_draft(
  p_request jsonb,
  p_animals jsonb default '[]'::jsonb,
  p_parties jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester uuid := auth.uid();
  v_request_id uuid;
  v_merged jsonb;
  v_primary_animal jsonb;
  v_animal jsonb;
  v_party jsonb;
  v_position integer := 0;
  v_role public.transport_party_role;
  v_profile_id uuid;
  v_org_id uuid;
  v_animal_id uuid;
begin
  if v_requester is null then
    raise exception 'must be authenticated to create a transport draft' using errcode = 'P0001';
  end if;

  v_merged := jsonb_build_object(
    'request_purpose', 'other',
    'ownership_changing', false,
    'microchip_known', true,
    'flexible_dates', false,
    'delivery_type', 'meeting_point',
    'number_of_animals', greatest(1, jsonb_array_length(coalesce(p_animals, '[]'::jsonb))),
    'compliance_review_result', 'basic_review_required',
    'requested_service_type', 'recommend_best',
    'confirmed_accurate', false,
    'confirmed_authority', false,
    'confirmed_will_provide_documents', false,
    'confirmed_understands_review', false,
    'confirmed_understands_publication_not_confirmation', false,
    'visibility', 'private'
  ) || coalesce(p_request, '{}'::jsonb);

  v_primary_animal := coalesce(p_animals -> 0, '{}'::jsonb);

  -- Checked once here for the primary animal (mirrored onto transport_requests.animal_id below)
  -- and again per element in the animals loop further down — every animal_id anywhere in this call
  -- must pass the same entitlement check, not just the first.
  v_animal_id := nullif(v_primary_animal ->> 'animal_id', '')::uuid;
  if v_animal_id is not null and not public.can_reference_animal_for_transport(v_animal_id) then
    raise exception 'you do not have a registered connection to this animal (ownership, organisation membership, or an application/reservation for it)'
      using errcode = 'P0001';
  end if;

  insert into public.transport_requests (
    requester_profile_id, request_purpose, ownership_changing,
    animal_id, animal_name, breed_free_text, sex, approximate_age, weight_kg, size_category,
    microchip_number, microchip_known, passport_available, vaccination_status,
    rabies_vaccination_date, health_condition, medication, behavioural_notes,
    anxiety_or_aggression_notes, can_travel_with_others, crate_requirements,
    pickup_country, pickup_city, pickup_area_approx, pickup_address_exact,
    destination_country, destination_city, destination_area_approx, destination_address_exact,
    earliest_date, latest_date, flexible_dates, delivery_type, number_of_animals,
    is_domestic, is_sale, is_ownership_change, travelling_with_owner, owner_travel_within_5_days,
    sender_is_registered_breeder, sender_is_verified_org, origin_registered_or_approved,
    has_passport, has_microchip, rabies_valid, health_certificate_required,
    traces_notification_required, destination_treatment_required, medically_fit_for_transport,
    compliance_review_result, requested_service_type,
    confirmed_accurate, confirmed_authority, confirmed_will_provide_documents,
    confirmed_understands_review, confirmed_understands_publication_not_confirmation,
    status, visibility
  ) values (
    v_requester,
    (v_merged ->> 'request_purpose')::public.transport_request_purpose,
    (v_merged ->> 'ownership_changing')::boolean,
    v_animal_id,
    v_primary_animal ->> 'name',
    v_primary_animal ->> 'breed_free_text',
    (v_primary_animal ->> 'sex')::public.dog_sex,
    v_primary_animal ->> 'approximate_age',
    (v_primary_animal ->> 'weight_kg')::numeric,
    (v_primary_animal ->> 'size_category')::public.size_category,
    v_primary_animal ->> 'microchip_number',
    coalesce((v_primary_animal ->> 'microchip_known')::boolean, true),
    (v_primary_animal ->> 'passport_available')::boolean,
    v_primary_animal ->> 'vaccination_status',
    (v_primary_animal ->> 'rabies_vaccination_date')::date,
    v_primary_animal ->> 'health_condition',
    v_primary_animal ->> 'medication',
    v_primary_animal ->> 'behavioural_notes',
    v_primary_animal ->> 'anxiety_or_aggression_notes',
    (v_primary_animal ->> 'can_travel_with_others')::boolean,
    v_primary_animal ->> 'crate_requirements',
    v_merged ->> 'pickup_country', v_merged ->> 'pickup_city',
    v_merged ->> 'pickup_area_approx', v_merged ->> 'pickup_address_exact',
    v_merged ->> 'destination_country', v_merged ->> 'destination_city',
    v_merged ->> 'destination_area_approx', v_merged ->> 'destination_address_exact',
    (v_merged ->> 'earliest_date')::date, (v_merged ->> 'latest_date')::date,
    (v_merged ->> 'flexible_dates')::boolean,
    (v_merged ->> 'delivery_type')::public.transport_delivery_type,
    (v_merged ->> 'number_of_animals')::integer,
    (v_merged ->> 'is_domestic')::boolean, (v_merged ->> 'is_sale')::boolean,
    (v_merged ->> 'is_ownership_change')::boolean, (v_merged ->> 'travelling_with_owner')::boolean,
    (v_merged ->> 'owner_travel_within_5_days')::boolean,
    (v_merged ->> 'sender_is_registered_breeder')::boolean,
    (v_merged ->> 'sender_is_verified_org')::boolean,
    (v_merged ->> 'origin_registered_or_approved')::boolean,
    (v_merged ->> 'has_passport')::boolean, (v_merged ->> 'has_microchip')::boolean,
    (v_merged ->> 'rabies_valid')::boolean, (v_merged ->> 'health_certificate_required')::boolean,
    (v_merged ->> 'traces_notification_required')::boolean,
    (v_merged ->> 'destination_treatment_required')::boolean,
    (v_merged ->> 'medically_fit_for_transport')::boolean,
    (v_merged ->> 'compliance_review_result')::public.transport_compliance_result,
    (v_merged ->> 'requested_service_type')::public.transport_service_type,
    (v_merged ->> 'confirmed_accurate')::boolean, (v_merged ->> 'confirmed_authority')::boolean,
    (v_merged ->> 'confirmed_will_provide_documents')::boolean,
    (v_merged ->> 'confirmed_understands_review')::boolean,
    (v_merged ->> 'confirmed_understands_publication_not_confirmation')::boolean,
    'draft', (v_merged ->> 'visibility')::public.transport_visibility
  )
  returning id into v_request_id;

  for v_animal in select * from jsonb_array_elements(coalesce(p_animals, '[]'::jsonb))
  loop
    v_position := v_position + 1;
    v_animal_id := nullif(v_animal ->> 'animal_id', '')::uuid;
    if v_animal_id is not null and not public.can_reference_animal_for_transport(v_animal_id) then
      raise exception 'you do not have a registered connection to animal % (ownership, organisation membership, or an application/reservation for it)', v_animal_id
        using errcode = 'P0001';
    end if;

    insert into public.transport_request_animals (
      transport_request_id, position, animal_id, name, breed_free_text, sex, approximate_age,
      weight_kg, size_category, microchip_number, microchip_known, passport_available,
      vaccination_status, rabies_vaccination_date, health_condition, medication,
      behavioural_notes, anxiety_or_aggression_notes, can_travel_with_others, crate_requirements
    ) values (
      v_request_id, v_position, v_animal_id,
      v_animal ->> 'name', v_animal ->> 'breed_free_text', (v_animal ->> 'sex')::public.dog_sex,
      v_animal ->> 'approximate_age', (v_animal ->> 'weight_kg')::numeric,
      (v_animal ->> 'size_category')::public.size_category, v_animal ->> 'microchip_number',
      coalesce((v_animal ->> 'microchip_known')::boolean, true),
      (v_animal ->> 'passport_available')::boolean, v_animal ->> 'vaccination_status',
      (v_animal ->> 'rabies_vaccination_date')::date, v_animal ->> 'health_condition',
      v_animal ->> 'medication', v_animal ->> 'behavioural_notes',
      v_animal ->> 'anxiety_or_aggression_notes', (v_animal ->> 'can_travel_with_others')::boolean,
      v_animal ->> 'crate_requirements'
    );
  end loop;

  insert into public.transport_parties (transport_request_id, party_role, profile_id)
  values (v_request_id, 'requester', v_requester);

  for v_party in select * from jsonb_array_elements(coalesce(p_parties, '[]'::jsonb))
  loop
    v_role := (v_party ->> 'party_role')::public.transport_party_role;
    if v_role = 'requester' then
      raise exception 'the requester party row is added automatically and must not be passed in p_parties'
        using errcode = 'P0001';
    end if;

    v_profile_id := nullif(v_party ->> 'profile_id', '')::uuid;
    v_org_id := nullif(v_party ->> 'organisation_id', '')::uuid;

    if v_role in ('legal_owner', 'sender', 'payer') and v_profile_id is not null and v_profile_id <> v_requester then
      raise exception 'only the requester themselves can be named as % via a profile id — naming another Anemalo user in this role requires their own action, not a claim by this requester', v_role
        using errcode = 'P0001';
    end if;

    insert into public.transport_parties (
      transport_request_id, party_role, profile_id, organisation_id,
      external_name, external_phone, external_email
    ) values (
      v_request_id, v_role, v_profile_id, v_org_id,
      v_party ->> 'external_name', v_party ->> 'external_phone', v_party ->> 'external_email'
    );
  end loop;

  return v_request_id;
end;
$$;

revoke all on function public.create_transport_draft(jsonb, jsonb, jsonb) from public;
grant execute on function public.create_transport_draft(jsonb, jsonb, jsonb) to authenticated;
