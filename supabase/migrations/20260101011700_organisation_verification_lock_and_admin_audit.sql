-- Stage CJM (third/fourth supplemental queue): admin command log. Investigating why admin-only
-- organisation actions (verification status, featuring) had no audit trail led to a real, more
-- serious finding: `organisations.verification_status` was never added to
-- `prevent_org_owner_transfer_by_non_admin()`'s protected-field set (Stage I locked
-- `owner_user_id`/`is_featured`, but not this one) -- "owners update their own organisation" is a
-- plain row-level policy with no column restriction, so an org owner could self-approve their own
-- organisation's verification via a raw UPDATE, completely bypassing `approve_user_verification()`
-- (the real, admin-gated, idempotency-hardened RPC this is meant to go through, Stage BC). The
-- same self-approval bug class this session has closed repeatedly elsewhere (rehoming_reviews,
-- buyer_applications), just never checked for this specific column until now.
--
-- Closing both findings together: verification_status joins the protected set, and every real
-- admin change to any of the three protected fields now writes a real audit_logs entry (the
-- original "admin command log" ask) -- atomic, in the same trigger, not a separate client-side
-- write that could be forgotten or fail silently.
create or replace function public.prevent_org_owner_transfer_by_non_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    if auth.uid() is not null then
      if new.owner_user_id is distinct from old.owner_user_id then
        insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
        values (
          auth.uid(), 'organisation.owner_transferred', 'organisations', new.id,
          jsonb_build_object('owner_user_id', old.owner_user_id),
          jsonb_build_object('owner_user_id', new.owner_user_id)
        );
      end if;
      if new.is_featured is distinct from old.is_featured then
        insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
        values (
          auth.uid(), 'organisation.featured_changed', 'organisations', new.id,
          jsonb_build_object('is_featured', old.is_featured),
          jsonb_build_object('is_featured', new.is_featured)
        );
      end if;
      if new.verification_status is distinct from old.verification_status then
        insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
        values (
          auth.uid(), 'organisation.verification_status_changed', 'organisations', new.id,
          jsonb_build_object('verification_status', old.verification_status),
          jsonb_build_object('verification_status', new.verification_status)
        );
      end if;
    end if;
    return new;
  end if;

  if new.owner_user_id is distinct from old.owner_user_id then
    raise exception 'Organisation ownership can only be transferred by Havenpaw staff — contact support to change the accountable owner.'
      using errcode = 'P0001';
  end if;
  if new.is_featured is distinct from old.is_featured then
    raise exception 'Only Havenpaw staff can feature or unfeature an organisation.'
      using errcode = 'P0001';
  end if;
  if new.verification_status is distinct from old.verification_status then
    raise exception 'Only Havenpaw staff can change an organisation''s verification status — contact support if you believe this is incorrect.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
