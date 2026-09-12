-- Transport company org type + verification, extending the existing breeder/foundation/shelter
-- pattern end to end (never inventing a parallel system) — see the approved plan this session
-- ("Transporter verification, fleet multi-tenancy, reservation settlement & disputes").
--
-- `transport_company` has existed as an org_type enum value with zero wiring: no application
-- form, `owner_role_for_org_type()` returned NULL for it, and `approve_user_verification()` had
-- no case for it. This migration is the second half of that fix — the new platform_role value
-- itself (`transport_company_owner`) was added in a prior, separate migration
-- (20260912140000_transport_company_owner_role_enum, applied first) since a newly added enum
-- value cannot be referenced in the same transaction that adds it.
--
-- A distinct role rather than reusing the existing `driver` role: `driver` is already overloaded
-- as the individual freelance mobile-job-workspace role, checked by is_my_driver_id() and
-- job-status-write RLS — reusing it for company owners would either give every owner a mobile job
-- workspace they don't want, or force those checks to special-case context. A separate role keeps
-- that completely untouched.
--
-- Every function below is a `create or replace` of its exact live body (confirmed via
-- pg_get_functiondef immediately before writing this migration), with only a transport_company
-- branch added — never a rewrite of existing behaviour for kennel/foundation/shelter.

create or replace function public.owner_role_for_org_type(p_org_type org_type)
returns platform_role
language sql
immutable
set search_path to 'public'
as $function$
  select case
    when p_org_type = 'kennel' then 'breeder'::public.platform_role
    when p_org_type = 'shelter' then 'shelter_member'::public.platform_role
    when p_org_type in ('foundation', 'rescue') then 'foundation_member'::public.platform_role
    when p_org_type = 'transport_company' then 'transport_company_owner'::public.platform_role
    else null
  end;
$function$;

create or replace function public.create_own_organisation(
  p_org_type org_type,
  p_name text,
  p_description text,
  p_city text default null,
  p_country text default null,
  p_association_name text default null,
  p_membership_number text default null,
  p_years_experience integer default null,
  p_website text default null
)
returns table(organisation_id uuid, verification_id uuid, granted_role platform_role)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_verification_id uuid;
  v_org_id uuid;
  v_slug text;
  v_verification_type public.verification_type;
  v_role public.platform_role;
  v_public_location text;
begin
  if v_user_id is null then
    raise exception 'must be signed in';
  end if;
  if p_org_type not in ('kennel', 'foundation', 'shelter', 'transport_company') then
    raise exception 'org_type must be kennel, foundation, shelter or transport_company';
  end if;
  if p_name is null or char_length(trim(p_name)) = 0 then
    raise exception 'name is required';
  end if;

  v_verification_type := case when p_org_type = 'kennel' then 'breeder' else 'organisation' end;
  v_public_location := nullif(concat_ws(', ', p_city, p_country), '');
  v_slug := lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g'))
    || '-' || substr(gen_random_uuid()::text, 1, 8);

  insert into public.organisations (
    org_type, name, slug, description, country, city, public_location, association_name,
    membership_number, years_experience, verification_status, is_public, owner_user_id
  ) values (
    p_org_type, p_name, v_slug, p_description, p_country, p_city, v_public_location,
    p_association_name, p_membership_number, p_years_experience, 'pending', false, v_user_id
  )
  returning id into v_org_id;

  insert into public.organisation_members (org_id, profile_id, member_role, status)
  values (v_org_id, v_user_id, 'owner', 'active');

  insert into public.user_verifications (
    user_id, verification_type, status, submitted_data, organisation_id
  ) values (
    v_user_id, v_verification_type, 'pending',
    jsonb_build_object(
      'org_type', p_org_type, 'name', p_name, 'description', p_description,
      'city', p_city, 'country', p_country, 'public_location', v_public_location,
      'association_name', p_association_name, 'membership_number', p_membership_number,
      'years_experience', p_years_experience, 'website', p_website
    ),
    v_org_id
  )
  returning id into v_verification_id;

  v_role := case
    when v_verification_type = 'breeder' then 'breeder'
    when p_org_type = 'shelter' then 'shelter_member'
    when p_org_type = 'transport_company' then 'transport_company_owner'
    else 'foundation_member'
  end;

  insert into public.user_roles (user_id, role, status)
  values (v_user_id, v_role, 'active')
  on conflict (user_id, role) do update set status = 'active';

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    v_user_id, 'user_verification.submitted', 'user_verifications', v_verification_id,
    jsonb_build_object('status', null),
    jsonb_build_object('status', 'pending', 'organisation_id', v_org_id, 'granted_role', v_role)
  );

  return query select v_org_id, v_verification_id, v_role;
end;
$function$;

create or replace function public.approve_user_verification(
  p_verification_id uuid,
  p_admin_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ver public.user_verifications;
  v_org_id uuid;
  v_slug text;
  v_org_type public.org_type;
  v_role public.platform_role;
begin
  if not public.is_moderator() then
    raise exception 'only a moderator or admin can approve verifications';
  end if;

  select * into v_ver from public.user_verifications where id = p_verification_id;
  if not found then
    raise exception 'verification % not found', p_verification_id;
  end if;

  if v_ver.verification_type in ('breeder', 'organisation') then
    if v_ver.organisation_id is not null then
      update public.organisations
      set verification_status = 'approved', is_public = true
      where id = v_ver.organisation_id;
      v_org_id := v_ver.organisation_id;
      select org_type into v_org_type from public.organisations where id = v_org_id;
    else
      v_org_type := coalesce((v_ver.submitted_data ->> 'org_type')::public.org_type, 'kennel');
      v_slug := lower(regexp_replace(v_ver.submitted_data ->> 'name', '[^a-zA-Z0-9]+', '-', 'g'))
        || '-' || substr(v_ver.id::text, 1, 8);

      insert into public.organisations (
        org_type, name, slug, description, country, city, public_location, association_name,
        membership_number, years_experience, verification_status, is_public, owner_user_id
      ) values (
        v_org_type, v_ver.submitted_data ->> 'name', v_slug, v_ver.submitted_data ->> 'description',
        v_ver.submitted_data ->> 'country', v_ver.submitted_data ->> 'city',
        v_ver.submitted_data ->> 'public_location', v_ver.submitted_data ->> 'association_name',
        v_ver.submitted_data ->> 'membership_number',
        nullif(v_ver.submitted_data ->> 'years_experience', '')::integer,
        'approved', true, v_ver.user_id
      )
      returning id into v_org_id;

      insert into public.organisation_members (org_id, profile_id, member_role, status)
      values (v_org_id, v_ver.user_id, 'owner', 'active');
    end if;

    v_role := case
      when v_ver.verification_type = 'breeder' then 'breeder'
      when v_org_type = 'shelter' then 'shelter_member'
      when v_org_type = 'transport_company' then 'transport_company_owner'
      else 'foundation_member'
    end;
  elsif v_ver.verification_type = 'driver' then
    v_role := 'driver';
  elsif v_ver.verification_type = 'transport_employee' then
    v_role := 'operations';
  else
    v_role := null;
  end if;

  if v_role is not null then
    insert into public.user_roles (user_id, role, status)
    values (v_ver.user_id, v_role, 'active')
    on conflict (user_id, role) do update set status = 'active';
  end if;

  update public.user_verifications
  set status = 'approved', notes = coalesce(p_admin_notes, notes), reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_verification_id;

  return v_org_id;
end;
$function$;

create or replace function public.reject_user_verification(p_verification_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ver public.user_verifications;
  v_org_type public.org_type;
  v_role public.platform_role;
begin
  if not public.is_moderator() then
    raise exception 'only a moderator or admin can reject verifications';
  end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'a rejection reason is required';
  end if;

  select * into v_ver from public.user_verifications where id = p_verification_id;
  if not found then
    raise exception 'verification % not found', p_verification_id;
  end if;

  update public.user_verifications
  set status = 'rejected', notes = p_reason, reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_verification_id;

  if v_ver.organisation_id is not null then
    update public.organisations set verification_status = 'rejected' where id = v_ver.organisation_id;

    select org_type into v_org_type from public.organisations where id = v_ver.organisation_id;
    v_role := case
      when v_ver.verification_type = 'breeder' then 'breeder'
      when v_org_type = 'shelter' then 'shelter_member'
      when v_org_type = 'transport_company' then 'transport_company_owner'
      when v_ver.verification_type = 'organisation' then 'foundation_member'
      else null
    end;
    if v_role is not null then
      update public.user_roles set status = 'rejected' where user_id = v_ver.user_id and role = v_role;
    end if;
  end if;
end;
$function$;

-- Defense-in-depth (not load-bearing — the RPCs above are security definer): every other
-- org-owner pending role is already listed in this self-apply policy, so list this one too for
-- consistency, in case a future direct-insert code path ever bypasses the RPC.
drop policy if exists "users self-apply for unrestricted or pending roles" on public.user_roles;
create policy "users self-apply for unrestricted or pending roles"
  on public.user_roles for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      (role in ('customer', 'buyer', 'animal_owner') and status = 'active')
      or (role in ('breeder', 'foundation_member', 'shelter_member', 'operations', 'transport_company_owner') and status = 'pending')
    )
  );
