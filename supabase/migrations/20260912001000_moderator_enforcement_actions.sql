-- ============================================================================================
-- Moderator enforcement actions. The moderation *paperwork* (reports -> cases -> decisions ->
-- appeals, docs/MODERATION_RUNBOOK.md) is real and live, but deciding a case never actually did
-- anything to the target: updateModerationCase() only ever wrote a free-text `decision` string.
-- posts/comments already have `moderation_status` (content_moderation_status: visible/hidden/
-- removed, added in 20260903000200_social_posts_comments_hardening.sql) plus a trigger that
-- *intends* to let a moderator change it (prevent_non_moderator_post_moderation_changes()) --  but
-- no RLS policy actually grants a moderator UPDATE access to someone else's post in the first
-- place, so that trigger's moderator branch has been unreachable dead code. animals has no
-- moderator-facing flag at all (only owner-controlled is_published). organisations.verification_
-- status already has a 'suspended' value in its enum but nothing ever sets it.
--
-- Fix: three SECURITY DEFINER RPCs (same shape as approve_user_verification()) rather than new
-- RLS policies -- each is a single audited action, not a standing grant, and each works whether or
-- not the caller already has any other access to the row.
-- ============================================================================================

create or replace function public.moderator_set_post_moderation_status(
  p_post_id uuid,
  p_status public.content_moderation_status,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.content_moderation_status;
begin
  if not public.is_moderator() then
    raise exception 'only a moderator or admin can change a post''s moderation status';
  end if;

  select moderation_status into v_before from public.posts where id = p_post_id;
  if not found then
    raise exception 'post % not found', p_post_id;
  end if;

  update public.posts set moderation_status = p_status where id = p_post_id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'post.moderation_status_changed', 'posts', p_post_id,
    jsonb_build_object('moderation_status', v_before),
    jsonb_build_object('moderation_status', p_status, 'reason', p_reason)
  );
end;
$$;

revoke all on function public.moderator_set_post_moderation_status(uuid, public.content_moderation_status, text) from public, anon;
grant execute on function public.moderator_set_post_moderation_status(uuid, public.content_moderation_status, text) to authenticated;

create or replace function public.moderator_set_comment_moderation_status(
  p_comment_id uuid,
  p_status public.content_moderation_status,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.content_moderation_status;
begin
  if not public.is_moderator() then
    raise exception 'only a moderator or admin can change a comment''s moderation status';
  end if;

  select moderation_status into v_before from public.comments where id = p_comment_id;
  if not found then
    raise exception 'comment % not found', p_comment_id;
  end if;

  update public.comments set moderation_status = p_status where id = p_comment_id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'comment.moderation_status_changed', 'comments', p_comment_id,
    jsonb_build_object('moderation_status', v_before),
    jsonb_build_object('moderation_status', p_status, 'reason', p_reason)
  );
end;
$$;

revoke all on function public.moderator_set_comment_moderation_status(uuid, public.content_moderation_status, text) from public, anon;
grant execute on function public.moderator_set_comment_moderation_status(uuid, public.content_moderation_status, text) to authenticated;

-- animals has no moderator-facing flag today -- only the owning org can toggle is_published.
-- A moderator forcing it to false is a takedown; forcing it back to true is a reinstatement.
-- Deliberately does not touch listing_category, breeder verification, or anything else --
-- narrowest possible action matching "remove a dog listing".
create or replace function public.moderator_set_animal_published(
  p_animal_id uuid,
  p_published boolean,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before boolean;
begin
  if not public.is_moderator() then
    raise exception 'only a moderator or admin can change a listing''s published state';
  end if;

  select is_published into v_before from public.animals where id = p_animal_id;
  if not found then
    raise exception 'animal % not found', p_animal_id;
  end if;

  update public.animals set is_published = p_published where id = p_animal_id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'animal.moderator_published_changed', 'animals', p_animal_id,
    jsonb_build_object('is_published', v_before),
    jsonb_build_object('is_published', p_published, 'reason', p_reason)
  );
end;
$$;

revoke all on function public.moderator_set_animal_published(uuid, boolean, text) from public, anon;
grant execute on function public.moderator_set_animal_published(uuid, boolean, text) to authenticated;

-- Temporarily blocking a breeder/foundation: only ever toggles between 'approved' and 'suspended'
-- -- a suspended org must have been approved to be suspended in the first place (an org still
-- under initial 'pending' review is rejected via reject_user_verification(), not suspended), and
-- reinstating one always restores exactly that prior 'approved' state, never silently re-approving
-- an org that was never actually reviewed. Every public-facing table already requires
-- verification_status = 'approved' to show anything (see 20260101009000_public_listing_query_
-- indexes.sql's own audit note) and buyer_applications' insert policy already blocks new
-- applications against a non-approved org (20260101013700_suspended_org_application_lock.sql) --
-- so suspending here is immediately effective everywhere else with zero further gating changes.
create or replace function public.moderator_set_organisation_suspended(
  p_org_id uuid,
  p_suspended boolean,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.org_verification_status;
begin
  if not public.is_moderator() then
    raise exception 'only a moderator or admin can suspend or reinstate an organisation';
  end if;

  select verification_status into v_before from public.organisations where id = p_org_id;
  if not found then
    raise exception 'organisation % not found', p_org_id;
  end if;

  if p_suspended then
    if v_before <> 'approved' then
      raise exception 'only an approved organisation can be suspended (current status: %)', v_before;
    end if;
    update public.organisations set verification_status = 'suspended' where id = p_org_id;
  else
    if v_before <> 'suspended' then
      raise exception 'organisation % is not currently suspended', p_org_id;
    end if;
    update public.organisations set verification_status = 'approved' where id = p_org_id;
  end if;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'organisation.moderator_suspension_changed', 'organisations', p_org_id,
    jsonb_build_object('verification_status', v_before),
    jsonb_build_object(
      'verification_status', case when p_suspended then 'suspended' else 'approved' end,
      'reason', p_reason
    )
  );
end;
$$;

revoke all on function public.moderator_set_organisation_suspended(uuid, boolean, text) from public, anon;
grant execute on function public.moderator_set_organisation_suspended(uuid, boolean, text) to authenticated;
