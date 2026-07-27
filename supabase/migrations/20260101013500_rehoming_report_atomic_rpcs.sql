-- Second follow-up to Stage XR-7 (docs/TRANSACTIONAL_WORKFLOW_BOUNDARIES_AUDIT.md), picking up
-- the last 2 of the 6 documented candidates that are still a good fit for a straightforward atomic
-- RPC (createTransportRequest's own remaining risk is low-severity -- its actor-forgery half is
-- already closed by the stamp_changed_by_actor trigger, XR-7's own note -- and its payload is a
-- large, evolving multi-field form, not a good fit for a rigid RPC signature right now; left open,
-- documented in the follow-up-1 report rather than rushed here).
--
-- approveRehomingReview (rehoming.ts): 2 writes (rehoming_reviews.admin_status,
-- animals.availability_status), no forgeable actor (already admin-checked by RLS on both tables),
-- but a real partial-write risk -- a review approved with the animal never actually made available
-- again. Also derives animal_id from the review row itself now instead of trusting a second
-- client-supplied argument, removing a redundant, mismatch-prone input the caller never needed to
-- supply in the first place.
--
-- escalateReportToCase (moderation.ts): 2 writes (moderation_cases insert, reports.status),
-- already error-checked, but genuinely re-escalatable into a duplicate case on a client retry --
-- moderation_cases.report_id has no unique constraint, and the only real duplicate-prevention was
-- a client-side Set built from listOpenCaseReportIds(). Fixed atomically, with the idempotent-
-- retry pattern this session has used repeatedly (Stage XR-9): a report that's already escalated
-- returns its existing open case instead of raising or duplicating.
create or replace function public.approve_rehoming_review(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review public.rehoming_reviews;
begin
  if not public.is_admin() then
    raise exception 'only an admin can approve a rehoming review' using errcode = 'P0001';
  end if;

  select * into v_review from public.rehoming_reviews where id = p_review_id;
  if not found then
    raise exception 'rehoming review not found' using errcode = 'P0001';
  end if;

  -- Idempotent retry: already approved -- a client retry after a dropped response should see the
  -- same success, not a confusing re-approval attempt.
  if v_review.admin_status = 'approved' then
    return;
  end if;

  update public.rehoming_reviews
  set admin_status = 'approved', reviewed_at = now()
  where id = p_review_id;

  -- Approval alone makes it publicly visible via RLS; also mark it available so it shows the
  -- right status instead of sitting in "draft" forever.
  update public.animals set availability_status = 'available' where id = v_review.animal_id;
end;
$$;

revoke all on function public.approve_rehoming_review(uuid) from public;
grant execute on function public.approve_rehoming_review(uuid) to authenticated;

create or replace function public.escalate_report_to_case(p_report_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.reports;
  v_existing_case_id uuid;
  v_case_id uuid;
begin
  if not public.is_moderator() then
    raise exception 'only a moderator can escalate a report' using errcode = 'P0001';
  end if;

  select * into v_report from public.reports where id = p_report_id;
  if not found then
    raise exception 'report not found' using errcode = 'P0001';
  end if;

  -- Idempotent retry: already escalated -- return the existing case rather than creating a second
  -- one for the same report. A previously-resolved-and-reopened case is intentionally not
  -- searched for here: reports.status only ever tracks the most recent escalation state, and
  -- moderation_cases.status transitions are this schema's own separate lifecycle.
  if v_report.status = 'escalated' then
    select id into v_existing_case_id
    from public.moderation_cases
    where report_id = p_report_id
    order by created_at desc
    limit 1;
    if v_existing_case_id is not null then
      return v_existing_case_id;
    end if;
    -- status says escalated but no case row exists (shouldn't happen, but fall through to create
    -- one rather than leaving a report permanently un-actionable).
  end if;

  insert into public.moderation_cases (report_id, case_type, target_type, target_id, status)
  values (p_report_id, 'report_escalation', v_report.target_type, v_report.target_id, 'open')
  returning id into v_case_id;

  update public.reports set status = 'escalated' where id = p_report_id;

  return v_case_id;
end;
$$;

revoke all on function public.escalate_report_to_case(uuid) from public;
grant execute on function public.escalate_report_to_case(uuid) to authenticated;
