-- Stage J continued: applies enforce_rate_limit() (20260101008200) to the three highest-value
-- RPC-based abuse vectors the trigger-based migration couldn't reach (a BEFORE INSERT trigger only
-- protects direct table inserts, not calls that go through a SECURITY DEFINER RPC first) --
-- transport draft creation, transport amendment requests, and organisation invitations. Each
-- function body is otherwise byte-identical to its last version; only the rate-limit call is new.

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

  perform public.enforce_rate_limit('transport_draft_creation', 100, interval '1 hour');

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

create or replace function public.request_transport_amendment(
  p_transport_request_id uuid,
  p_field_name text,
  p_new_value text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester uuid := auth.uid();
  v_status public.transport_status;
  v_old_value text;
  v_amendment_id uuid;
begin
  if v_requester is null then
    raise exception 'must be authenticated' using errcode = 'P0001';
  end if;

  perform public.enforce_rate_limit('transport_amendment_request', 20, interval '1 hour');

  select status into v_status
  from public.transport_requests
  where id = p_transport_request_id and requester_profile_id = v_requester;

  if not found then
    raise exception 'only the requester of this transport request can propose an amendment to it'
      using errcode = 'P0001';
  end if;

  if v_status = 'draft' then
    raise exception 'a draft request can be edited directly — amendments are only for a request that has already been submitted'
      using errcode = 'P0001';
  end if;

  if v_status in ('completed', 'rejected', 'cancelled_by_customer', 'cancelled_by_operations') then
    raise exception 'this request is in a final state (%) and can no longer be amended', v_status
      using errcode = 'P0001';
  end if;

  if p_field_name not in (
    'pickup_city', 'pickup_area_approx', 'pickup_address_exact',
    'destination_city', 'destination_area_approx', 'destination_address_exact',
    'earliest_date', 'latest_date',
    'release_authorized_by', 'receive_authorized_by'
  ) then
    raise exception 'field % cannot be amended through this workflow', p_field_name
      using errcode = 'P0001';
  end if;

  execute format('select %I::text from public.transport_requests where id = $1', p_field_name)
    into v_old_value using p_transport_request_id;

  insert into public.transport_request_amendments (
    transport_request_id, requested_by, field_name, old_value, new_value
  ) values (
    p_transport_request_id, v_requester, p_field_name, v_old_value, p_new_value
  )
  returning id into v_amendment_id;

  return v_amendment_id;
end;
$$;

create or replace function public.invite_org_member(
  p_org_id uuid,
  p_email text,
  p_role public.org_member_role
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation_id uuid;
begin
  if not public.can_manage_org_members(p_org_id) then
    raise exception 'you do not have permission to invite members to this organisation' using errcode = 'P0001';
  end if;
  if p_role in ('owner', 'administrator') and not public.owns_org(p_org_id) then
    raise exception 'only the organisation''s owner can invite an owner or administrator' using errcode = 'P0001';
  end if;

  perform public.enforce_rate_limit('org_invitation', 100, interval '1 hour');

  insert into public.organisation_invitations (org_id, invited_email, invited_role, invited_by)
  values (p_org_id, lower(p_email), p_role, auth.uid())
  returning id into v_invitation_id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'org_invitation.created', 'organisation_invitations', v_invitation_id,
    null, jsonb_build_object('org_id', p_org_id, 'role', p_role)
  );

  return v_invitation_id;
end;
$$;
