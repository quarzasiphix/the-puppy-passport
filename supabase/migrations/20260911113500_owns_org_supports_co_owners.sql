-- owns_org() previously only recognised organisations.owner_user_id (a single column), so an
-- organisation_members row with member_role = 'owner' granted read access to the organisation
-- itself (via is_org_member()) but NOT to any of the actual business data gated by owns_org()
-- directly (animals, litters, parent_dogs, achievements, reservations, buyer_applications,
-- fundraising_campaigns, organisation_site_configurations, organisation_domains,
-- private_addresses, transport_requests, etc.) — a real gap hit in production 2026-09-11: a
-- second Google-login account for an existing breeder (Gryfin York) was added as an
-- organisation_members co-owner but still saw zero rows on every one of those tables.
--
-- Extend owns_org() to also treat an active organisation_members row with member_role = 'owner'
-- as ownership, and check the platform-role requirement (owner_role_for_org_type) against the
-- calling user rather than always the original owner_user_id, so each co-owner independently
-- needs the matching active platform role (e.g. 'breeder' for a kennel).
create or replace function public.owns_org(p_org_id uuid)
returns boolean
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_owner_id uuid;
  v_org_type public.org_type;
  v_required_role public.platform_role;
  v_caller uuid := auth.uid();
  v_is_owner boolean;
begin
  select owner_user_id, org_type into v_owner_id, v_org_type
  from public.organisations
  where id = p_org_id;

  if v_owner_id is null then
    return false;
  end if;

  v_is_owner := (v_owner_id = v_caller) or exists (
    select 1 from public.organisation_members
    where org_id = p_org_id
      and profile_id = v_caller
      and status = 'active'
      and member_role = 'owner'
  );

  if not v_is_owner then
    return false;
  end if;

  v_required_role := public.owner_role_for_org_type(v_org_type);
  if v_required_role is null then
    return true;
  end if;

  return public.has_role(v_caller, v_required_role);
end;
$function$;
