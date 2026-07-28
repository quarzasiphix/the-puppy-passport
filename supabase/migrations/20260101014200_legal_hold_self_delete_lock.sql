-- Stage FA-4 (legal-hold enforcement completeness). `legal_holds`
-- (20260101011500_legal_holds.sql) was built to "preserve a specific account's data regardless of
-- what business state it's in," but the only place it was ever actually wired in is
-- execute_account_deletion() -- a full account deletion. A profile under an active legal hold could
-- still freely destroy their own account's content one piece at a time through ordinary self-service
-- RLS policies that were never taught about legal holds at all:
--
--   * "authors delete their own comments" (20260101001900_community.sql) -- any comment, any age.
--   * "buyers delete their own applications" (20260101013700_suspended_org_application_lock.sql) --
--     any application, at any status (not just drafts), a real hard delete with no audit trail.
--
-- Both are exactly the kind of destructive, self-initiated action a legal hold exists to prevent --
-- confirmed genuinely reachable, not hypothetical: neither policy has any status/age restriction, so
-- a subject under investigation could delete every comment or application tied to their account the
-- moment a hold is placed, with nothing in the schema stopping them.
--
-- Not touched: "requesters delete their own draft requests" (still draft, never-submitted content
-- with no real evidentiary weight yet) and org-scoped deletes (welfare_case_documents, kennel media)
-- -- legal_holds.subject_profile_id names an individual profile, not an organisation, and this
-- schema has no established concept of an org-level hold; extending to org-scoped tables would be
-- speculative, not a demonstrated gap.
--
-- Matches execute_account_deletion()'s own established legal-hold semantics: the check applies
-- unconditionally to the destructive action itself, admins included -- a legal hold blocking even
-- the admin deletion path is the whole reason execute_account_deletion() checks it after (not
-- instead of) its own admin-only gate. Trusted staff moderation deletion ("admins manage all
-- comments") and admin/ops management of buyer_applications are separate, already-audited policies
-- this migration does not touch; only the two self-service, unaudited hard-delete paths above.
create or replace function public.is_profile_under_legal_hold(p_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.legal_holds
    where subject_profile_id = p_profile_id and released_at is null
  );
$$;

revoke all on function public.is_profile_under_legal_hold(uuid) from public;
grant execute on function public.is_profile_under_legal_hold(uuid) to authenticated;

create or replace function public.prevent_comment_self_delete_under_legal_hold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_profile_under_legal_hold(old.author_profile_id) then
    raise exception 'This comment cannot be deleted while an active legal hold requires this account''s data to be preserved.'
      using errcode = 'P0001';
  end if;

  return old;
end;
$$;

create trigger prevent_comment_self_delete_under_legal_hold
  before delete on public.comments
  for each row execute function public.prevent_comment_self_delete_under_legal_hold();

create or replace function public.prevent_application_self_delete_under_legal_hold()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_profile_under_legal_hold(old.buyer_id) then
    raise exception 'This application cannot be deleted while an active legal hold requires this account''s data to be preserved.'
      using errcode = 'P0001';
  end if;

  return old;
end;
$$;

create trigger prevent_application_self_delete_under_legal_hold
  before delete on public.buyer_applications
  for each row execute function public.prevent_application_self_delete_under_legal_hold();
