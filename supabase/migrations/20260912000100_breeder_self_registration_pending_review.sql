-- ============================================================================================
-- Replace the 2026-09-11 testing-phase auto-approve with real self-registration: a signed-in user
-- gets a working panel immediately, but the organisation stays verification_status = 'pending'
-- until an admin actually reviews it. This is NOT a revert to the pre-testing-phase flow either —
-- that flow created no organisation at all until approval, so a pending applicant had zero panel
-- access. Product decision 2026-09-12: onboarding should never gate on review, but public
-- visibility and "verified breeder" status still must — see docs/BREEDER_VERIFICATION_AND_TRUST.md.
--
-- Why this is safe: every public-facing table already requires organisations.verification_status
-- = 'approved' before showing anything (animals/litters/parent_dogs/achievements/fundraising/
-- welfare_cases — see 20260101009000_public_listing_query_indexes.sql's own audit note, and
-- buyer_applications' insert policy in 20260101013700_suspended_org_application_lock.sql). So a
-- newly self-registered 'pending' organisation is fully invisible to buyers and the public
-- marketplace from the moment it's created — nothing new needs to be gated, only the org's own
-- starting state needs to stop lying about being 'approved'.
-- ============================================================================================

-- `user_verifications` now needs to know which organisation self-registration already created for
-- it, so approve/reject can act on that same row instead of guessing or creating a duplicate.
alter table public.user_verifications
  add column organisation_id uuid references public.organisations (id);

drop function if exists public.create_and_approve_own_organisation(
  public.org_type, text, text, text, text, text, text, integer, text
);

create or replace function public.create_own_organisation(
  p_org_type public.org_type,
  p_name text,
  p_description text,
  p_city text default null,
  p_country text default null,
  p_association_name text default null,
  p_membership_number text default null,
  p_years_experience integer default null,
  p_website text default null
)
returns table (organisation_id uuid, verification_id uuid, granted_role public.platform_role)
language plpgsql
security definer
set search_path = public
as $$
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
  if p_org_type not in ('kennel', 'foundation', 'shelter') then
    raise exception 'org_type must be kennel, foundation or shelter';
  end if;
  if p_name is null or char_length(trim(p_name)) = 0 then
    raise exception 'name is required';
  end if;

  v_verification_type := case when p_org_type = 'kennel' then 'breeder' else 'organisation' end;
  v_public_location := nullif(concat_ws(', ', p_city, p_country), '');
  v_slug := lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g'))
    || '-' || substr(gen_random_uuid()::text, 1, 8);

  -- 'pending' + is_public = false: exists, has an owner, gives the applicant a working panel, but
  -- is invisible to every public query (see the migration header note) until approved.
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
    else 'foundation_member'
  end;

  -- Active immediately, independent of verification_status — this is the actual fix: panel access
  -- no longer waits on review, only public visibility does.
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
$$;

comment on function public.create_own_organisation is
  'Self-registration: creates an organisation + owner membership + active role immediately (panel '
  'access is unconditional), leaving verification_status/user_verifications.status at ''pending'' '
  'until an admin calls approve_user_verification() or reject_user_verification(). Replaces '
  'create_and_approve_own_organisation() (the 2026-09-11 testing-phase auto-approve, removed here) '
  '-- see docs/BREEDER_VERIFICATION_AND_TRUST.md.';

revoke all on function public.create_own_organisation(
  public.org_type, text, text, text, text, text, text, integer, text
) from public, anon;
grant execute on function public.create_own_organisation(
  public.org_type, text, text, text, text, text, text, integer, text
) to authenticated;

-- approve_user_verification(): self-registration now means the organisation usually already
-- exists (created 'pending' above) by the time an admin reviews it. Branch on organisation_id so
-- approval UPDATEs that row instead of inserting a duplicate; the old insert path is kept for any
-- legacy verification predating this migration that never got an organisation_id.
create or replace function public.approve_user_verification(p_verification_id uuid, p_admin_notes text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ver public.user_verifications;
  v_org_id uuid;
  v_slug text;
  v_org_type public.org_type;
  v_role public.platform_role;
begin
  if not public.is_admin() then
    raise exception 'only admins can approve verifications';
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
$$;

-- New: rejecting a verification previously only ever touched user_verifications.status (fine when
-- no organisation existed yet at pending time). Now that self-registration creates one immediately,
-- rejecting the review must also mark the organisation rejected and revoke the role that
-- create_own_organisation() granted early — otherwise a rejected applicant would keep full panel
-- access forever, indistinguishable from one still awaiting review.
create or replace function public.reject_user_verification(p_verification_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ver public.user_verifications;
  v_org_type public.org_type;
  v_role public.platform_role;
begin
  if not public.is_admin() then
    raise exception 'only admins can reject verifications';
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
      when v_ver.verification_type = 'organisation' then 'foundation_member'
      else null
    end;
    if v_role is not null then
      update public.user_roles set status = 'rejected' where user_id = v_ver.user_id and role = v_role;
    end if;
  end if;
end;
$$;

revoke all on function public.reject_user_verification(uuid, text) from public, anon;
grant execute on function public.reject_user_verification(uuid, text) to authenticated;
