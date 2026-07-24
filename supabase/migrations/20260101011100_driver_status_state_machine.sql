-- Stage CC (supplemental queue): state-machine/chaos tests. `prevent_non_staff_operational_field_
-- changes()` (Stage L, 20260101006000) closed the customer-forgery gap but exempted the assigned
-- driver entirely -- correct for status (a driver legitimately needs to progress a job), wrong for
-- everything else: a driver's raw-API UPDATE could set `status` to *any* value in the enum
-- (jump straight to `completed`, move backwards, or set an ops-only hold state), and could also
-- reassign `assigned_route_id`/`assigned_vehicle_id`/`assigned_driver_id`/`compliance_review_
-- result`/`visibility` -- none of that reachable through the real driver UI (which only ever
-- sends the single next step from `driverStatusSteps`, src/lib/queries/driver.ts), but real via a
-- raw API call, the same "not reachable through the UI, but real via curl" bug shape this session
-- has repeatedly closed. Documented and deliberately deferred at Stage M/BF specifically for this
-- dedicated stage rather than a rushed partial version.
--
-- The legal transition graph below is not invented -- it matches exactly what the real app
-- already treats as canonical in two independent places: `driverStatusSteps` (the UI's own linear
-- "next step" sequence) and the full-journey scenario test
-- (tests/db/transport-lifecycle-scenarios.test.ts), which additionally exercises the optional
-- `rest_or_care_stop` detour the UI's array skips over (a driver can go straight from
-- `in_transport` to `approaching_destination`, or take a rest/care stop first and resume either
-- back into transit or straight on to approaching the destination). `veterinary_hold`/
-- `compliance_hold` are deliberately NOT reachable by a driver here -- no real code path
-- (UI or otherwise) currently sets either from the driver side; adding them now with no reachable
-- trigger would be exactly the speculative-infrastructure pattern this session avoids. Ops staff
-- remain completely unconstrained by this trigger (Stage BF's own reasoning still holds: ops needs
-- real override ability, e.g. cancelling from any non-terminal state — that override path with an
-- explicit reason + audit record is IR-8's dedicated scope, not this one).
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
