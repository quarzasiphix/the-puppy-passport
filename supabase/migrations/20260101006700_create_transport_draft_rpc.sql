-- docs/adr/TRANSPORT_DATA_MODEL.md, Phase 4/5: the single shared creation path for every transport
-- entry point (standalone form, marketplace purchase, foundation adoption, private rehoming).
-- Replaces ad hoc multi-step client-side inserts (transport_requests, then separately
-- transport_request_animals, then separately transport_parties — three round trips with no
-- atomicity: a network failure between them today would leave an orphan transport_requests row with
-- no animals/parties) with one transactional call. Always creates in 'draft' status regardless of
-- what the caller passes — creating a draft must stay separate from submitting, accepting a
-- quotation, scheduling, or confirming a driver/payment (see the ADR's Phase 5 section).
--
-- p_request: a curated jsonb of transport_requests columns (route/compliance/service/declaration
-- fields) — absent keys fall back to the same defaults the table itself already has, applied here
-- explicitly rather than left to `jsonb_populate_record`'s "absent key becomes NULL" behaviour,
-- since that would violate this table's NOT NULL columns. requester_profile_id and status are never
-- read from p_request — always server-controlled.
-- p_animals: a jsonb array, one object per animal (registered via animal_id, or an inline snapshot
-- for one that isn't). Element 0 is also mirrored into transport_requests' own legacy inline
-- animal_* columns so every existing page that reads r.animal_name directly keeps working unchanged
-- for requests created this way, exactly as it does for pre-existing rows.
-- p_parties: a jsonb array of {party_role, profile_id, organisation_id, external_name,
-- external_phone, external_email}. The requester's own 'requester' party row is always added
-- automatically and must not be passed in p_parties (rejected if present, since it always exactly
-- mirrors the caller's own auth.uid() and the RPC provides that once, not per-caller-supplied
-- value). For legal_owner/sender/payer with a bare profile_id (not organisation_id), that profile_id
-- must equal the caller's own id — a customer cannot forge another Anemalo user as already having
-- agreed to own/send/pay for this transport (see the ADR's "Explicit non-goals" section for why
-- recipient/organisation-based parties aren't restricted the same way).
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
begin
  if v_requester is null then
    raise exception 'must be authenticated to create a transport draft' using errcode = 'P0001';
  end if;

  -- Column defaults spelt out explicitly (matches this table's own DEFAULTs) so an absent key in
  -- p_request behaves exactly like never mentioning that column, not like explicitly setting it to
  -- NULL, which would violate the NOT NULL columns below.
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
    nullif(v_primary_animal ->> 'animal_id', '')::uuid,
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
    insert into public.transport_request_animals (
      transport_request_id, position, animal_id, name, breed_free_text, sex, approximate_age,
      weight_kg, size_category, microchip_number, microchip_known, passport_available,
      vaccination_status, rabies_vaccination_date, health_condition, medication,
      behavioural_notes, anxiety_or_aggression_notes, can_travel_with_others, crate_requirements
    ) values (
      v_request_id, v_position,
      nullif(v_animal ->> 'animal_id', '')::uuid,
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

  -- The requester's own party row always exists and is never taken from client input.
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

-- SECURITY DEFINER functions aren't callable by anyone by default in Postgres beyond the owner —
-- Supabase's usual convention (matching every other RPC in this schema, e.g.
-- start_application_conversation) is an explicit grant to authenticated only, never anon (a
-- transport draft always belongs to a real signed-in requester).
revoke all on function public.create_transport_draft(jsonb, jsonb, jsonb) from public;
grant execute on function public.create_transport_draft(jsonb, jsonb, jsonb) to authenticated;
