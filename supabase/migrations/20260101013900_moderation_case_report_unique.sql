-- Stage YR-15 (raw API bypass audit). escalate_report_to_case() (Stage XR-7 follow-up 2) already
-- prevents a *client retry through the RPC itself* from creating a duplicate moderation_cases row
-- for the same report -- but "moderators and admins manage all moderation cases" is a real, correct
-- `for all` RLS policy (moderators are fully trusted staff, same as ops elsewhere in this schema),
-- so a moderator using the raw Data API directly (`POST /moderation_cases`) instead of the RPC
-- could still insert a second case for the same report_id -- the RPC's own duplicate-prevention
-- check has nothing to enforce it at the database level. Closed the same way
-- `reservations_application_id_key` already closes the identical shape for
-- convert_application_to_reservation(): a real unique constraint, the strongest possible
-- enforcement (works regardless of which path -- RPC or raw API -- is used to write).
create unique index moderation_cases_report_id_key
  on public.moderation_cases (report_id)
  where report_id is not null;

-- escalate_report_to_case() already checks for an existing case via a SELECT before inserting, but
-- that's a read-then-write race under genuine concurrency (two moderators escalating the same
-- report at once) -- the constraint above is what actually prevents the duplicate row from ever
-- existing, but without this handler the *losing* concurrent caller would see a raw, confusing
-- unique-violation error instead of the same idempotent "return the existing case" success the
-- sequential-retry path already provides. Same resolution shape as
-- convert_application_to_reservation()'s own concurrent-insert handling (Stage XR-9).
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

  if v_report.status = 'escalated' then
    select id into v_existing_case_id
    from public.moderation_cases
    where report_id = p_report_id
    order by created_at desc
    limit 1;
    if v_existing_case_id is not null then
      return v_existing_case_id;
    end if;
  end if;

  begin
    insert into public.moderation_cases (report_id, case_type, target_type, target_id, status)
    values (p_report_id, 'report_escalation', v_report.target_type, v_report.target_id, 'open')
    returning id into v_case_id;
  exception when unique_violation then
    select id into v_case_id from public.moderation_cases where report_id = p_report_id;
    return v_case_id;
  end;

  update public.reports set status = 'escalated' where id = p_report_id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, after)
  values (
    auth.uid(), 'report.escalated', 'reports', p_report_id,
    jsonb_build_object('moderation_case_id', v_case_id)
  );

  return v_case_id;
end;
$$;
