-- Follow-up to Stage XR-7 (docs/TRANSACTIONAL_WORKFLOW_BOUNDARIES_AUDIT.md), picking up the top 3
-- of the 6 documented candidates in that stage's own priority order: respondToQuotation
-- (customer-facing, commercially critical), sendQuotation (its ops-side pair), assignDriverToJob
-- (closest match to already-fixed siblings like change_ops_request_status). Each was a 2-3-step
-- client-side write sequence with no transactional boundary and, for respondToQuotation/
-- sendQuotation/assignDriverToJob, a client-supplied changed_by/actorId -- the exact two problems
-- (partial-write risk, forgeable actor) this session has closed repeatedly elsewhere. Same shape
-- as change_ops_request_status (Stage AD) and convert_application_to_reservation (Stage IR-6):
-- one SECURITY DEFINER RPC per operation, changed_by/actor always auth.uid(), idempotent retry
-- where a client double-call is a real reachable case (a dropped response, a double-click before a
-- button disables), matching the idempotent-retry precedent from Stage XR-9.
--
-- respondToQuotation's own known gap (flagged explicitly in the XR-7 audit, not rediscovered here):
-- its second and third writes never checked their own `error` result. Folding all three writes
-- into one transaction closes this by construction -- a failure anywhere now rolls back the whole
-- call and surfaces as a real error to the caller, not a silently swallowed one.

create or replace function public.respond_to_quotation(
  p_quotation_id uuid,
  p_response public.quotation_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quotation public.quotations;
begin
  if p_response not in ('accepted', 'rejected') then
    raise exception 'response must be either accepted or rejected' using errcode = 'P0001';
  end if;

  select * into v_quotation from public.quotations where id = p_quotation_id;
  if not found then
    raise exception 'quotation not found' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.transport_requests tr
    where tr.id = v_quotation.transport_request_id and tr.requester_profile_id = auth.uid()
  ) then
    raise exception 'you do not have permission to respond to this quotation' using errcode = 'P0001';
  end if;

  -- Idempotent retry: already resolved to exactly this response -- a client that never learned
  -- whether its first call succeeded (dropped response, a double-click before the button
  -- disables) sees the same success, not a confusing "no longer open for a response" error.
  if v_quotation.status = p_response then
    return;
  end if;

  if v_quotation.status not in ('sent', 'viewed') then
    raise exception 'this quotation is no longer open for a response' using errcode = 'P0001';
  end if;

  if p_response = 'accepted'
     and v_quotation.expiry_date is not null
     and v_quotation.expiry_date < current_date then
    raise exception 'this quotation has expired and can no longer be accepted' using errcode = 'P0001';
  end if;

  update public.quotations set status = p_response where id = p_quotation_id;

  if p_response = 'accepted' then
    update public.transport_requests set status = 'accepted_by_customer'
    where id = v_quotation.transport_request_id;

    insert into public.transport_status_history (
      transport_request_id, status, changed_by, customer_note
    ) values (
      v_quotation.transport_request_id, 'accepted_by_customer', auth.uid(), 'Quotation accepted.'
    );
  end if;
end;
$$;

revoke all on function public.respond_to_quotation(uuid, public.quotation_status) from public;
grant execute on function public.respond_to_quotation(uuid, public.quotation_status) to authenticated;

create or replace function public.send_quotation(p_quotation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quotation public.quotations;
begin
  if not public.is_ops_staff() then
    raise exception 'only operations staff can send a quotation' using errcode = 'P0001';
  end if;

  select * into v_quotation from public.quotations where id = p_quotation_id;
  if not found then
    raise exception 'quotation not found' using errcode = 'P0001';
  end if;

  -- Idempotent retry: already sent (or further along) -- the send button is only ever shown for a
  -- draft quotation, so a real second call here means a retried request, not a new intent.
  if v_quotation.status <> 'draft' then
    return;
  end if;

  update public.quotations set status = 'sent' where id = p_quotation_id;

  update public.transport_requests set status = 'quotation_sent'
  where id = v_quotation.transport_request_id;

  insert into public.transport_status_history (
    transport_request_id, status, changed_by, customer_note
  ) values (
    v_quotation.transport_request_id, 'quotation_sent', auth.uid(),
    'A quotation is ready for you to review.'
  );
end;
$$;

revoke all on function public.send_quotation(uuid) from public;
grant execute on function public.send_quotation(uuid) to authenticated;

create or replace function public.assign_driver_to_job(
  p_transport_request_id uuid,
  p_driver_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.transport_requests;
begin
  if not public.is_ops_staff() then
    raise exception 'only operations staff can assign a driver' using errcode = 'P0001';
  end if;

  select * into v_current from public.transport_requests where id = p_transport_request_id;
  if not found then
    raise exception 'transport request not found' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.drivers where id = p_driver_id) then
    raise exception 'driver not found' using errcode = 'P0001';
  end if;

  -- Idempotent retry: already assigned to exactly this driver -- avoid a duplicate history row
  -- from a client retry of the same successful call.
  if v_current.assigned_driver_id = p_driver_id and v_current.status = 'driver_assigned' then
    return;
  end if;

  update public.transport_requests
  set assigned_driver_id = p_driver_id, status = 'driver_assigned'
  where id = p_transport_request_id;

  insert into public.transport_status_history (
    transport_request_id, status, changed_by
  ) values (
    p_transport_request_id, 'driver_assigned', auth.uid()
  );
end;
$$;

revoke all on function public.assign_driver_to_job(uuid, uuid) from public;
grant execute on function public.assign_driver_to_job(uuid, uuid) to authenticated;

-- Writing a real test for respond_to_quotation() above surfaced a genuine, previously-invisible
-- bug: prevent_non_staff_operational_field_changes() (Stage CC, 20260101011100) already carves out
-- exactly two legitimate customer-initiated status transitions (draft->submitted,
-- ->cancelled_by_customer) for a non-ops/non-driver caller, but never added a third for accepting
-- a quotation -- meaning a real customer accepting their own quotation via respondToQuotation()
-- has been silently rejected by this trigger since Stage CC shipped, for both the old raw
-- multi-step client code (which never checked this specific update's `.error` result at all, the
-- exact gap Stage XR-7's own audit flagged) and the new atomic RPC above alike. There is no
-- deliberate design intent anywhere disallowing this -- respond_to_quotation()'s own existence,
-- and the whole buyer-facing "Accept quotation" UI, only make sense if this transition is meant to
-- succeed. Fixed the same way the existing two exemptions are scoped: this trigger's job is only
-- "is this a legal status transition for a non-staff actor," never "is this the right person" --
-- that identity check is already RLS's job for a raw client path, and respond_to_quotation()'s own
-- explicit requester check for the RPC path -- so no additional identity check belongs here.
create or replace function public.prevent_non_staff_operational_field_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver_transition_allowed boolean;
begin
  if auth.uid() is null or public.is_ops_staff() then
    return new;
  end if;

  if public.is_assigned_driver_for_request(old.id) then
    if new.status is distinct from old.status then
      v_driver_transition_allowed := (
        (old.status = 'driver_assigned' and new.status = 'pickup_confirmed')
        or (old.status = 'pickup_confirmed' and new.status = 'animal_collected')
        or (old.status = 'animal_collected' and new.status = 'in_transport')
        or (old.status = 'in_transport' and new.status in ('rest_or_care_stop', 'approaching_destination'))
        or (old.status = 'rest_or_care_stop' and new.status in ('in_transport', 'approaching_destination'))
        or (old.status = 'approaching_destination' and new.status = 'delivered')
        or (old.status = 'delivered' and new.status = 'handover_confirmed')
        or (old.status = 'handover_confirmed' and new.status = 'completed')
      );
      if not v_driver_transition_allowed then
        raise exception 'A driver cannot move a job from % directly to % — only the next real step in the delivery journey is allowed', old.status, new.status
          using errcode = 'P0001';
      end if;
    end if;

    if new.compliance_review_result is distinct from old.compliance_review_result
      or new.visibility is distinct from old.visibility
      or new.assigned_route_id is distinct from old.assigned_route_id
      or new.assigned_vehicle_id is distinct from old.assigned_vehicle_id
      or new.assigned_driver_id is distinct from old.assigned_driver_id
    then
      raise exception 'Only operations staff can change a transport request''s assignment or compliance fields'
        using errcode = 'P0001';
    end if;

    return new;
  end if;

  if new.status is distinct from old.status
    and not (old.status = 'draft' and new.status = 'submitted')
    and new.status is distinct from 'cancelled_by_customer'
    and not (old.status = 'quotation_sent' and new.status = 'accepted_by_customer')
  then
    raise exception 'Only operations staff or the assigned driver can change a transport request''s status to %', new.status
      using errcode = 'P0001';
  end if;

  if new.compliance_review_result is distinct from old.compliance_review_result
    or new.visibility is distinct from old.visibility
    or new.assigned_route_id is distinct from old.assigned_route_id
    or new.assigned_vehicle_id is distinct from old.assigned_vehicle_id
    or new.assigned_driver_id is distinct from old.assigned_driver_id
  then
    raise exception 'Only operations staff or the assigned driver can change a transport request''s operational fields'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;
