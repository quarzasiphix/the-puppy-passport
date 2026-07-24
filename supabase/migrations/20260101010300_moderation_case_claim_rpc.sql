-- Stage BM (supplemental queue): moderation assignment/reviewer workload. The real "investigate"
-- UI action (dashboard.admin.moderation.tsx) does a plain, unconditioned UPDATE setting
-- assigned_moderator_id to a client-supplied auth.uid() value, through updateModerationCase().
-- Two real gaps: (1) no guard against the case already being claimed by someone else -- two
-- moderators clicking "investigate" on the same unassigned case at the same moment would race,
-- with whichever write lands last silently overwriting the other (the first moderator's UI shows
-- success, but the database ends up crediting the second moderator instead); (2) assigned_
-- moderator_id was a plain client-supplied value, the same forgeable-actor shape closed elsewhere
-- this session -- any moderator could set it to a *different* moderator's id.
--
-- claim_moderation_case(): select ... for update to serialize concurrent claimers, a clear error
-- if the case is already claimed by someone else (idempotent if it's already you), and a
-- server-stamped auth.uid() actor -- same pattern as approve_user_verification() (Stage BC).
-- Deliberately narrow: only the claim/self-assign action goes through this RPC. Broader
-- moderation actions (resolving a case, reassigning between moderators, adding decision notes)
-- keep using the existing "is_moderator() manages all cases" policy directly -- this isn't
-- touched, since a reassignment override is a legitimate admin action this stage found no
-- evidence needs restricting further.
create or replace function public.claim_moderation_case(p_case_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_assignee uuid;
begin
  if not public.is_moderator() then
    raise exception 'Only moderators can claim a case.'
      using errcode = 'P0001';
  end if;

  select assigned_moderator_id into v_current_assignee
  from public.moderation_cases
  where id = p_case_id
  for update;

  if not found then
    raise exception 'Moderation case not found';
  end if;

  if v_current_assignee is not null and v_current_assignee <> auth.uid() then
    raise exception 'This case has already been claimed by another moderator.'
      using errcode = 'P0001';
  end if;

  update public.moderation_cases
  set assigned_moderator_id = auth.uid(), status = 'investigating'
  where id = p_case_id;
end;
$$;

revoke all on function public.claim_moderation_case(uuid) from public;
grant execute on function public.claim_moderation_case(uuid) to authenticated;
