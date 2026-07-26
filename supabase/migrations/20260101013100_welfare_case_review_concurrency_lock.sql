-- Stage XR-8 (append-only queue): optimistic concurrency/stale-write protection. Audited every
-- RPC that decides a shared case/record's outcome for a `select ... for update` row lock plus an
-- expected-current-state guard -- the pattern `claim_moderation_case()`/`claim_support_case()`/
-- `review_moderation_appeal()` already established. `review_welfare_case()`
-- (20260101007600_welfare_cases.sql) was the one real gap: it does a plain, unlocked `update ...
-- where id = p_case_id` with zero read of the current row first, so (1) two ops staff (or the same
-- one, two tabs) concurrently reviewing the same case with different decisions race with no
-- serialization at all -- whichever UPDATE commits last silently wins, and both audit_logs entries
-- record `before: null`, giving no trace a conflict ever happened; and (2) there is no guard
-- against re-reviewing a case that has already moved past review entirely -- a case already
-- `converted_to_transport` (a real transport_requests row already exists, per
-- `convert_welfare_case_to_transport_draft()`) could still be silently reset back to `declined` or
-- `accepted_for_assessment` by a later review call, leaving the welfare case's own status
-- contradicting the real transport request it already spawned. `closed` is the same terminal shape.
--
-- Fixed with `select ... for update` (serializes concurrent callers the same way every other claim
-- RPC in this schema already does) and an explicit terminal-state check, matching
-- `submit_moderation_appeal()`'s existing "this decision has already been appealed" precedent.
-- Deliberately still allows reconsidering between `accepted_for_assessment`/`declined`/
-- `information_required` -- ops legitimately revisiting a decision as new information comes in is
-- a real, existing workflow this fix doesn't restrict, only the two genuinely terminal states.
create or replace function public.review_welfare_case(
  p_case_id uuid,
  p_decision public.welfare_case_status,
  p_review_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_status public.welfare_case_status;
begin
  if not public.is_ops_staff() then
    raise exception 'only operations staff can review a welfare case' using errcode = 'P0001';
  end if;
  if p_decision not in ('accepted_for_assessment', 'declined', 'information_required') then
    raise exception 'decision must be accepted_for_assessment, declined, or information_required'
      using errcode = 'P0001';
  end if;

  select status into v_current_status
  from public.welfare_cases
  where id = p_case_id
  for update;

  if not found then
    raise exception 'welfare case not found' using errcode = 'P0001';
  end if;
  if v_current_status in ('converted_to_transport', 'closed') then
    raise exception 'this case has already been % and can no longer be reviewed', v_current_status
      using errcode = 'P0001';
  end if;

  update public.welfare_cases
  set status = p_decision, review_notes = coalesce(p_review_notes, review_notes)
  where id = p_case_id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'welfare_case.reviewed', 'welfare_cases', p_case_id,
    jsonb_build_object('status', v_current_status), jsonb_build_object('decision', p_decision)
  );
end;
$$;
