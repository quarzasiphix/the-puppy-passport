-- Fixes OPEN FINDING #1 (docs/DATABASE_TESTING.md, tests/db/security-regressions.test.ts
-- "customers can currently change their own request's operational status"): the
-- "requesters update their own transport requests" policy (20260101001300_transport_requests.sql)
-- only checks row ownership (requester_profile_id = auth.uid()), not which columns change — a
-- signed-in customer could PATCH their own request's `status`, `compliance_review_result`, or
-- `assigned_*` columns directly, bypassing the entire ops workflow.
--
-- RLS is row-level, not column-level, so the fix is a BEFORE UPDATE trigger that compares OLD/NEW
-- and rejects a change to any operational column unless the actor is ops staff/admin (who already
-- have "ops staff and admins manage all transport requests") or the specific driver assigned to
-- this exact request (who already has "assigned drivers update status on their own requests" for
-- legitimate pickup/in-transit/delivered progress updates). Neither of those legitimate paths is
-- affected — this only closes the gap in the customer-ownership policy.
--
-- Two customer-initiated status transitions are genuinely legitimate and must stay allowed (found
-- by re-running the full workflow suite against a first version of this trigger that blocked
-- everything: it broke the real "customer creates and submits a transport request" flow):
-- submitting their own draft (draft -> submitted, the one-time initial submission every request
-- goes through) and self-cancelling (-> cancelled_by_customer, matching that the status enum has a
-- dedicated value for exactly this and cancelling your own request is never a privilege
-- escalation). Every other status value, and every other operational column, stays staff/driver-only.
create or replace function public.prevent_non_staff_operational_field_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() is null only for a direct superuser/service connection (migrations, seed scripts)
  -- that bypasses RLS entirely — never for a real PostgREST request, authenticated or anon. Any
  -- role that reaches this trigger via RLS already had a legitimate row-level grant to update this
  -- specific row (own-row, ops-staff-manage-all, or assigned-driver); this only adds the missing
  -- column-level check on top of that.
  if auth.uid() is null or public.is_ops_staff() or public.is_assigned_driver_for_request(old.id) then
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

create trigger prevent_non_staff_operational_field_changes
  before update on public.transport_requests
  for each row execute function public.prevent_non_staff_operational_field_changes();
