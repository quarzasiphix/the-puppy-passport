-- 20260101006900_transport_amendment_workflow.sql's request_transport_amendment() checks that the
-- caller is the request's requester and that the field is on the allow-list, but never checks the
-- request's current status — found while writing regression coverage
-- (tests/db/transport-domain.test.ts). Two real gaps this closes:
-- 1. A still-draft request could be "amended" through this workflow, even though a draft is
--    already directly editable by the requester — pointless at best, and it would create a
--    pending amendment record for a request whose fields might be edited directly again before
--    anyone reviews it, leaving the amendment's captured old_value stale.
-- 2. A request in a final state (completed/rejected/cancelled) could still have amendments filed
--    against it — there is nothing left to schedule or correct at that point.
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
