-- Stage CJH (third/fourth supplemental queue): legal-hold mechanism. `execute_account_deletion()`
-- (Stage AI) already refuses while a real business obligation is unresolved (an active transport
-- request/reservation/application, un-transferred organisation ownership) -- a legal hold is the
-- same shape of blocker for a different reason: litigation/investigation/regulatory need to
-- preserve a specific account's data regardless of what business state it's in. No UI exists to
-- place one yet (this is explicitly requested by name in this queue, the same "no reachable UI
-- today, build the backend mechanism anyway on explicit instruction" precedent as Stage BL-
-- addendum's support cases) -- the backend contract is what matters; a real admin UI for placing a
-- hold is a separate, deferred frontend task.
--
-- Released holds are never deleted, only marked `released_at`/`released_by` -- matching Stage
-- CJG's own just-established "never hard-delete something with audit value" discipline. An active
-- hold is simply one where `released_at is null`.
create table public.legal_holds (
  id uuid primary key default gen_random_uuid(),
  subject_profile_id uuid not null references public.profiles (id),
  reason text not null,
  placed_by uuid not null references public.profiles (id),
  placed_at timestamptz not null default now(),
  released_by uuid references public.profiles (id),
  released_at timestamptz,
  release_reason text
);

create index legal_holds_subject_active_idx
  on public.legal_holds (subject_profile_id)
  where released_at is null;

alter table public.legal_holds enable row level security;

-- Admin-only in both directions -- this is a rarer, more serious action than ordinary ops-staff
-- work (it overrides someone's ability to have their account deleted at all), so gated to
-- `is_admin()` specifically, not the broader `is_ops_staff()`.
create policy "admins manage legal holds"
  on public.legal_holds for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update on public.legal_holds to authenticated;

-- Server-stamps the real actor for both placing and releasing -- matching every other
-- actor-attribution fix this session has made. A raw RLS-scoped UPDATE could otherwise forge
-- `released_by` to a different admin; a raw INSERT could forge `placed_by`.
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

  return v_hold_id;
end;
$$;

revoke all on function public.place_legal_hold(uuid, text) from public;
grant execute on function public.place_legal_hold(uuid, text) to authenticated;

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

  update public.legal_holds
  set released_at = now(), released_by = auth.uid(), release_reason = p_release_reason
  where id = p_hold_id and released_at is null;

  if not found then
    raise exception 'Legal hold not found, or already released';
  end if;
end;
$$;

revoke all on function public.release_legal_hold(uuid, text) from public;
grant execute on function public.release_legal_hold(uuid, text) to authenticated;

-- The one real integration point: execute_account_deletion() now also refuses while an active
-- legal hold exists on the profile, using the exact same "collect the blocker reason, raise once"
-- shape as its existing business-obligation checks -- extended, not rewritten.
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
