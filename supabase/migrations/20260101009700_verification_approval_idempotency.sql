-- Stage BC (supplemental queue): organisation verification workflow.
-- approve_user_verification() had no guard against being called twice on the same verification
-- id. For breeder/organisation verifications, the generated slug is deterministic
-- (name + first 8 chars of the verification id), so a second call doesn't silently create a
-- duplicate organisation -- but it does fail with a raw Postgres unique-constraint violation
-- instead of a clean business error, and under genuine concurrency (two admins approving the same
-- pending verification at the same moment) both transactions could read status != 'approved'
-- before either commits and race to the same slug-collision failure. For driver/transport_employee
-- verifications there's no accidental protection at all -- user_roles' `on conflict ... do update`
-- makes a second approval silently idempotent today, which is harmless here but was never a
-- deliberate guarantee, just a side effect of that particular upsert shape.
--
-- Fixed with the same pattern already used in execute_account_deletion() (Stage AI) and
-- change_ops_request_status() (Stage AD): `select ... for update` to lock the row and serialize
-- concurrent callers, then an explicit status check raising a clear error before any
-- side-effecting insert runs, instead of relying on an accidental unique-constraint side effect.
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

  select * into v_ver from public.user_verifications where id = p_verification_id for update;
  if not found then
    raise exception 'verification % not found', p_verification_id;
  end if;

  if v_ver.status = 'approved' then
    raise exception 'This verification has already been approved.'
      using errcode = 'P0001';
  end if;

  if v_ver.verification_type in ('breeder', 'organisation') then
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

    insert into public.organisation_members (org_id, profile_id, member_role)
    values (v_org_id, v_ver.user_id, 'owner');

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
