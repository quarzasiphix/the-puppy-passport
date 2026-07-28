-- docs/TRANSACTIONAL_WORKFLOW_BOUNDARIES_AUDIT.md left createTransportRequest as the one
-- deliberately-deferred multi-write client function (src/lib/queries/transport.ts): a plain
-- .insert() into transport_requests followed by a separate .insert() into
-- transport_status_history, with no transaction -- if the second write fails, a live request row
-- is left with no initial history entry.
--
-- Investigating the real fix surfaced a second, much more severe bug that was never previously
-- documented: the public standalone transport-request form (_public.transport.request.tsx) always
-- auto-saves a draft first (assigning it a real id), then on submission calls
-- buildTransportRequestPayload(..., "submitted", draftId, ...) -- which includes that SAME id in
-- the payload -- and createTransportRequest() does a plain .insert(payload). Postgres rejects this
-- outright: inserting a row with an id that already belongs to the still-existing draft row
-- violates transport_requests_pkey. Confirmed empirically against the live database (not assumed):
-- every submission of a previously-saved draft fails with a raw 23505 duplicate-key error, caught
-- by the form's generic error toast. This is a real, reachable, previously-undiscovered bug in a
-- commercially critical, customer-facing flow -- not hypothetical.
--
-- Fixed by converting createTransportRequest into a single atomic RPC that both fixes the
-- atomicity gap and the duplicate-key bug at once: when p_draft_id is given, it UPDATEs the
-- existing draft row in place (transitioning status draft -> submitted) instead of attempting a
-- second insert with the same id; when omitted, it INSERTs fresh. Both branches write the initial
-- transport_status_history row in the same transaction.
--
-- The draft -> submitted UPDATE path is safe against this schema's existing triggers without any
-- special-casing: prevent_customer_snapshot_changes_after_submission() exempts "old.status =
-- 'draft'" unconditionally (matching every other existing draft-editing flow), and
-- prevent_non_staff_operational_field_changes() explicitly allows the "old.status = 'draft' and
-- new.status = 'submitted'" transition for a non-staff caller -- both already correctly designed
-- for exactly this transition, confirmed by reading their live definitions before writing this
-- function, not assumed.
--
-- This RPC intentionally does not use the transport_request_animals/transport_parties normalized
-- tables create_transport_draft() uses -- the standalone public form only ever writes the inline
-- legacy columns on transport_requests directly (matching its current real behaviour exactly), and
-- unifying the two flows is a separate, larger, out-of-scope refactor.
create or replace function public.submit_transport_request(p_request jsonb, p_draft_id uuid default null)
returns table (id uuid, request_number text, status public.transport_status)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester uuid := auth.uid();
  v_id uuid;
  v_request_number text;
  v_status public.transport_status;
begin
  if v_requester is null then
    raise exception 'must be authenticated to submit a transport request' using errcode = 'P0001';
  end if;

  if p_draft_id is not null then
    update public.transport_requests t
    set
      request_purpose = coalesce((p_request ->> 'request_purpose')::public.transport_request_purpose, t.request_purpose),
      ownership_changing = coalesce((p_request ->> 'ownership_changing')::boolean, t.ownership_changing),
      animal_id = nullif(p_request ->> 'animal_id', '')::uuid,
      sender_org_id = nullif(p_request ->> 'sender_org_id', '')::uuid,
      animal_name = p_request ->> 'animal_name',
      breed_free_text = p_request ->> 'breed_free_text',
      sex = (p_request ->> 'sex')::public.dog_sex,
      approximate_age = p_request ->> 'approximate_age',
      weight_kg = (p_request ->> 'weight_kg')::numeric,
      size_category = (p_request ->> 'size_category')::public.size_category,
      microchip_number = p_request ->> 'microchip_number',
      microchip_known = coalesce((p_request ->> 'microchip_known')::boolean, true),
      passport_available = (p_request ->> 'passport_available')::boolean,
      vaccination_status = p_request ->> 'vaccination_status',
      rabies_vaccination_date = (p_request ->> 'rabies_vaccination_date')::date,
      health_condition = p_request ->> 'health_condition',
      medication = p_request ->> 'medication',
      behavioural_notes = p_request ->> 'behavioural_notes',
      anxiety_or_aggression_notes = p_request ->> 'anxiety_or_aggression_notes',
      can_travel_with_others = (p_request ->> 'can_travel_with_others')::boolean,
      crate_requirements = p_request ->> 'crate_requirements',
      current_owner_profile_id = nullif(p_request ->> 'current_owner_profile_id', '')::uuid,
      release_authorized_by = p_request ->> 'release_authorized_by',
      receive_authorized_by = p_request ->> 'receive_authorized_by',
      pickup_country = p_request ->> 'pickup_country',
      pickup_city = p_request ->> 'pickup_city',
      pickup_area_approx = p_request ->> 'pickup_area_approx',
      pickup_address_exact = p_request ->> 'pickup_address_exact',
      destination_country = p_request ->> 'destination_country',
      destination_city = p_request ->> 'destination_city',
      destination_area_approx = p_request ->> 'destination_area_approx',
      destination_address_exact = p_request ->> 'destination_address_exact',
      earliest_date = (p_request ->> 'earliest_date')::date,
      latest_date = (p_request ->> 'latest_date')::date,
      flexible_dates = coalesce((p_request ->> 'flexible_dates')::boolean, t.flexible_dates),
      delivery_type = coalesce((p_request ->> 'delivery_type')::public.transport_delivery_type, t.delivery_type),
      number_of_animals = coalesce((p_request ->> 'number_of_animals')::integer, t.number_of_animals),
      is_domestic = (p_request ->> 'is_domestic')::boolean,
      is_sale = (p_request ->> 'is_sale')::boolean,
      is_ownership_change = (p_request ->> 'is_ownership_change')::boolean,
      is_adoption = (p_request ->> 'is_adoption')::boolean,
      travelling_with_owner = (p_request ->> 'travelling_with_owner')::boolean,
      owner_travel_within_5_days = (p_request ->> 'owner_travel_within_5_days')::boolean,
      sender_is_registered_breeder = (p_request ->> 'sender_is_registered_breeder')::boolean,
      sender_is_verified_org = (p_request ->> 'sender_is_verified_org')::boolean,
      origin_registered_or_approved = (p_request ->> 'origin_registered_or_approved')::boolean,
      has_passport = (p_request ->> 'has_passport')::boolean,
      has_microchip = (p_request ->> 'has_microchip')::boolean,
      rabies_valid = (p_request ->> 'rabies_valid')::boolean,
      health_certificate_required = (p_request ->> 'health_certificate_required')::boolean,
      traces_notification_required = (p_request ->> 'traces_notification_required')::boolean,
      destination_treatment_required = (p_request ->> 'destination_treatment_required')::boolean,
      medically_fit_for_transport = (p_request ->> 'medically_fit_for_transport')::boolean,
      compliance_review_result = coalesce((p_request ->> 'compliance_review_result')::public.transport_compliance_result, t.compliance_review_result),
      requested_service_type = coalesce((p_request ->> 'requested_service_type')::public.transport_service_type, t.requested_service_type),
      confirmed_accurate = coalesce((p_request ->> 'confirmed_accurate')::boolean, t.confirmed_accurate),
      confirmed_authority = coalesce((p_request ->> 'confirmed_authority')::boolean, t.confirmed_authority),
      confirmed_will_provide_documents = coalesce((p_request ->> 'confirmed_will_provide_documents')::boolean, t.confirmed_will_provide_documents),
      confirmed_understands_review = coalesce((p_request ->> 'confirmed_understands_review')::boolean, t.confirmed_understands_review),
      confirmed_understands_publication_not_confirmation = coalesce((p_request ->> 'confirmed_understands_publication_not_confirmation')::boolean, t.confirmed_understands_publication_not_confirmation),
      visibility = 'private',
      status = 'submitted'
    where t.id = p_draft_id
      and t.requester_profile_id = v_requester
      and t.status = 'draft'
    returning t.id, t.request_number, t.status into v_id, v_request_number, v_status;

    if not found then
      raise exception 'Draft not found, already submitted, or not yours' using errcode = 'P0001';
    end if;
  else
    insert into public.transport_requests (
      requester_profile_id, request_purpose, ownership_changing,
      animal_id, sender_org_id, animal_name, breed_free_text, sex, approximate_age, weight_kg,
      size_category, microchip_number, microchip_known, passport_available, vaccination_status,
      rabies_vaccination_date, health_condition, medication, behavioural_notes,
      anxiety_or_aggression_notes, can_travel_with_others, crate_requirements,
      current_owner_profile_id, release_authorized_by, receive_authorized_by,
      pickup_country, pickup_city, pickup_area_approx, pickup_address_exact,
      destination_country, destination_city, destination_area_approx, destination_address_exact,
      earliest_date, latest_date, flexible_dates, delivery_type, number_of_animals,
      is_domestic, is_sale, is_ownership_change, is_adoption, travelling_with_owner,
      owner_travel_within_5_days, sender_is_registered_breeder, sender_is_verified_org,
      origin_registered_or_approved, has_passport, has_microchip, rabies_valid,
      health_certificate_required, traces_notification_required, destination_treatment_required,
      medically_fit_for_transport, compliance_review_result, requested_service_type,
      confirmed_accurate, confirmed_authority, confirmed_will_provide_documents,
      confirmed_understands_review, confirmed_understands_publication_not_confirmation,
      visibility, status
    ) values (
      v_requester,
      coalesce((p_request ->> 'request_purpose')::public.transport_request_purpose, 'other'),
      coalesce((p_request ->> 'ownership_changing')::boolean, false),
      nullif(p_request ->> 'animal_id', '')::uuid,
      nullif(p_request ->> 'sender_org_id', '')::uuid,
      p_request ->> 'animal_name',
      p_request ->> 'breed_free_text',
      (p_request ->> 'sex')::public.dog_sex,
      p_request ->> 'approximate_age',
      (p_request ->> 'weight_kg')::numeric,
      (p_request ->> 'size_category')::public.size_category,
      p_request ->> 'microchip_number',
      coalesce((p_request ->> 'microchip_known')::boolean, true),
      (p_request ->> 'passport_available')::boolean,
      p_request ->> 'vaccination_status',
      (p_request ->> 'rabies_vaccination_date')::date,
      p_request ->> 'health_condition',
      p_request ->> 'medication',
      p_request ->> 'behavioural_notes',
      p_request ->> 'anxiety_or_aggression_notes',
      (p_request ->> 'can_travel_with_others')::boolean,
      p_request ->> 'crate_requirements',
      nullif(p_request ->> 'current_owner_profile_id', '')::uuid,
      p_request ->> 'release_authorized_by',
      p_request ->> 'receive_authorized_by',
      p_request ->> 'pickup_country',
      p_request ->> 'pickup_city',
      p_request ->> 'pickup_area_approx',
      p_request ->> 'pickup_address_exact',
      p_request ->> 'destination_country',
      p_request ->> 'destination_city',
      p_request ->> 'destination_area_approx',
      p_request ->> 'destination_address_exact',
      (p_request ->> 'earliest_date')::date,
      (p_request ->> 'latest_date')::date,
      coalesce((p_request ->> 'flexible_dates')::boolean, false),
      coalesce((p_request ->> 'delivery_type')::public.transport_delivery_type, 'meeting_point'),
      coalesce((p_request ->> 'number_of_animals')::integer, 1),
      (p_request ->> 'is_domestic')::boolean,
      (p_request ->> 'is_sale')::boolean,
      (p_request ->> 'is_ownership_change')::boolean,
      (p_request ->> 'is_adoption')::boolean,
      (p_request ->> 'travelling_with_owner')::boolean,
      (p_request ->> 'owner_travel_within_5_days')::boolean,
      (p_request ->> 'sender_is_registered_breeder')::boolean,
      (p_request ->> 'sender_is_verified_org')::boolean,
      (p_request ->> 'origin_registered_or_approved')::boolean,
      (p_request ->> 'has_passport')::boolean,
      (p_request ->> 'has_microchip')::boolean,
      (p_request ->> 'rabies_valid')::boolean,
      (p_request ->> 'health_certificate_required')::boolean,
      (p_request ->> 'traces_notification_required')::boolean,
      (p_request ->> 'destination_treatment_required')::boolean,
      (p_request ->> 'medically_fit_for_transport')::boolean,
      coalesce((p_request ->> 'compliance_review_result')::public.transport_compliance_result, 'basic_review_required'),
      coalesce((p_request ->> 'requested_service_type')::public.transport_service_type, 'recommend_best'),
      coalesce((p_request ->> 'confirmed_accurate')::boolean, false),
      coalesce((p_request ->> 'confirmed_authority')::boolean, false),
      coalesce((p_request ->> 'confirmed_will_provide_documents')::boolean, false),
      coalesce((p_request ->> 'confirmed_understands_review')::boolean, false),
      coalesce((p_request ->> 'confirmed_understands_publication_not_confirmation')::boolean, false),
      'private', 'submitted'
    )
    returning transport_requests.id, transport_requests.request_number, transport_requests.status
    into v_id, v_request_number, v_status;
  end if;

  insert into public.transport_status_history (transport_request_id, status, changed_by, customer_note)
  values (v_id, v_status, v_requester, 'Request submitted.');

  return query select v_id, v_request_number, v_status;
end;
$$;

revoke all on function public.submit_transport_request(jsonb, uuid) from public;
grant execute on function public.submit_transport_request(jsonb, uuid) to authenticated;
