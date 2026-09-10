-- ============================================================================================
-- NOT APPLIED — DRAFT FOR REVIEW (2026-09-10)
-- ============================================================================================
-- Design: docs/KINOLOGICAL_ORGANISATION_REGISTRY.md
--
-- This migration has NOT been run against local or the live `anemalo` project. It is committed
-- as a reviewable artifact only. Do not `supabase db push` / `apply_migration` this file without
-- an explicit decision. It may be split into smaller migrations (_registry / _memberships /
-- _suggestions) before applying.
--
-- Creates a worldwide registry of kennel clubs / cynological federations / breed clubs as a
-- REFERENCE entity, separate from `public.organisations` (the tenant table). Relationships between
-- registries and breeder memberships in them are modelled as their own tables, never as columns
-- or a tree. Trust posture is factual, never judgemental — mirrors the pedigree graph and
-- `organisation_trust_claims`.
-- ============================================================================================

-- ---- enums ---------------------------------------------------------------------------------

create type public.kinological_organisation_type as enum (
  'international_federation',
  'national_registry',
  'kennel_club',
  'breed_club',
  'regional_branch',
  'independent_registry',
  'association'
);

create type public.kinological_organisation_status as enum (
  'active', 'historical', 'merged', 'dissolved'
);

create type public.kinological_organisation_verification as enum (
  'unverified', 'verified', 'disputed'
);

create type public.kinological_relationship_type as enum (
  'member_of',
  'national_member_of',
  'regional_branch_of',
  'affiliated_with',
  'recognized_by'
);

create type public.kinological_relationship_status as enum (
  'asserted', 'verified', 'disputed', 'historical'
);

create type public.kinological_fact_source as enum (
  'anemalo_curated', 'organisation_declared', 'community_suggested', 'document'
);

create type public.breeder_membership_status as enum (
  'breeder_declared', 'document_supplied', 'verified', 'expired', 'disputed'
);

create type public.kinological_suggestion_status as enum (
  'pending_review', 'accepted', 'merged_into_existing', 'rejected'
);

-- ---- kinological_organisations -----------------------------------------------------------

create table public.kinological_organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_localised jsonb not null default '{}'::jsonb,
  short_name text,
  slug text not null unique,
  country text,                          -- null for international bodies (FCI, WUSV)
  region text,                           -- sub-national, for a regional_branch
  organisation_type public.kinological_organisation_type not null,
  official_website text,
  description text,                      -- factual only, no evaluative language
  logo_url text,
  status public.kinological_organisation_status not null default 'active',
  verification_status public.kinological_organisation_verification not null default 'unverified',
  verified_by uuid references public.profiles (id),
  verified_at timestamptz,
  linked_organisation_id uuid references public.organisations (id) on delete set null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kinological_organisations_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create index kinological_organisations_country_idx on public.kinological_organisations (country);
create index kinological_organisations_type_idx on public.kinological_organisations (organisation_type);
create index kinological_organisations_linked_org_idx
  on public.kinological_organisations (linked_organisation_id)
  where linked_organisation_id is not null;

create trigger set_kinological_organisations_updated_at
  before update on public.kinological_organisations
  for each row execute function public.set_updated_at();

alter table public.kinological_organisations enable row level security;

-- Public directory — everyone reads it (this is what the SEO pages render).
create policy "kinological organisations are publicly readable"
  on public.kinological_organisations for select
  to anon, authenticated
  using (true);

-- Canonical writes are staff-only. Community input goes through the suggestions table below.
create policy "admins manage the kinological organisation registry"
  on public.kinological_organisations for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.kinological_organisations to anon, authenticated;
grant insert, update, delete on public.kinological_organisations to authenticated;

-- ---- kinological_organisation_relationships (directional, typed, NOT a tree) ------------

create table public.kinological_organisation_relationships (
  id uuid primary key default gen_random_uuid(),
  from_organisation_id uuid not null references public.kinological_organisations (id) on delete cascade,
  to_organisation_id uuid not null references public.kinological_organisations (id) on delete cascade,
  relationship_type public.kinological_relationship_type not null,
  status public.kinological_relationship_status not null default 'asserted',
  since date,
  until date,
  evidence_note text,
  source public.kinological_fact_source not null default 'anemalo_curated',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kinological_relationship_no_self check (from_organisation_id <> to_organisation_id),
  constraint kinological_relationship_unique unique (from_organisation_id, to_organisation_id, relationship_type)
);

create index kinological_relationship_from_idx on public.kinological_organisation_relationships (from_organisation_id);
create index kinological_relationship_to_idx on public.kinological_organisation_relationships (to_organisation_id);

create trigger set_kinological_relationships_updated_at
  before update on public.kinological_organisation_relationships
  for each row execute function public.set_updated_at();

alter table public.kinological_organisation_relationships enable row level security;

create policy "kinological relationships are publicly readable"
  on public.kinological_organisation_relationships for select
  to anon, authenticated
  using (true);

create policy "admins manage kinological relationships"
  on public.kinological_organisation_relationships for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.kinological_organisation_relationships to anon, authenticated;
grant insert, update, delete on public.kinological_organisation_relationships to authenticated;

-- ---- breeder_organisation_memberships (a claim with a lifecycle, not a column) ----------

create table public.breeder_organisation_memberships (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  kinological_organisation_id uuid not null references public.kinological_organisations (id) on delete cascade,
  membership_number text,
  membership_since date,
  status public.breeder_membership_status not null default 'breeder_declared',
  evidence_note text,
  evidence_source_id uuid references public.pedigree_sources (id) on delete set null,
  declared_by uuid references public.profiles (id),
  verified_by uuid references public.profiles (id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint breeder_org_membership_unique unique (organisation_id, kinological_organisation_id)
);

create index breeder_org_membership_org_idx on public.breeder_organisation_memberships (organisation_id);
create index breeder_org_membership_registry_idx on public.breeder_organisation_memberships (kinological_organisation_id);

create trigger set_breeder_org_memberships_updated_at
  before update on public.breeder_organisation_memberships
  for each row execute function public.set_updated_at();

alter table public.breeder_organisation_memberships enable row level security;

-- Public sees ONLY verified memberships (never a bare breeder claim — don't imply Anemalo vouches).
create policy "public reads verified breeder memberships"
  on public.breeder_organisation_memberships for select
  to anon, authenticated
  using (status = 'verified');

-- A kennel's team manages its own membership rows (claims). Widen to is_org_member() to match the
-- team model in docs/API_GATEWAY_AND_MULTI_TENANT_BREEDERS.md §5 — owner-only here would keep
-- team members from recording an affiliation.
create policy "org members manage their kennel's memberships"
  on public.breeder_organisation_memberships for all
  to authenticated
  using (public.is_org_member(organisation_id))
  with check (public.is_org_member(organisation_id));

-- Only staff can move a row to 'verified' — enforced by trigger, not just RLS row-ownership
-- (mirrors the moderation-status pattern in the social domain).
create or replace function public.prevent_self_verify_breeder_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if new.status = 'verified' and (tg_op = 'INSERT' or old.status is distinct from 'verified') then
    raise exception 'Only Anemalo staff can mark a breeder membership as verified.' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and (new.verified_by is distinct from old.verified_by
      or new.verified_at is distinct from old.verified_at) then
    raise exception 'verified_by / verified_at are set by staff only.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger prevent_self_verify_breeder_membership
  before insert or update on public.breeder_organisation_memberships
  for each row execute function public.prevent_self_verify_breeder_membership();

create policy "admins manage all breeder memberships"
  on public.breeder_organisation_memberships for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.breeder_organisation_memberships to anon, authenticated;
grant insert, update, delete on public.breeder_organisation_memberships to authenticated;

-- ---- kinological_organisation_suggestions (community input; never a canonical write) ----

create table public.kinological_organisation_suggestions (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references public.profiles (id),
  contact_email text,
  proposed_data jsonb not null,
  relationship_hints jsonb,
  status public.kinological_suggestion_status not null default 'pending_review',
  resolved_kinological_organisation_id uuid references public.kinological_organisations (id) on delete set null,
  reviewer_id uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);

create index kinological_suggestion_status_idx on public.kinological_organisation_suggestions (status);

alter table public.kinological_organisation_suggestions enable row level security;

-- Anyone may propose (rate-limiting for anon must live in the gateway / a dedicated IP limiter —
-- public.enforce_rate_limit() no-ops when auth.uid() is null; see
-- docs/API_GATEWAY_AND_MULTI_TENANT_BREEDERS.md §2).
create policy "anyone may suggest a kinological organisation"
  on public.kinological_organisation_suggestions for insert
  to anon, authenticated
  with check (
    (submitted_by is null and auth.uid() is null)
    or submitted_by = auth.uid()
  );

create policy "submitters read their own suggestions"
  on public.kinological_organisation_suggestions for select
  to authenticated
  using (submitted_by = auth.uid() or public.is_admin());

create policy "admins manage all kinological suggestions"
  on public.kinological_organisation_suggestions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant insert on public.kinological_organisation_suggestions to anon, authenticated;
grant select, update, delete on public.kinological_organisation_suggestions to authenticated;

-- ---- pedigree provenance: one additive column, no new table for v1 ---------------------
-- Lets a pedigree source cite the registry that issued the document even when that registry is
-- not an Anemalo tenant. Combined with the existing document_metadata.source_pedigree_number this
-- fully covers "which registry issued this pedigree" — see the design doc's "Pedigree linkage".
-- A per-dog `dog_registry_identifiers` abstraction is DEFERRED (not created here).

alter table public.pedigree_sources
  add column kinological_organisation_id uuid references public.kinological_organisations (id) on delete set null;

create index pedigree_sources_kinological_org_idx
  on public.pedigree_sources (kinological_organisation_id)
  where kinological_organisation_id is not null;

-- ============================================================================================
-- END DRAFT — NOT APPLIED
-- ============================================================================================
