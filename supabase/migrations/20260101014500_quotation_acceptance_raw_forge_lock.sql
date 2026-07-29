-- Independently verified from a Bot 1 audit finding (H-4/NEW-H1, isolated read-only clone
-- /p/the-puppy-passport-bot1-overnight-20260728-233809 — its own report content was not trusted,
-- the gap was reproduced live against this repo's own database before writing this fix).
--
-- prevent_non_staff_operational_field_changes() (20260101007000-era trigger, most recently
-- redefined without change to this specific clause) unconditionally allows a non-staff caller to
-- move a transport_requests row from status 'quotation_sent' straight to 'accepted_by_customer' --
-- the same transition respond_to_quotation() performs, but the trigger has no idea whether that RPC
-- was actually the caller. Confirmed empirically: a customer's raw
-- `.from("transport_requests").update({status: "accepted_by_customer"})` succeeds even when the
-- attached quotation is expired (respond_to_quotation() correctly rejects the same case), and
-- afterward quotations.status is left at 'sent' forever -- the request row falsely claims customer
-- acceptance with no quotation ever actually accepted, and (if several quotation revisions exist)
-- no way to tell which one. This bypasses every one of respond_to_quotation()'s own checks:
-- quotation existence, ownership, current status, expiry, and its transport_status_history audit
-- insert.
--
-- Fixed the same way this schema handles every other "verify real state, not caller identity"
-- gate (prevent_fundraising_self_publish, is_profile_under_legal_hold): require a real, currently
-- accepted, unexpired quotation to already exist for this exact request before allowing the
-- transition. quotations' own "requesters accept or reject their own quotation" UPDATE policy
-- already independently enforces ownership and expiry on that table (confirmed by reading its live
-- with_check before writing this fix) -- so this exists() check is safe regardless of whether the
-- quotation was accepted via the canonical RPC or via a direct (already-correctly-gated) raw update
-- to quotations.status, and it does not reject the legitimate respond_to_quotation() path, since
-- that RPC sets quotations.status = 'accepted' before updating transport_requests.status, in the
-- same transaction.
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
    and not (
      old.status = 'quotation_sent'
      and new.status = 'accepted_by_customer'
      and exists (
        select 1 from public.quotations q
        where q.transport_request_id = new.id
          and q.status = 'accepted'
          and (q.expiry_date is null or q.expiry_date >= current_date)
      )
    )
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
