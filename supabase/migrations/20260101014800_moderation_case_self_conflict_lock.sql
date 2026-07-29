-- Independently verified from a Bot 1 audit finding (H-3/§5.4, reproduced live against this repo's
-- own database before fixing, not trusted from the report alone).
--
-- "moderators and admins manage all moderation cases" (ALL, `is_moderator()`) has no check that the
-- calling moderator isn't the case's own affected_profile_id -- a moderator (or admin, since
-- is_moderator() already includes admin) whose own account is the subject of a report could claim
-- and decide their own case: dismiss it, mark it resolved, write the decision text. Confirmed
-- empirically: both claim_moderation_case() (Stage BQ's own atomic claim RPC) and the plain client
-- update path (updateModerationCase()) let a moderator claim and fully decide a case where they are
-- the affected profile.
--
-- One trigger closes both paths at once: BEFORE UPDATE fires regardless of whether the update
-- originates from a raw client call or from inside claim_moderation_case()'s own SECURITY DEFINER
-- body (SECURITY DEFINER only changes the privilege context for RLS/grants, not whether triggers
-- fire) -- the same "close every current and future path at once" shape already used for
-- stamp_changed_by_actor(). No admin exemption: this is a conflict-of-interest check, not a trust
-- check -- an admin deciding a case about their own account is exactly the conflict this exists to
-- prevent, not a legitimate trusted-staff override.
--
-- Scoped to only the decision-making columns, not every column: the affected user's own legitimate
-- appeal (submit_moderation_appeal(), itself requiring affected_profile_id = auth.uid()) also
-- updates this same row (appeal_status = 'requested') as part of its normal, correct operation. A
-- blanket "any update while affected_profile_id = auth.uid()" block was tested and found to
-- incorrectly reject that legitimate self-service path too -- caught by running the full existing
-- moderation-appeals suite before committing, not assumed safe.
create or replace function public.prevent_moderator_self_case_conflict()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if old.affected_profile_id is not null and old.affected_profile_id = auth.uid() then
    if new.status is distinct from old.status
      or new.decision is distinct from old.decision
      or new.decision_explanation is distinct from old.decision_explanation
      or new.resolved_at is distinct from old.resolved_at
      or new.assigned_moderator_id is distinct from old.assigned_moderator_id
      or new.public_decision_summary is distinct from old.public_decision_summary
    then
      raise exception 'You cannot manage or decide a moderation case that concerns your own account.'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create trigger prevent_moderator_self_case_conflict
  before update on public.moderation_cases
  for each row execute function public.prevent_moderator_self_case_conflict();
