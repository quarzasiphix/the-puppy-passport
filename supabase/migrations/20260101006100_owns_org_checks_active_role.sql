-- Fixes OPEN FINDING #2 (docs/DATABASE_TESTING.md, tests/db/workflows.test.ts "suspending a
-- breeder's role does not revoke their organisation-management access"): owns_org() (role_helpers.sql)
-- only ever checked organisations.owner_user_id — suspending the platform role that actually
-- earned someone their organisation in the first place (approve_user_verification, in
-- user_verifications.sql, is the only path that creates an organisation, and it always also grants
-- a matching platform_role row: 'breeder' for a breeder verification, 'shelter_member' for a
-- shelter-type organisation verification, 'foundation_member' for every other organisation-type
-- verification) had no effect on their ability to keep managing it.
--
-- owner_role_for_org_type() mirrors that exact creation-time mapping. org_type values that
-- approve_user_verification() never actually grants a role for (transport_company, kennel_club,
-- other) return null, so owns_org() falls back to pure ownership for those — unaffected, since
-- there's no role to suspend in the first place.
create or replace function public.owner_role_for_org_type(p_org_type public.org_type)
returns public.platform_role
language sql
immutable
set search_path = public
as $$
  select case
    when p_org_type = 'kennel' then 'breeder'::public.platform_role
    when p_org_type = 'shelter' then 'shelter_member'::public.platform_role
    when p_org_type in ('foundation', 'rescue') then 'foundation_member'::public.platform_role
    else null
  end;
$$;

create or replace function public.owns_org(p_org_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_org_type public.org_type;
  v_required_role public.platform_role;
begin
  select owner_user_id, org_type into v_owner_id, v_org_type
  from public.organisations
  where id = p_org_id;

  if v_owner_id is null or v_owner_id <> auth.uid() then
    return false;
  end if;

  v_required_role := public.owner_role_for_org_type(v_org_type);
  if v_required_role is null then
    return true;
  end if;

  return public.has_role(v_owner_id, v_required_role);
end;
$$;

comment on function public.owns_org(uuid) is
  'True only if the caller owns the organisation row AND (when the org type implies a specific platform role) still holds that role with an active status — so suspending e.g. a breeder role actually revokes kennel-management access instead of leaving it purely ownership-gated.';
