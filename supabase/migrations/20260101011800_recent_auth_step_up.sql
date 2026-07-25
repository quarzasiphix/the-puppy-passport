-- Stage CJN (third/fourth supplemental queue): reauthentication ("step-up") hooks. Confirmed
-- directly against a real signed-in session on this local instance (not assumed) that Supabase
-- GoTrue's JWT carries a genuine `amr` (Authentication Methods Reference) claim -- an array of
-- {method, timestamp} entries recording actual authentication *events* (password sign-in, OTP,
-- OAuth, MFA). Unlike `iat`/`exp`, `amr` timestamps are NOT advanced by a silent refresh-token
-- exchange -- they only move when the user genuinely re-authenticates. That makes this a real,
-- honest, provider-neutral basis for "was this session recently, actively authenticated," not a
-- fabricated identity-provider feature.
--
-- Scope is deliberately narrow: wired into the three rarest, most destructive, already-admin-only
-- RPCs this session has built that are explicitly named by this stage --
-- execute_account_deletion() (Stage AI/CJH, irreversible), place_legal_hold()/release_legal_hold()
-- (Stage CJH, legal-sensitive). Deliberately NOT wired into routine, higher-volume admin actions
-- (approve_user_verification(), the CJM verification/owner/featured trigger, moderation/support
-- case claims) -- there is no reauthentication UI anywhere in this app yet (a "re-enter your
-- password" step), so hard-gating a frequently-used admin workflow behind a freshness window with
-- no way to refresh it would be a real, demonstrated regression (routine admin work silently
-- breaking after 15 minutes), not a security improvement. The three RPCs gated here are rare
-- enough, and the local Studio/direct-SQL escape hatch documented elsewhere in this session
-- (Stage AH's own "processed" flow notes) remains available for the same reason
-- `markDeletionRequestProcessed` never needed one. Documented as the honest current scope in
-- docs/AUTONOMOUS_BACKEND_PROGRESS.md and docs/DATABASE_INVARIANTS.md, not silently narrowed.
create or replace function public.last_auth_at()
returns timestamptz
language sql
stable
security invoker
set search_path = public
as $$
  select to_timestamp(
    coalesce(
      (
        select max((elem ->> 'timestamp')::bigint)
        from jsonb_array_elements(auth.jwt() -> 'amr') as elem
      ),
      0
    )
  )
$$;

comment on function public.last_auth_at() is
  'The real timestamp of the caller''s most recent authentication event (JWT amr claim), not the current access token''s issue time -- a silent token refresh never advances this.';

-- p_operation is a short machine-readable label (e.g. 'account_deletion.execute') included in the
-- error message so a caller/log can tell which action was blocked; p_max_age is deliberately a
-- parameter, not a hardcoded constant, so a future genuinely-different-risk operation can choose a
-- different window without touching this function. The error message is prefixed with the stable,
-- greppable token `reauthentication_required` (this session's established P0001-plus-message
-- convention, Stage BQ) so a client can distinguish "please sign in again" from an ordinary
-- business rejection if it's ever wired into the UI.
create or replace function public.require_recent_auth(p_operation text, p_max_age interval default '15 minutes')
returns void
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'reauthentication_required: % requires a signed-in session', p_operation
      using errcode = 'P0001';
  end if;

  if public.last_auth_at() < now() - p_max_age then
    raise exception 'reauthentication_required: % requires recent authentication -- please sign in again to continue', p_operation
      using errcode = 'P0001';
  end if;
end;
$$;

comment on function public.require_recent_auth(text, interval) is
  'Fail-closed step-up check: raises a stable reauthentication_required P0001 unless the caller genuinely authenticated (JWT amr, not just a refreshed token) within p_max_age. Server-enforced, no client-supplied bypass -- reads only auth.jwt(), never a request parameter.';

revoke all on function public.last_auth_at() from public;
grant execute on function public.last_auth_at() to authenticated;
revoke all on function public.require_recent_auth(text, interval) from public;
grant execute on function public.require_recent_auth(text, interval) to authenticated;

-- The admin-authorization check stays first in all three functions below, unchanged -- a
-- non-admin caller still gets the existing "Only an admin can..." rejection, never a
-- reauthentication_required leak that would confirm to a non-admin that the operation exists.
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

  perform public.require_recent_auth('account_deletion.execute');

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
  elsif exists (
    select 1 from public.legal_holds where subject_profile_id = v_profile_id and released_at is null
  ) then
    v_blocker := 'an active legal hold';
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

  perform public.require_recent_auth('legal_hold.place');

  insert into public.legal_holds (subject_profile_id, reason, placed_by)
  values (p_subject_profile_id, p_reason, auth.uid())
  returning id into v_hold_id;

  return v_hold_id;
end;
$$;

create or replace function public.release_legal_hold(p_hold_id uuid, p_release_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can release a legal hold.'
      using errcode = 'P0001';
  end if;

  perform public.require_recent_auth('legal_hold.release');

  update public.legal_holds
  set released_at = now(), released_by = auth.uid(), release_reason = p_release_reason
  where id = p_hold_id and released_at is null;

  if not found then
    raise exception 'Legal hold not found, or already released';
  end if;
end;
$$;
