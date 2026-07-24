-- Stage BL addendum (supplemental queue): support case management. This session's own earlier
-- audit (Stage AJ, re-confirmed at Stage BL) found no real "contact support" UI exists anywhere,
-- and concluded building a generic ticket system would have no reachable consumer -- correct at
-- the time, based on the information available. A subsequent, much more detailed specification
-- was provided mid-session explicitly requesting this be built regardless, with concrete required
-- behaviour (customer-created cases, server-controlled actor, customer-visible vs internal
-- messages, staff claim/assignment, audit trail, stable status semantics). Building it now on that
-- explicit instruction, following the exact same patterns already proven elsewhere this session:
-- the is_internal split from messages (Stage R), the atomic claim RPC from moderation_cases
-- (Stage BM, immediately above), and is_ops_staff() as the "support staff" gate (no dedicated
-- 'support' platform_role exists, and inventing one with no staff-facing UI to use it would be the
-- same "speculative infrastructure" this session otherwise avoids -- ops staff are the closest
-- real, already-trusted staff concept).
create type public.support_case_status as enum (
  'open', 'triaged', 'in_progress', 'waiting_for_customer', 'waiting_for_internal',
  'resolved', 'closed', 'reopened'
);
create type public.support_case_priority as enum ('low', 'medium', 'high', 'urgent');

create table public.support_cases (
  id uuid primary key default gen_random_uuid(),
  requester_profile_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null,
  category text not null default 'other',
  status public.support_case_status not null default 'open',
  priority public.support_case_priority not null default 'medium',
  assigned_staff_id uuid references public.profiles (id),
  -- Informational relation to another entity (e.g. 'transport_request', 'buyer_application',
  -- 'organisation') -- deliberately not a strict polymorphic FK, matching the same
  -- target_type/target_id pattern already used by reports/moderation_cases elsewhere in this
  -- schema. Never trusted for authorisation by itself; it's context for staff, not a capability.
  related_entity_type text,
  related_entity_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  closed_at timestamptz
);

create trigger set_support_cases_updated_at
  before update on public.support_cases
  for each row execute function public.set_updated_at();

create table public.support_case_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.support_cases (id) on delete cascade,
  sender_profile_id uuid not null references public.profiles (id),
  body text not null,
  -- Same shape as messages.is_internal (Stage R): staff-only notes layered on the same case,
  -- never visible to the requester. Locked at the RLS layer below, not just the app.
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.support_cases enable row level security;
alter table public.support_case_messages enable row level security;

-- Requester: create their own case (server-controlled actor -- requester_profile_id must equal
-- auth.uid(), a client can never open a case "as" someone else), read their own, and the one
-- legitimate self-service transition: reopening a resolved/closed case of their own. Every other
-- field (status beyond reopen, priority, assigned_staff_id, category after creation) is
-- staff-only, matching "customer cannot set staff-only fields" / "customer cannot assign staff".
create policy "requesters create their own support case"
  on public.support_cases for insert
  to authenticated
  with check (requester_profile_id = (select auth.uid()) and status = 'open');

create policy "requesters view their own support cases"
  on public.support_cases for select
  to authenticated
  using (requester_profile_id = (select auth.uid()));

create policy "requesters may only reopen their own resolved or closed case"
  on public.support_cases for update
  to authenticated
  using (
    requester_profile_id = (select auth.uid())
    and status in ('resolved', 'closed')
  )
  with check (
    requester_profile_id = (select auth.uid())
    and status = 'reopened'
  );

create policy "ops staff manage all support cases"
  on public.support_cases for all
  to authenticated
  using (public.is_ops_staff())
  with check (public.is_ops_staff());

grant select, insert, update on public.support_cases to authenticated;

-- Messages: requester and assigned/any ops staff can post customer-visible messages on a case
-- they're party to. Requesters can never post is_internal = true (same lock shape as
-- 20260101008600_messages_internal_flag_lock.sql), and can never read internal-only messages.
create policy "case parties view non-internal messages"
  on public.support_case_messages for select
  to authenticated
  using (
    not is_internal
    and exists (
      select 1 from public.support_cases sc
      where sc.id = case_id and sc.requester_profile_id = (select auth.uid())
    )
  );

create policy "requesters post non-internal messages on their own case"
  on public.support_case_messages for insert
  to authenticated
  with check (
    sender_profile_id = (select auth.uid())
    and is_internal = false
    and exists (
      select 1 from public.support_cases sc
      where sc.id = case_id and sc.requester_profile_id = (select auth.uid())
    )
  );

create policy "ops staff manage all support case messages"
  on public.support_case_messages for all
  to authenticated
  using (public.is_ops_staff())
  with check (public.is_ops_staff());

grant select, insert on public.support_case_messages to authenticated;

-- claim_support_case(): same atomic-claim shape as claim_moderation_case() (Stage BM) -- select
-- ... for update to serialize concurrent claimers, a clear conflict error, a server-stamped
-- actor, and every staff claim is audited (append-only, matching "every staff mutation is
-- audited").
create or replace function public.claim_support_case(p_case_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_assignee uuid;
begin
  if not public.is_ops_staff() then
    raise exception 'Only support staff can claim a case.'
      using errcode = 'P0001';
  end if;

  select assigned_staff_id into v_current_assignee
  from public.support_cases
  where id = p_case_id
  for update;

  if not found then
    raise exception 'Support case not found';
  end if;

  if v_current_assignee is not null and v_current_assignee <> auth.uid() then
    raise exception 'This case has already been claimed by another staff member.'
      using errcode = 'P0001';
  end if;

  update public.support_cases
  set assigned_staff_id = auth.uid(), status = 'triaged'
  where id = p_case_id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'support_case.claimed', 'support_cases', p_case_id,
    jsonb_build_object('assigned_staff_id', v_current_assignee),
    jsonb_build_object('assigned_staff_id', auth.uid())
  );
end;
$$;

revoke all on function public.claim_support_case(uuid) from public;
grant execute on function public.claim_support_case(uuid) to authenticated;
