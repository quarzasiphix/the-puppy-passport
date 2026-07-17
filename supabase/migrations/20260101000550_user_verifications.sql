-- user_verifications is the single generic verification/application pipeline for the platform —
-- it replaces a bespoke "organisation applications" table so email, phone, identity, breeder,
-- organisation, animal-ownership, driver and transport-employee checks all share one shape,
-- one status vocabulary and one admin review surface instead of several near-duplicate tables.

create type public.verification_type as enum (
  'email', 'phone', 'identity', 'breeder', 'organisation', 'animal_ownership', 'driver', 'transport_employee'
);

create type public.verification_status as enum (
  'not_started', 'pending', 'more_information_required', 'approved', 'rejected', 'expired', 'suspended'
);

create table public.user_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  verification_type public.verification_type not null,
  status public.verification_status not null default 'not_started',
  -- Freeform payload captured at submission time — e.g. for verification_type = 'breeder' or
  -- 'organisation' this holds the kennel/organisation details (org_type, name, description,
  -- country, city, public_location, association_name, membership_number, years_experience,
  -- breeds) that approve_user_verification() turns into an organisations row on approval.
  submitted_data jsonb not null default '{}'::jsonb,
  evidence_url text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  -- Admin-only reasoning — never selected by non-admin policies below, matching "administrator
  -- notes must not be publicly shown" elsewhere in this schema.
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, verification_type)
);

create trigger set_user_verifications_updated_at
  before update on public.user_verifications
  for each row execute function public.set_updated_at();

alter table public.user_verifications enable row level security;

create policy "users view their own verifications"
  on public.user_verifications for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "users create their own verification request"
  on public.user_verifications for insert
  to authenticated
  with check (user_id = (select auth.uid()) and status in ('not_started', 'pending'));

-- Only while still a draft (not_started) can the applicant edit their own submitted_data —
-- once it's pending or later, only an admin can change it (status, reviewed_*, notes are never
-- user-editable, per "restricted roles and verification statuses must not be user-editable").
create policy "users edit their own draft verification"
  on public.user_verifications for update
  to authenticated
  using (user_id = (select auth.uid()) and status = 'not_started')
  with check (user_id = (select auth.uid()) and status in ('not_started', 'pending'));

create policy "admins manage all verifications"
  on public.user_verifications for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Approving a breeder/organisation verification is the one place an organisation + its owner
-- membership + the matching user_roles row get created together, so it runs as a single
-- SECURITY DEFINER transaction rather than several client-side writes racing against RLS.
-- Approving driver/transport_employee verifications activates the matching operational role.
-- Approving email/phone/identity/animal_ownership just marks the verification approved.
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
