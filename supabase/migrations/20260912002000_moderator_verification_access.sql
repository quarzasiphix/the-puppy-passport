-- ============================================================================================
-- Extend "verifying a new breeder" and "checking a company/dog listing is real" to moderators, not
-- just admins. Until now: approve_user_verification()/reject_user_verification() and
-- approve_rehoming_review() all hard-required is_admin(); rejecting a rehoming review was a plain
-- client UPDATE relying on an is_admin()-only RLS policy; and user_verifications/organisations/
-- rehoming_reviews had no SELECT policy a plain moderator could read through at all (RLS silently
-- returns zero rows rather than erroring, so a moderator opening these pages would just see empty
-- lists, not a permission error). is_admin() staff can still do everything they already could --
-- is_moderator() := has_role(auth.uid(),'moderator') OR is_admin(), so admin is a strict superset.
-- ============================================================================================

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
      when v_ver.verification_type = 'organisation' then 'foundation_member'
      else null
    end;
    if v_role is not null then
      update public.user_roles set status = 'rejected' where user_id = v_ver.user_id and role = v_role;
    end if;
  end if;
end;
$$;

create or replace function public.approve_rehoming_review(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review public.rehoming_reviews;
begin
  if not public.is_moderator() then
    raise exception 'only a moderator or admin can approve a rehoming review' using errcode = 'P0001';
  end if;

  select * into v_review from public.rehoming_reviews where id = p_review_id;
  if not found then
    raise exception 'rehoming review not found' using errcode = 'P0001';
  end if;

  if v_review.admin_status = 'approved' then
    return;
  end if;

  update public.rehoming_reviews
  set admin_status = 'approved', reviewed_at = now()
  where id = p_review_id;

  update public.animals set availability_status = 'available' where id = v_review.animal_id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'rehoming_review.approved', 'rehoming_reviews', p_review_id,
    jsonb_build_object('admin_status', v_review.admin_status),
    jsonb_build_object('admin_status', 'approved')
  );
end;
$$;

-- New: rejecting a rehoming review used to be a plain client UPDATE relying on the is_admin()-only
-- "admins manage all rehoming reviews" FOR ALL policy -- unreachable for a moderator. Same shape
-- as approve above.
create or replace function public.reject_rehoming_review(p_review_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review public.rehoming_reviews;
begin
  if not public.is_moderator() then
    raise exception 'only a moderator or admin can reject a rehoming review' using errcode = 'P0001';
  end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'a rejection reason is required';
  end if;

  select * into v_review from public.rehoming_reviews where id = p_review_id;
  if not found then
    raise exception 'rehoming review not found' using errcode = 'P0001';
  end if;

  update public.rehoming_reviews
  set admin_status = 'rejected', admin_notes = p_reason, reviewed_at = now()
  where id = p_review_id;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'rehoming_review.rejected', 'rehoming_reviews', p_review_id,
    jsonb_build_object('admin_status', v_review.admin_status),
    jsonb_build_object('admin_status', 'rejected', 'reason', p_reason)
  );
end;
$$;

revoke all on function public.reject_rehoming_review(uuid, text) from public, anon;
grant execute on function public.reject_rehoming_review(uuid, text) to authenticated;

-- Read access: RLS silently returns zero rows rather than erroring, so without these a moderator
-- opening the breeder-verification / organisations / listings pages would just see empty lists.
create policy "moderators view all verifications"
  on public.user_verifications for select
  to authenticated
  using (public.is_moderator());

create policy "moderators view all organisations"
  on public.organisations for select
  to authenticated
  using (public.is_moderator());

create policy "moderators view all rehoming reviews"
  on public.rehoming_reviews for select
  to authenticated
  using (public.is_moderator());
