-- ============================================================================================
-- TEMPORARY, TESTING-PHASE RELAXATION — auto-approve breeder/foundation/shelter applications.
-- ============================================================================================
-- User decision 2026-09-11: "for now" there is no breeder verification review step — the goal
-- right now is making the onboarding/registration flow itself work end-to-end, not gatekeeping
-- who can publish a kennel. `approve_user_verification()` (admin-only, requires is_admin()) is
-- left completely untouched, still callable, still the real review path for whenever manual
-- verification comes back. This migration ADDS a second, parallel path a normal signed-in user
-- can call on THEIR OWN application; it does not remove or weaken anything else. Reverting this
-- relaxation later = drop `create_and_approve_own_organisation`, point create-breeder.tsx back at
-- a plain `user_verifications` insert (status='pending') and let admins approve manually again.
--
-- `create_and_approve_own_organisation()` does, atomically, everything
-- `/create-breeder`'s form used to just start (insert a pending user_verifications row) AND
-- everything `approve_user_verification()` does for the org side (create the organisation,
-- membership, role), minus the is_admin() gate — scoped to auth.uid() = the caller, so a user can
-- only ever approve their own application, never someone else's.

create or replace function public.create_and_approve_own_organisation(
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
  v_slug := lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g'));

  insert into public.user_verifications (
    user_id, verification_type, status, submitted_data, notes, reviewed_at
  ) values (
    v_user_id, v_verification_type, 'approved',
    jsonb_build_object(
      'org_type', p_org_type, 'name', p_name, 'description', p_description,
      'city', p_city, 'country', p_country, 'public_location', v_public_location,
      'association_name', p_association_name, 'membership_number', p_membership_number,
      'years_experience', p_years_experience, 'website', p_website
    ),
    'Auto-approved (testing phase — no manual breeder/organisation verification review is active; '
    || 'see supabase/migrations/20260911000200_self_approve_org_application_testing_phase.sql).',
    now()
  )
  returning id into v_verification_id;

  insert into public.organisations (
    org_type, name, slug, description, country, city, public_location, association_name,
    membership_number, years_experience, verification_status, is_public, owner_user_id
  ) values (
    p_org_type, p_name, v_slug || '-' || substr(v_verification_id::text, 1, 8), p_description,
    p_country, p_city, v_public_location, p_association_name, p_membership_number,
    p_years_experience, 'approved', true, v_user_id
  )
  returning id into v_org_id;

  insert into public.organisation_members (org_id, profile_id, member_role, status)
  values (v_org_id, v_user_id, 'owner', 'active');

  v_role := case
    when v_verification_type = 'breeder' then 'breeder'
    when p_org_type = 'shelter' then 'shelter_member'
    else 'foundation_member'
  end;

  insert into public.user_roles (user_id, role, status)
  values (v_user_id, v_role, 'active')
  on conflict (user_id, role) do update set status = 'active';

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    v_user_id, 'user_verification.approved', 'user_verifications', v_verification_id,
    jsonb_build_object('status', null),
    jsonb_build_object(
      'status', 'approved', 'organisation_id', v_org_id, 'granted_role', v_role,
      'method', 'self_approved_testing_phase'
    )
  );

  return query select v_org_id, v_verification_id, v_role;
end;
$$;

comment on function public.create_and_approve_own_organisation is
  'TEMPORARY testing-phase relaxation: a signed-in user submits + immediately becomes an approved '
  'owner of their own kennel/foundation/shelter, bypassing admin review. Scoped to auth.uid() — '
  'can never act on someone else''s application. Revert by dropping this function once manual '
  'verification review comes back; approve_user_verification() (admin-gated) is untouched.';

revoke all on function public.create_and_approve_own_organisation(
  public.org_type, text, text, text, text, text, text, integer, text
) from public, anon;
grant execute on function public.create_and_approve_own_organisation(
  public.org_type, text, text, text, text, text, text, integer, text
) to authenticated;
