-- Stage E: organisation team/volunteer management. dashboard.foundation.team.tsx was an honest
-- NotImplemented placeholder ("Invite volunteers and staff to your organisation and manage their
-- role"). organisation_members already existed with real RLS ("owners manage staff on their
-- organisation") but no invitation workflow at all — an owner could only ever silently insert a
-- membership row directly, with no consent step from the invited person, and no roles finer than
-- the existing generic owner/administrator/employee/breeder/volunteer/driver/viewer set.
--
-- Real gap found while building this, unrelated to the missing invitation flow: "owners update
-- their own organisation" (20260101000500_organizations.sql) is row-level only, so an owner could
-- directly UPDATE organisations.owner_user_id to *any* profile id — silently transferring or even
-- orphaning accountable ownership of their own org, with no consent from the new "owner" and no
-- oversight. Locked below to admin-only changes.

alter type public.org_member_role add value 'adoption_coordinator';
alter type public.org_member_role add value 'transport_coordinator';
alter type public.org_member_role add value 'animal_care_member';

create type public.org_member_status as enum ('active', 'suspended');
alter table public.organisation_members add column status public.org_member_status not null default 'active';

-- Ownership transfer is now a deliberate, admin-mediated action only — closes the gap above.
create or replace function public.prevent_org_owner_transfer_by_non_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if new.owner_user_id is distinct from old.owner_user_id then
    raise exception 'Organisation ownership can only be transferred by Anemalo staff — contact support to change the accountable owner.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger prevent_org_owner_transfer_by_non_admin
  before update on public.organisations
  for each row execute function public.prevent_org_owner_transfer_by_non_admin();

-- Suspended membership loses access immediately: is_org_member() is the function nearly every
-- org-scoped RLS policy in the schema calls through, so this one change propagates everywhere.
create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return public.owns_org(p_org_id) or exists (
    select 1 from public.organisation_members
    where org_id = p_org_id and profile_id = auth.uid() and status = 'active'
  );
end;
$$;

-- Who may invite/remove/suspend/change-role: the true owner (owns_org — always allowed, always
-- active by definition), or an active member whose own role is 'administrator'. A volunteer or any
-- other non-administrator role has no management capability at all — matches "do not give
-- volunteers broad organisation-management access."
create or replace function public.can_manage_org_members(p_org_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return public.owns_org(p_org_id) or exists (
    select 1 from public.organisation_members
    where org_id = p_org_id and profile_id = auth.uid() and status = 'active' and member_role = 'administrator'
  );
end;
$$;

-- "members read their own membership rows" (20260101000500_organizations.sql) only let a plain
-- member see their own row, or the true owner see everyone's — an administrator-tier member
-- (who can now manage the team via the RPCs below) had no way to even see the full member list.
create policy "org managers view their organisation's full member list"
  on public.organisation_members for select
  to authenticated
  using (public.can_manage_org_members(org_id));

create type public.org_invitation_status as enum ('pending', 'accepted', 'declined', 'revoked', 'expired');

create table public.organisation_invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  invited_email text not null,
  invited_role public.org_member_role not null,
  token uuid not null default gen_random_uuid(),
  status public.org_invitation_status not null default 'pending',
  invited_by uuid not null references public.profiles (id),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Single-use per (org, email) while pending — re-inviting the same address requires revoking the
-- existing pending invitation first, rather than silently piling up duplicates.
create unique index organisation_invitations_one_pending_per_email
  on public.organisation_invitations (org_id, invited_email)
  where status = 'pending';

alter table public.organisation_invitations enable row level security;

-- Deliberately no direct SELECT for the invited (not-yet-member) person — the token is a secret
-- unguessable value; a broad RLS "you can see it" policy can't be scoped to "only if you already
-- know the token" (RLS evaluates per-row, it can't see the client's own WHERE clause), so exposing
-- any row to a non-manager here would let an authenticated user bulk-list every organisation's
-- pending invitations and emails. get_invitation_by_token()/accept_org_invitation()/
-- decline_org_invitation() below are SECURITY DEFINER and do the token lookup internally instead —
-- "invitations do not publicly expose membership data."
create policy "org managers view and manage their own org's invitations"
  on public.organisation_invitations for all
  to authenticated
  using (public.can_manage_org_members(org_id))
  with check (public.can_manage_org_members(org_id));

create policy "admins manage all organisation invitations"
  on public.organisation_invitations for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update on public.organisation_invitations to authenticated;

create or replace function public.invite_org_member(
  p_org_id uuid,
  p_email text,
  p_role public.org_member_role
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation_id uuid;
begin
  if not public.can_manage_org_members(p_org_id) then
    raise exception 'you do not have permission to invite members to this organisation' using errcode = 'P0001';
  end if;
  -- Only the true owner may invite an administrator (or, notionally, another 'owner'-role row) —
  -- an administrator cannot appoint a peer administrator on their own, closing the obvious
  -- self-escalation-by-collusion path ("ordinary member cannot invite administrators", and by the
  -- same logic, an administrator cannot mint further administrators unilaterally either).
  if p_role in ('owner', 'administrator') and not public.owns_org(p_org_id) then
    raise exception 'only the organisation''s owner can invite an owner or administrator' using errcode = 'P0001';
  end if;

  insert into public.organisation_invitations (org_id, invited_email, invited_role, invited_by)
  values (p_org_id, lower(p_email), p_role, auth.uid())
  returning id into v_invitation_id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'org_invitation.created', 'organisation_invitations', v_invitation_id,
    null, jsonb_build_object('org_id', p_org_id, 'role', p_role)
  );

  return v_invitation_id;
end;
$$;

revoke all on function public.invite_org_member(uuid, text, public.org_member_role) from public;
grant execute on function public.invite_org_member(uuid, text, public.org_member_role) to authenticated;

create or replace function public.revoke_org_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from public.organisation_invitations where id = p_invitation_id;
  if v_org_id is null then
    raise exception 'invitation not found' using errcode = 'P0001';
  end if;
  if not public.can_manage_org_members(v_org_id) then
    raise exception 'you do not have permission to revoke this invitation' using errcode = 'P0001';
  end if;

  update public.organisation_invitations set status = 'revoked' where id = p_invitation_id and status = 'pending';

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id)
  values (auth.uid(), 'org_invitation.revoked', 'organisation_invitations', p_invitation_id);
end;
$$;

revoke all on function public.revoke_org_invitation(uuid) from public;
grant execute on function public.revoke_org_invitation(uuid) to authenticated;

-- Safe preview for the invited person before they act on it — never exposes anything beyond what
-- the invitation link itself already implies, and returns nothing at all for an invalid/expired/
-- already-resolved token rather than distinguishing "wrong token" from "expired" (no reason to
-- help an attacker enumerate which).
create or replace function public.get_invitation_by_token(p_token uuid)
returns table (org_name text, org_type public.org_type, invited_role public.org_member_role, expires_at timestamptz)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  return query
    select o.name, o.org_type, oi.invited_role, oi.expires_at
    from public.organisation_invitations oi
    join public.organisations o on o.id = oi.org_id
    where oi.token = p_token and oi.status = 'pending' and oi.expires_at > now();
end;
$$;

revoke all on function public.get_invitation_by_token(uuid) from public;
grant execute on function public.get_invitation_by_token(uuid) to authenticated;

create or replace function public.accept_org_invitation(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.organisation_invitations;
  v_caller_email text;
begin
  select * into v_invitation
  from public.organisation_invitations
  where token = p_token and status = 'pending'
  for update;

  if not found then
    raise exception 'this invitation is no longer valid' using errcode = 'P0001';
  end if;
  if v_invitation.expires_at <= now() then
    update public.organisation_invitations set status = 'expired' where id = v_invitation.id;
    raise exception 'this invitation has expired' using errcode = 'P0001';
  end if;

  select email into v_caller_email from public.profiles where id = auth.uid();
  if v_caller_email is null or lower(v_caller_email) <> v_invitation.invited_email then
    raise exception 'this invitation was sent to a different email address' using errcode = 'P0001';
  end if;

  insert into public.organisation_members (org_id, profile_id, member_role, status)
  values (v_invitation.org_id, auth.uid(), v_invitation.invited_role, 'active')
  on conflict (org_id, profile_id) do update
    set member_role = excluded.member_role, status = 'active';

  update public.organisation_invitations
  set status = 'accepted', accepted_by = auth.uid()
  where id = v_invitation.id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'org_invitation.accepted', 'organisation_invitations', v_invitation.id,
    null, jsonb_build_object('org_id', v_invitation.org_id, 'role', v_invitation.invited_role)
  );
end;
$$;

revoke all on function public.accept_org_invitation(uuid) from public;
grant execute on function public.accept_org_invitation(uuid) to authenticated;

create or replace function public.decline_org_invitation(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.organisation_invitations;
  v_caller_email text;
begin
  select * into v_invitation
  from public.organisation_invitations
  where token = p_token and status = 'pending'
  for update;

  if not found then
    raise exception 'this invitation is no longer valid' using errcode = 'P0001';
  end if;

  select email into v_caller_email from public.profiles where id = auth.uid();
  if v_caller_email is null or lower(v_caller_email) <> v_invitation.invited_email then
    raise exception 'this invitation was sent to a different email address' using errcode = 'P0001';
  end if;

  update public.organisation_invitations set status = 'declined' where id = v_invitation.id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id)
  values (auth.uid(), 'org_invitation.declined', 'organisation_invitations', v_invitation.id);
end;
$$;

revoke all on function public.decline_org_invitation(uuid) from public;
grant execute on function public.decline_org_invitation(uuid) to authenticated;

-- Membership lifecycle actions. An administrator (non-owner) can manage everyone except a fellow
-- administrator — only the true owner can touch an administrator-tier row, same restriction as
-- inviting one in the first place.
create or replace function public.remove_org_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.organisation_members;
begin
  select * into v_member from public.organisation_members where id = p_member_id;
  if not found then
    raise exception 'member not found' using errcode = 'P0001';
  end if;
  if not public.can_manage_org_members(v_member.org_id) then
    raise exception 'you do not have permission to manage members of this organisation' using errcode = 'P0001';
  end if;
  if v_member.member_role in ('owner', 'administrator') and not public.owns_org(v_member.org_id) then
    raise exception 'only the organisation''s owner can remove an owner or administrator' using errcode = 'P0001';
  end if;

  delete from public.organisation_members where id = p_member_id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'org_member.removed', 'organisation_members', p_member_id,
    jsonb_build_object('profile_id', v_member.profile_id, 'role', v_member.member_role), null
  );
end;
$$;

revoke all on function public.remove_org_member(uuid) from public;
grant execute on function public.remove_org_member(uuid) to authenticated;

create or replace function public.set_org_member_status(p_member_id uuid, p_status public.org_member_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.organisation_members;
begin
  select * into v_member from public.organisation_members where id = p_member_id;
  if not found then
    raise exception 'member not found' using errcode = 'P0001';
  end if;
  if not public.can_manage_org_members(v_member.org_id) then
    raise exception 'you do not have permission to manage members of this organisation' using errcode = 'P0001';
  end if;
  if v_member.member_role in ('owner', 'administrator') and not public.owns_org(v_member.org_id) then
    raise exception 'only the organisation''s owner can suspend or restore an owner or administrator' using errcode = 'P0001';
  end if;

  update public.organisation_members set status = p_status where id = p_member_id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'org_member.status_changed', 'organisation_members', p_member_id,
    jsonb_build_object('status', v_member.status), jsonb_build_object('status', p_status)
  );
end;
$$;

revoke all on function public.set_org_member_status(uuid, public.org_member_status) from public;
grant execute on function public.set_org_member_status(uuid, public.org_member_status) to authenticated;

create or replace function public.change_org_member_role(p_member_id uuid, p_new_role public.org_member_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.organisation_members;
begin
  select * into v_member from public.organisation_members where id = p_member_id;
  if not found then
    raise exception 'member not found' using errcode = 'P0001';
  end if;
  if not public.can_manage_org_members(v_member.org_id) then
    raise exception 'you do not have permission to manage members of this organisation' using errcode = 'P0001';
  end if;
  -- Neither the member's current role nor the role they'd be changed to may be owner/administrator
  -- unless the caller is the true owner — prevents both self-escalation and an administrator
  -- quietly demoting a peer administrator out of spite without owner oversight.
  if (v_member.member_role in ('owner', 'administrator') or p_new_role in ('owner', 'administrator'))
     and not public.owns_org(v_member.org_id) then
    raise exception 'only the organisation''s owner can change an owner/administrator role' using errcode = 'P0001';
  end if;

  update public.organisation_members set member_role = p_new_role where id = p_member_id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'org_member.role_changed', 'organisation_members', p_member_id,
    jsonb_build_object('role', v_member.member_role), jsonb_build_object('role', p_new_role)
  );
end;
$$;

revoke all on function public.change_org_member_role(uuid, public.org_member_role) from public;
grant execute on function public.change_org_member_role(uuid, public.org_member_role) to authenticated;

create or replace function public.leave_organisation(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.organisation_members where org_id = p_org_id and profile_id = auth.uid();

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id)
  values (auth.uid(), 'org_member.left', 'organisation_members', p_org_id);
end;
$$;

revoke all on function public.leave_organisation(uuid) from public;
grant execute on function public.leave_organisation(uuid) to authenticated;
