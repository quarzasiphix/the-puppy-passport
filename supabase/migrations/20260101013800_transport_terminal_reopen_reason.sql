-- Stage YR-10 (transport operational timeline integrity). change_ops_request_status() (Stage AD)
-- deliberately places no restriction on which status ops can move a request to -- a real, correct
-- design decision (Stage BF/CC both explicitly document ops needing full override flexibility,
-- unconstrained by the strict transition graph the driver side is held to). But that flexibility
-- was never paired with the accountability half the driver_status_state_machine migration's own
-- comment promised: "that override path with an explicit reason + audit record is IR-8's dedicated
-- scope, not this one." Traced through docs/AUTONOMOUS_BACKEND_PROGRESS.md: IR-8 was actually about
-- scheduling/capacity conflicts (found already correct, no fix needed) -- an unrelated topic. The
-- "reason + audit" override path for reopening a terminal request was simply never built by any
-- stage.
--
-- The specific, highest-risk, genuinely reachable gap this closes: ops can currently move a
-- transport_requests row *out of* a terminal status (completed, rejected, cancelled_by_customer,
-- cancelled_by_operations) back into any other status with zero required justification -- an
-- accidental click could silently "un-complete" a delivery that already happened, with nothing in
-- the audit trail explaining why. change_ops_request_status() already writes a real audit_logs
-- entry for every status change (Stage AD); this only tightens the one case where that entry's
-- own justification (internal_note) is currently optional to something that should never be
-- silent. Every other transition -- including forward jumps, skips, and moving between any two
-- non-terminal statuses -- remains completely unconstrained, preserving the deliberate override
-- flexibility Stage BF/CC established.
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
  v_terminal_statuses public.transport_status[] := array[
    'completed', 'rejected', 'cancelled_by_customer', 'cancelled_by_operations'
  ];
begin
  if not public.is_ops_staff() then
    raise exception 'Only operations staff can change a transport request''s status this way.'
      using errcode = 'P0001';
  end if;

  select status into v_before from public.transport_requests where id = p_request_id;
  if v_before is null then
    raise exception 'Transport request not found';
  end if;

  if v_before = any(v_terminal_statuses)
     and p_new_status <> v_before
     and coalesce(trim(p_internal_note), '') = ''
  then
    raise exception 'Reopening a % request requires an internal note explaining why.', v_before
      using errcode = 'P0001';
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
