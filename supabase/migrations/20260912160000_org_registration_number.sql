-- Registration-flow overhaul: foundations/shelters get a "registration number (KRS)" field and
-- transport companies get an "operator license number" field, both mapping to the same existing,
-- previously-unused organisations.registration_number column (no new column needed) — reusing the
-- established "one column, per-org-type label" pattern already used for association_name/
-- membership_number. Additive-only change to create_own_organisation(): new trailing optional
-- param, default null, so every existing call site keeps working untouched.
create or replace function public.create_own_organisation(
  p_org_type org_type,
  p_name text,
  p_description text,
  p_city text default null::text,
  p_country text default null::text,
  p_association_name text default null::text,
  p_membership_number text default null::text,
  p_years_experience integer default null::integer,
  p_website text default null::text,
  p_registration_number text default null::text
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
    membership_number, years_experience, registration_number, verification_status, is_public,
    owner_user_id
  ) values (
    p_org_type, p_name, v_slug, p_description, p_country, p_city, v_public_location,
    p_association_name, p_membership_number, p_years_experience, p_registration_number, 'pending',
    false, v_user_id
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
      'years_experience', p_years_experience, 'website', p_website,
      'registration_number', p_registration_number
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

-- `create or replace function` with a different parameter list creates a new overload rather than
-- replacing the old one (Postgres function identity includes the signature) — drop the old 9-arg
-- overload explicitly or both versions live side by side and RPC-by-name calls become ambiguous.
drop function if exists public.create_own_organisation(
  org_type, text, text, text, text, text, text, integer, text
);
