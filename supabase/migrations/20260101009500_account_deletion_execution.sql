-- Stage AI (supplemental queue): deletion/anonymisation execution. Closes the real, repeatedly
-- flagged gap first documented in Stage O (docs/PRIVACY_DATA_LIFECYCLE.md): account deletion was
-- request-tracking only -- markDeletionRequestProcessed() flips a status flag but never actually
-- deletes or anonymises anything. Execution is anonymisation, not a hard DELETE FROM profiles:
-- Stage L's audit already established that audit-trail FK columns referencing profiles(id)
-- (reviewed_by, assigned_moderator_id, uploaded_by, changed_by, etc.) have no ON DELETE action by
-- design, so a hard delete would fail outright for any account with an audit trail. Anonymising
-- via UPDATE keeps every FK relationship intact (nothing cascades), preserves historical transport
-- snapshots/ownership history/audit integrity exactly as they were, and makes the account's
-- identifying fields (email, phone, name, avatar) disappear from anywhere they're displayed.
--
-- Deliberately does NOT invent a retention period or claim full legal compliance -- this is the
-- mechanical execution step the request-tracking flow was always missing, not a legal policy.
alter table public.profiles
  add column is_deleted boolean not null default false,
  add column deleted_at timestamptz;

-- Not sensitive like email/phone (20260101003200_profiles_contact_lockdown.sql) -- just an
-- account-status flag/timestamp, safe to be as visible as display_name.
grant select (is_deleted, deleted_at) on public.profiles to authenticated;

-- execute_account_deletion(): admin-only. Refuses to anonymise while the account has a real,
-- concrete unresolved obligation -- an active transport request, reservation or application would
-- otherwise silently lose its identifying contact/party information mid-workflow, and organisation
-- ownership must be transferred through its own real flow first rather than being silently
-- orphaned. Every check here is a real, reachable table this schema already has; nothing
-- speculative.
create or replace function public.execute_account_deletion(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_status public.account_deletion_status;
  v_blocker text;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can execute an account deletion.'
      using errcode = 'P0001';
  end if;

  select profile_id, status into v_profile_id, v_status
  from public.account_deletion_requests
  where id = p_request_id;

  if v_profile_id is null then
    raise exception 'Deletion request not found';
  end if;
  if v_status <> 'pending' then
    raise exception 'This deletion request has already been % ', v_status
      using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.transport_requests
    where requester_profile_id = v_profile_id
      and status not in ('completed', 'rejected', 'cancelled_by_customer', 'cancelled_by_operations')
  ) then
    v_blocker := 'an active transport request';
  elsif exists (
    select 1 from public.reservations
    where buyer_id = v_profile_id and status not in ('cancelled', 'completed')
  ) then
    v_blocker := 'an active reservation';
  elsif exists (
    select 1 from public.buyer_applications
    where buyer_id = v_profile_id
      and status not in ('withdrawn', 'rejected', 'converted_to_reservation', 'expired')
  ) then
    v_blocker := 'an active application';
  elsif exists (select 1 from public.organisations where owner_user_id = v_profile_id) then
    v_blocker := 'organisation ownership that has not been transferred';
  end if;

  if v_blocker is not null then
    raise exception 'Cannot delete this account yet: it has %.', v_blocker
      using errcode = 'P0001';
  end if;

  update public.profiles
  set
    is_deleted = true,
    deleted_at = now(),
    display_name = null,
    first_name = null,
    last_name = null,
    email = null,
    phone = null,
    avatar_url = null,
    city = null,
    country = null
  where id = v_profile_id;

  update public.account_deletion_requests
  set status = 'processed', processed_at = now(), processed_by = auth.uid()
  where id = p_request_id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id)
  values (auth.uid(), 'account_deletion.executed', 'profiles', v_profile_id);
end;
$$;

revoke all on function public.execute_account_deletion(uuid) from public;
grant execute on function public.execute_account_deletion(uuid) to authenticated;
