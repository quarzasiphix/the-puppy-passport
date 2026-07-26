-- Stage XR-9 (append-only queue): idempotency key registry. Audited every RPC for true retry-
-- idempotency (a client that never learned whether its first call actually succeeded -- a dropped
-- response, a timeout, a double-click before a button disables -- retries the exact same call) and
-- found this schema already has several well-fitted, narrower idempotency mechanisms rather than
-- one generic key table: `buyer_applications_active_unique` (a real partial unique index, not a
-- registry, since "at most one active application per buyer per animal" is a hard business rule,
-- not merely a retry-safety concern), `create_notification_if_enabled()`'s `dedup_key` column
-- (Stage CJR), `reservations`/route-assignment/conversation-creation unique indexes (Stage
-- concurrency_hardening), and `claim_moderation_case()`/`claim_support_case()`'s own "idempotent if
-- it's already you" re-claim handling. A new, generic, actor/tenant/operation-scoped key table has
-- no currently-demonstrated real consumer beyond what these targeted mechanisms already cover --
-- building one now would be exactly the speculative infrastructure this session has repeatedly and
-- correctly declined to build elsewhere (Stages BA/BB/BE/BP/BS).
--
-- What *is* real and reachable: two "convert once" RPCs (`convert_application_to_reservation()`,
-- `convert_welfare_case_to_transport_draft()`) already correctly prevent a *second, real*
-- conversion, but do it by raising an exception on retry rather than returning the original
-- success -- exactly the gap this stage's own definition names ("reject same key with changed
-- payload... return original success"). A client retrying after a dropped response (the operation
-- actually succeeded the first time) sees an error, not the reservation/transport request it
-- already has. Fixed to be genuinely idempotent: a retry with the same effective payload returns
-- the original result; `convert_application_to_reservation()` additionally rejects a retry whose
-- price/currency/date/collection-method terms genuinely differ from what was actually created
-- (a real conflict, not a safe retry) rather than silently ignoring the new values.
create or replace function public.convert_application_to_reservation(
  p_application_id uuid,
  p_agreed_price numeric default null,
  p_currency text default 'PLN',
  p_planned_collection_date date default null,
  p_collection_method public.collection_method default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application public.buyer_applications;
  v_existing public.reservations;
  v_reservation_id uuid;
begin
  select * into v_application from public.buyer_applications where id = p_application_id;
  if not found then
    raise exception 'Application not found' using errcode = 'P0001';
  end if;

  if v_application.organization_id is null then
    raise exception 'This application has no organisation to reserve on behalf of.'
      using errcode = 'P0001';
  end if;

  if not public.owns_org(v_application.organization_id) and not public.is_admin() then
    raise exception 'Only the organisation this application was submitted to can convert it to a reservation.'
      using errcode = 'P0001';
  end if;

  select * into v_existing from public.reservations where application_id = p_application_id;
  if found then
    if v_existing.agreed_price is distinct from p_agreed_price
       or v_existing.currency is distinct from p_currency
       or v_existing.planned_collection_date is distinct from p_planned_collection_date
       or v_existing.collection_method is distinct from p_collection_method then
      raise exception 'This application was already converted to a reservation with different terms — refresh and try again.'
        using errcode = 'P0001';
    end if;
    return v_existing.id;
  end if;

  if v_application.status <> 'approved' then
    raise exception 'Only an approved application can be converted to a reservation.'
      using errcode = 'P0001';
  end if;

  -- Genuinely concurrent identical retries can both pass the "not found" check above before
  -- either commits (standard READ COMMITTED behaviour -- neither sees the other's uncommitted
  -- insert yet). reservations_application_id_key (a real, pre-existing unique constraint) means
  -- at most one of them can ever actually insert; without this handler the *other* caller would
  -- see a raw, confusing unique-violation error instead of the same idempotent success the
  -- earlier "already exists" branch already provides for a *sequential* retry. Caught here and
  -- resolved the same way create_notification_if_enabled() (Stage CJR) resolves its own
  -- insert-or-return-existing race.
  begin
    insert into public.reservations (
      animal_id, litter_id, buyer_id, organization_id, application_id,
      agreed_price, currency, planned_collection_date, collection_method, notes
    )
    values (
      v_application.animal_id, v_application.litter_id, v_application.buyer_id,
      v_application.organization_id, p_application_id,
      p_agreed_price, p_currency, p_planned_collection_date, p_collection_method, p_notes
    )
    returning id into v_reservation_id;
  exception when unique_violation then
    select * into v_existing from public.reservations where application_id = p_application_id;
    if v_existing.agreed_price is distinct from p_agreed_price
       or v_existing.currency is distinct from p_currency
       or v_existing.planned_collection_date is distinct from p_planned_collection_date
       or v_existing.collection_method is distinct from p_collection_method then
      raise exception 'This application was already converted to a reservation with different terms — refresh and try again.'
        using errcode = 'P0001';
    end if;
    return v_existing.id;
  end;

  update public.buyer_applications set status = 'converted_to_reservation'
  where id = p_application_id;

  -- Best-effort: only actually change availability if the animal is still in a state where
  -- "reserved" is a meaningful forward transition -- never overwrite an animal that's already
  -- moved further along (sold/adopted) or been withdrawn, which a stale/duplicate call could race.
  update public.animals set availability_status = 'reserved'
  where id = v_application.animal_id
    and availability_status in ('available', 'applications_open');

  return v_reservation_id;
end;
$$;

create or replace function public.convert_welfare_case_to_transport_draft(p_case_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.welfare_cases;
  v_request_id uuid;
begin
  select * into v_case from public.welfare_cases where id = p_case_id;
  if not found then
    raise exception 'welfare case not found' using errcode = 'P0001';
  end if;
  if not public.is_org_member(v_case.organisation_id) then
    raise exception 'only a member of this case''s organisation can convert it' using errcode = 'P0001';
  end if;

  -- Idempotent retry: a case already converted has a real transport_requests row already spawned
  -- from it (the same payload every time, since it's entirely derived from this case's own
  -- columns) -- return that instead of re-raising a confusing "not yet accepted" error against a
  -- status that only ever changed because the first call already succeeded.
  if v_case.status = 'converted_to_transport' then
    return v_case.converted_transport_request_id;
  end if;
  if v_case.status <> 'accepted_for_assessment' then
    raise exception 'this case has not been accepted for assessment by operations yet (status: %)', v_case.status
      using errcode = 'P0001';
  end if;

  v_request_id := public.create_transport_draft(
    jsonb_build_object(
      'request_purpose', 'foundation_rescue',
      'pickup_country', v_case.location_country,
      'pickup_city', v_case.location_city,
      'pickup_area_approx', v_case.location_area_approx,
      'pickup_address_exact', v_case.location_address_exact,
      'destination_country', v_case.destination_country,
      'destination_city', v_case.destination_city,
      'latest_date', v_case.deadline,
      'release_authorized_by', v_case.contact_name
    ),
    jsonb_build_array(jsonb_build_object(
      'animal_id', v_case.animal_id,
      'name', v_case.animal_name,
      'behavioural_notes', v_case.animal_description
    )),
    jsonb_build_array(jsonb_build_object('party_role', 'sender', 'organisation_id', v_case.organisation_id))
  );

  update public.welfare_cases
  set status = 'converted_to_transport', converted_transport_request_id = v_request_id
  where id = p_case_id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'welfare_case.converted_to_transport', 'welfare_cases', p_case_id,
    null, jsonb_build_object('transport_request_id', v_request_id)
  );

  return v_request_id;
end;
$$;
