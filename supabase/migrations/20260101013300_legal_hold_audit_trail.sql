-- Stage XR-16 (append-only queue): legal-hold propagation. Revalidating Stage CJH's legal-hold
-- mechanism (not rebuilding it) found one real, concrete gap matching this stage's own "restrict
-- and audit hold transitions" requirement literally: `place_legal_hold()`/`release_legal_hold()`
-- never wrote an `audit_logs` entry at all, unlike every other comparably consequential admin
-- action in this schema (moderation decisions, welfare case reviews, account deletion execution,
-- verification approvals). A legal hold overrides someone's ability to have their own account
-- deleted at all, tied to litigation/investigation/regulatory need -- among the most consequential
-- admin actions this schema has, yet it left no trace in the one ledger ops/admin actually review
-- together. The `legal_holds` table itself still records `placed_by`/`released_by` (unchanged,
-- already correct), but that's a narrower, hold-specific record, not the cross-cutting audit trail
-- every other admin action already gets.
create or replace function public.place_legal_hold(p_subject_profile_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hold_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can place a legal hold.'
      using errcode = 'P0001';
  end if;

  insert into public.legal_holds (subject_profile_id, reason, placed_by)
  values (p_subject_profile_id, p_reason, auth.uid())
  returning id into v_hold_id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'legal_hold.placed', 'profiles', p_subject_profile_id,
    null, jsonb_build_object('hold_id', v_hold_id, 'reason', p_reason)
  );

  return v_hold_id;
end;
$$;

create or replace function public.release_legal_hold(p_hold_id uuid, p_release_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subject_profile_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can release a legal hold.'
      using errcode = 'P0001';
  end if;

  update public.legal_holds
  set released_at = now(), released_by = auth.uid(), release_reason = p_release_reason
  where id = p_hold_id and released_at is null
  returning subject_profile_id into v_subject_profile_id;

  if not found then
    raise exception 'Legal hold not found, or already released';
  end if;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'legal_hold.released', 'profiles', v_subject_profile_id,
    jsonb_build_object('hold_id', p_hold_id), jsonb_build_object('release_reason', p_release_reason)
  );
end;
$$;
