-- Stage AD (supplemental queue): transactional domain events. changeOpsRequestStatus()
-- (src/lib/queries/operations.ts) does three separate client-side network round-trips -- update
-- transport_requests.status, insert transport_status_history, insert audit_logs -- none wrapped
-- in a real transaction. A network blip or crash between any of them leaves the request's status
-- changed with no matching history row, or changed-and-logged-in-history but with no audit trail,
-- and the audit_logs insert's result isn't even checked (no `.error` read), so a silently-failed
-- audit entry wasn't previously surfaced at all.
--
-- Also found while fixing this: both the history and audit rows trusted a client-supplied
-- `actorId` field for changed_by/actor_profile_id, the exact same forgeable-actor shape already
-- closed for notifications.actor_profile_id in an earlier session
-- (20260101006400_notifications_actor_always_server_stamped.sql) -- a raw API call to the old
-- three-step client-side flow could credit any profile id as having made the change. Folding this
-- into one SECURITY DEFINER RPC fixes both: the whole thing is one Postgres transaction (atomic,
-- all-or-nothing), and `changed_by`/`actor_profile_id` are always auth.uid(), never client input.
create or replace function public.change_ops_request_status(
  p_request_id uuid,
  p_new_status public.transport_status,
  p_customer_note text default null,
  p_internal_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.transport_status;
begin
  if not public.is_ops_staff() then
    raise exception 'Only operations staff can change a transport request''s status this way.'
      using errcode = 'P0001';
  end if;

  select status into v_before from public.transport_requests where id = p_request_id;
  if v_before is null then
    raise exception 'Transport request not found';
  end if;

  update public.transport_requests set status = p_new_status where id = p_request_id;

  insert into public.transport_status_history (
    transport_request_id, status, changed_by, customer_note, internal_note
  ) values (
    p_request_id, p_new_status, auth.uid(), p_customer_note, p_internal_note
  );

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'transport_request.status_changed', 'transport_requests', p_request_id,
    jsonb_build_object('status', v_before), jsonb_build_object('status', p_new_status)
  );
end;
$$;

revoke all on function public.change_ops_request_status(uuid, public.transport_status, text, text) from public;
grant execute on function public.change_ops_request_status(uuid, public.transport_status, text, text) to authenticated;
