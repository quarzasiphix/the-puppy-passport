-- Public collaborative pedigree graph, part 1: schema.
--
-- Design summary (see docs/DEFERRED_BACKEND.md "Public pedigrees" and docs/POK_INTEGRATION.md,
-- both written ahead of this migration specifically for this shape; domains/pedigrees/types.ts's
-- PedigreeVerificationLevel/PedigreeAssertionSource enums are reused verbatim below):
--
--   dogs                          -- permanent dog identity, independent of any marketplace listing
--   dog_parent_relationships      -- sire/dam edges between dogs, with a verification_level
--   pedigree_sources              -- an individual piece of evidence (upload, declaration, ...)
--   pedigree_relationship_sources -- M:N: which source(s) support which relationship edge
--   pedigree_submissions          -- one "Add pedigree" contribution attempt (upload/manual/build)
--   pedigree_submission_resolutions -- per-ancestor-slot decisions made while reviewing a submission
--   dog_match_candidates          -- surfaced possible-duplicate dogs for a submission slot (audit trail)
--   dog_claims                    -- "is this your dog / kennel" — owner/breeder claims, reviewed separately
--
-- `parent_dogs` and `animals` are NOT replaced — they remain the breeder-owned-breeding-stock and
-- marketplace-listing tables respectively. Each gets a nullable `dog_id` pointing at this new
-- umbrella `dogs` table: a dog's permanent identity is a superset of "is breeding stock" and "is a
-- marketplace listing", not the same thing as either. A historical/foreign/deceased ancestor known
-- only from a pedigree document gets a `dogs` row with no `parent_dogs`/`animals` row at all.
--
-- POK comparison (docs/POK_INTEGRATION.md): POK's `dogs_registry` has plain self-referencing
-- father_id/mother_id because POK itself is the single registry authority — one canonical parent
-- per role is always correct there. Anemalo is crowdsourced and multi-source, so parentage here is
-- its own table (`dog_parent_relationships`) with a verification_level and an M:N join to
-- potentially multiple corroborating `pedigree_sources` rows, and a real conflict state
-- ('disputed') for when two sources disagree — POK has no equivalent, because POK does not accept
-- competing public submissions. POK's `source_pedigrees` (added 2026-08-18, `unique(dog_id)`) is
-- the closest existing analogue to `pedigree_sources` here, generalized: many sources per dog (via
-- many relationships), not one, and source_type spans more than "external registry pedigree".

-- ── Enums ────────────────────────────────────────────────────────────────────────────────────

create type public.dog_life_status as enum ('unknown', 'alive', 'deceased');

create type public.pedigree_parent_role as enum ('sire', 'dam');

-- Matches domains/pedigrees/types.ts PedigreeAssertionSource, widened with the upload-format and
-- future-evidence values the product brief calls for (dna_evidence, association_import).
create type public.pedigree_source_type as enum (
  'uploaded_scan', 'uploaded_pdf', 'uploaded_photo', 'registry_record', 'breeder_declaration',
  'owner_declaration', 'community_contribution', 'dna_evidence', 'association_import', 'system_import'
);

-- Matches domains/pedigrees/types.ts PedigreeVerificationLevel exactly — do not add/remove values
-- here without updating that file, the badge copy is written against this exact list.
create type public.pedigree_verification_level as enum (
  'unverified', 'community_supported', 'document_supported', 'breeder_confirmed',
  'registry_verified', 'disputed'
);

create type public.pedigree_source_review_state as enum ('pending', 'accepted', 'rejected');

create type public.pedigree_submission_method as enum ('upload', 'manual_entry', 'build_from_existing');

create type public.pedigree_submission_status as enum ('pending_review', 'accepted', 'rejected');

create type public.dog_claim_type as enum ('owner', 'breeder');

create type public.dog_claim_status as enum ('pending', 'approved', 'rejected');

-- ── dogs: permanent identity ────────────────────────────────────────────────────────────────

create table public.dogs (
  id uuid primary key default gen_random_uuid(),
  registered_name text not null,
  call_name text,
  sex public.dog_sex,
  breed_id uuid references public.breeds (id),
  date_of_birth date,
  date_of_death date,
  life_status public.dog_life_status not null default 'unknown',
  color text,
  pedigree_number text,
  microchip_number text,
  country_of_origin text,
  -- Free-text kennel/prefix as printed on a source document — kept even when it does not (yet)
  -- match a real organisations row, e.g. a foreign or historical kennel. kennel_id is only set
  -- once/if that kennel is matched to (or claimed as) a real Anemalo organisation.
  kennel_name text,
  kennel_id uuid references public.organisations (id),
  current_owner_profile_id uuid references public.profiles (id),
  description text,
  profile_image_url text,
  titles text,
  health_tests jsonb not null default '[]'::jsonb,
  slug text unique,
  -- Hidden nodes (e.g. an admin-actioned bad/spam entry) never show publicly, but the row and its
  -- history are kept — "never delete history".
  is_public boolean not null default true,
  created_by uuid references public.profiles (id),
  created_via public.pedigree_source_type,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dogs_registered_name_not_blank check (btrim(registered_name) <> '')
);

create trigger set_dogs_updated_at
  before update on public.dogs
  for each row execute function public.set_updated_at();

create or replace function public.set_dog_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null then
    new.slug := lower(regexp_replace(coalesce(nullif(btrim(new.registered_name), ''), 'dog'), '[^a-zA-Z0-9]+', '-', 'g'))
      || '-' || substr(new.id::text, 1, 8);
  end if;
  return new;
end;
$$;

create trigger set_dog_slug
  before insert on public.dogs
  for each row execute function public.set_dog_slug();

create index dogs_breed_id_idx on public.dogs (breed_id);
create index dogs_kennel_id_idx on public.dogs (kennel_id);
create index dogs_pedigree_number_idx on public.dogs (lower(pedigree_number));
create index dogs_registered_name_trgm_idx
  on public.dogs using gin (lower(registered_name) extensions.gin_trgm_ops);

-- ── dog_parent_relationships: the canonical, provenance-carrying pedigree edges ────────────────

create table public.dog_parent_relationships (
  id uuid primary key default gen_random_uuid(),
  child_dog_id uuid not null references public.dogs (id) on delete cascade,
  parent_dog_id uuid not null references public.dogs (id) on delete cascade,
  role public.pedigree_parent_role not null,
  verification_level public.pedigree_verification_level not null default 'unverified',
  -- 'active' = the canonical edge shown on the public tree; 'disputed' = two sources disagreed on
  -- this child+role, surfaced but neither picked automatically (never a silent fuzzy merge);
  -- 'rejected' = a moderator determined the edge is wrong.
  status text not null default 'active' check (status in ('active', 'disputed', 'rejected')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dog_parent_relationships_not_self check (child_dog_id <> parent_dog_id)
);

-- At most one *active* sire and one *active* dam per dog — a second, different claim for the same
-- role does not overwrite this; see upsert_parent_relationship() below, which instead moves both
-- rows to 'disputed'. A second source that names the *same* parent just attaches to this same row
-- (pedigree_relationship_sources is the M:N side of "multiple sources, one relationship").
create unique index dog_parent_relationships_active_unique
  on public.dog_parent_relationships (child_dog_id, role)
  where status = 'active';

create index dog_parent_relationships_child_idx on public.dog_parent_relationships (child_dog_id);
create index dog_parent_relationships_parent_idx on public.dog_parent_relationships (parent_dog_id);

create trigger set_dog_parent_relationships_updated_at
  before update on public.dog_parent_relationships
  for each row execute function public.set_updated_at();

-- ── pedigree_submissions: one "Add pedigree" contribution attempt ─────────────────────────────

create table public.pedigree_submissions (
  id uuid primary key default gen_random_uuid(),
  -- null = anonymous visitor (see docs — anonymous may submit, never a direct canonical write).
  submitted_by uuid references public.profiles (id),
  contact_email text,
  method public.pedigree_submission_method not null,
  -- Set only when submitted from a breeder's kennel panel — create_pedigree_submission() verifies
  -- ownership before allowing this to be set, never trust a client-supplied org id blindly.
  submitted_org_id uuid references public.organisations (id),
  subject_dog_id uuid references public.dogs (id),
  status public.pedigree_submission_status not null default 'pending_review',
  -- OCR/AI extraction is intentionally not wired (see docs/DEFERRED_BACKEND.md and the product
  -- brief: "do not fake OCR"). Always 'not_available' until a real extraction pipeline exists —
  -- the UI must say so honestly and route straight to manual review.
  extraction_state text not null default 'not_available',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id),
  rejected_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pedigree_submissions_org_requires_owner check (
    submitted_org_id is null or submitted_by is not null
  )
);

create trigger set_pedigree_submissions_updated_at
  before update on public.pedigree_submissions
  for each row execute function public.set_updated_at();

create index pedigree_submissions_submitted_by_idx on public.pedigree_submissions (submitted_by);

-- ── pedigree_sources: one piece of evidence ────────────────────────────────────────────────────
-- A submission always has exactly one paired source row (created together by
-- create_pedigree_submission — see part 2), which may or may not carry an uploaded document.
-- Sources can also later be produced outside any submission (e.g. a future registry import job),
-- hence submission_id is nullable rather than required.

create table public.pedigree_sources (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references public.pedigree_submissions (id) on delete cascade,
  source_type public.pedigree_source_type not null,
  submitted_by uuid references public.profiles (id),
  contact_email text,
  organisation_id uuid references public.organisations (id),
  submitted_at timestamptz not null default now(),
  -- Private original — bucket 'pedigree-sources', path `{submission_id}/{filename}`. Never
  -- exposed directly to anon/authenticated selects; only a short-lived signed URL, generated for
  -- the submitter/staff on demand (src/lib/storage/media.ts getSignedFileUrl).
  document_bucket text,
  document_path text,
  document_mime_type text,
  document_metadata jsonb not null default '{}'::jsonb,
  -- Optional safe/redacted derivative, same bucket — not produced by any automated process in
  -- this pass (see POK's manual canvas-redaction tool, SourcePedigreeRedactor.tsx, for the kind of
  -- human-in-the-loop tool a future pass could adapt). Column exists so a later pass can populate
  -- it without another migration.
  public_redacted_path text,
  review_state public.pedigree_source_review_state not null default 'pending',
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index pedigree_sources_submission_idx on public.pedigree_sources (submission_id);
create index pedigree_sources_submitted_by_idx on public.pedigree_sources (submitted_by);

-- ── pedigree_relationship_sources: M:N, "why do we believe this edge" ─────────────────────────

create table public.pedigree_relationship_sources (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null references public.dog_parent_relationships (id) on delete cascade,
  source_id uuid not null references public.pedigree_sources (id) on delete cascade,
  submission_id uuid references public.pedigree_submissions (id),
  created_at timestamptz not null default now(),
  unique (relationship_id, source_id)
);

create index pedigree_relationship_sources_relationship_idx
  on public.pedigree_relationship_sources (relationship_id);

-- ── pedigree_submission_resolutions: per-ancestor-slot review decisions ────────────────────────
-- slot_key '' = the subject dog itself; 'sire' / 'dam' = parents; 'sire.dam' = the sire's dam;
-- etc. — an arbitrary-depth dot path of 'sire'/'dam' segments, matching how the review UI walks
-- the tree. A slot must be resolved before any slot one level deeper can reference it as a parent
-- (enforced in resolve_pedigree_slot, not just by client ordering).

create table public.pedigree_submission_resolutions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.pedigree_submissions (id) on delete cascade,
  slot_key text not null,
  role public.pedigree_parent_role,
  resolved_dog_id uuid references public.dogs (id),
  action text not null check (action in ('use_existing', 'create_new', 'skip')),
  created_at timestamptz not null default now(),
  unique (submission_id, slot_key)
);

-- ── dog_match_candidates: audit trail of what the matcher surfaced ────────────────────────────

create table public.dog_match_candidates (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.pedigree_submissions (id) on delete cascade,
  slot_key text not null,
  candidate_dog_id uuid not null references public.dogs (id),
  matched_on text[] not null default '{}',
  confidence numeric(4, 3) not null default 0,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'confirmed_duplicate', 'confirmed_distinct')),
  created_at timestamptz not null default now()
);

create index dog_match_candidates_submission_idx on public.dog_match_candidates (submission_id);

-- ── dog_claims: "is this your dog / kennel" ────────────────────────────────────────────────────
-- Deliberately separate from ownership/creation: claiming never grants edit rights over verified
-- pedigree history by itself — see docs/DEFERRED_BACKEND.md and the product brief's "keep owner,
-- breeder, record contributor, source authority as separate concepts."

create table public.dog_claims (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  claimant_profile_id uuid not null references public.profiles (id),
  claim_type public.dog_claim_type not null,
  -- Set for claim_type = 'breeder' ("this is my kennel's dog") — a future step toward "claim
  -- kennel" (see docs/DEFERRED_BACKEND.md and the migration's part-2 comment on claim_dog()).
  organisation_id uuid references public.organisations (id),
  message text,
  status public.dog_claim_status not null default 'pending',
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (dog_id, claimant_profile_id, claim_type)
);

create index dog_claims_dog_idx on public.dog_claims (dog_id);

-- ── Link parent_dogs / animals up to the new permanent-identity table ─────────────────────────

alter table public.parent_dogs add column dog_id uuid references public.dogs (id);
create unique index parent_dogs_dog_id_key on public.parent_dogs (dog_id) where dog_id is not null;

alter table public.animals add column dog_id uuid references public.dogs (id);
create unique index animals_dog_id_key on public.animals (dog_id) where dog_id is not null;

-- Caches the one auto-generated "breeder declared this via their own litter record" source per
-- litter (see sync_litter_pedigree_source() below) so every puppy in the litter attaches to the
-- same source row instead of minting a duplicate one per puppy.
alter table public.litters add column auto_pedigree_source_id uuid references public.pedigree_sources (id);

-- ── Core relationship functions (used by both triggers below and the RPCs in part 2) ──────────

create or replace function public.recompute_dog_parent_relationship_verification(p_relationship_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_level public.pedigree_verification_level := 'unverified';
begin
  select status into v_status from public.dog_parent_relationships where id = p_relationship_id;
  if v_status is null then
    return;
  end if;

  if v_status = 'disputed' then
    update public.dog_parent_relationships
      set verification_level = 'disputed', updated_at = now()
      where id = p_relationship_id;
    return;
  end if;

  if exists (
    select 1
    from public.pedigree_relationship_sources prs
    join public.pedigree_sources ps on ps.id = prs.source_id
    join public.organisations o on o.id = ps.organisation_id
    where prs.relationship_id = p_relationship_id
      and ps.source_type = 'registry_record'
      and ps.review_state = 'accepted'
      and o.org_type = 'kennel_club'
  ) then
    v_level := 'registry_verified';
  elsif exists (
    select 1
    from public.pedigree_relationship_sources prs
    join public.pedigree_sources ps on ps.id = prs.source_id
    where prs.relationship_id = p_relationship_id
      and ps.organisation_id is not null
      and ps.submitted_by is not null
      and ps.source_type in ('breeder_declaration', 'uploaded_scan', 'uploaded_pdf', 'uploaded_photo')
  ) then
    v_level := 'breeder_confirmed';
  elsif exists (
    select 1
    from public.pedigree_relationship_sources prs
    join public.pedigree_sources ps on ps.id = prs.source_id
    where prs.relationship_id = p_relationship_id
      and ps.source_type in ('uploaded_scan', 'uploaded_pdf', 'uploaded_photo')
  ) then
    v_level := 'document_supported';
  elsif exists (
    select 1 from public.pedigree_relationship_sources prs where prs.relationship_id = p_relationship_id
  ) then
    v_level := 'community_supported';
  end if;

  update public.dog_parent_relationships
    set verification_level = v_level, updated_at = now()
    where id = p_relationship_id;
end;
$$;

revoke all on function public.recompute_dog_parent_relationship_verification(uuid) from public, anon, authenticated;

create or replace function public.trg_recompute_relationship_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_dog_parent_relationship_verification(old.relationship_id);
    return old;
  else
    perform public.recompute_dog_parent_relationship_verification(new.relationship_id);
    return new;
  end if;
end;
$$;

create trigger recompute_relationship_verification_after_source_change
  after insert or delete on public.pedigree_relationship_sources
  for each row execute function public.trg_recompute_relationship_verification();

-- Insert-or-attach-or-dispute. Never silently overwrites a different existing active parent for
-- the same child+role — that becomes a reviewable 'disputed' pair instead (see the partial unique
-- index above). A second source naming the *same* parent just attaches (multi-source corroboration
-- is the whole point — "two independent pedigree documents may support the same relationship").
create or replace function public.upsert_parent_relationship(
  p_child_dog_id uuid,
  p_parent_dog_id uuid,
  p_role public.pedigree_parent_role,
  p_source_id uuid,
  p_submission_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rel_id uuid;
  v_existing_parent uuid;
begin
  if p_child_dog_id = p_parent_dog_id then
    raise exception 'A dog cannot be its own parent.';
  end if;

  select id, parent_dog_id into v_rel_id, v_existing_parent
  from public.dog_parent_relationships
  where child_dog_id = p_child_dog_id and role = p_role and status = 'active'
  limit 1;

  if v_rel_id is null then
    insert into public.dog_parent_relationships (child_dog_id, parent_dog_id, role, created_by)
    values (p_child_dog_id, p_parent_dog_id, p_role, auth.uid())
    returning id into v_rel_id;
  elsif v_existing_parent is distinct from p_parent_dog_id then
    update public.dog_parent_relationships
      set status = 'disputed', updated_at = now()
      where id = v_rel_id;
    perform public.recompute_dog_parent_relationship_verification(v_rel_id);
    insert into public.dog_parent_relationships (child_dog_id, parent_dog_id, role, status, created_by)
    values (p_child_dog_id, p_parent_dog_id, p_role, 'disputed', auth.uid())
    returning id into v_rel_id;
  end if;

  if p_source_id is not null then
    insert into public.pedigree_relationship_sources (relationship_id, source_id, submission_id)
    values (v_rel_id, p_source_id, p_submission_id)
    on conflict (relationship_id, source_id) do nothing;
  end if;

  perform public.recompute_dog_parent_relationship_verification(v_rel_id);
  return v_rel_id;
end;
$$;

revoke all on function public.upsert_parent_relationship(
  uuid, uuid, public.pedigree_parent_role, uuid, uuid
) from public, anon, authenticated;

-- ── Auto-create a dogs row for every parent_dogs / animals row ────────────────────────────────
-- "Enter information once and reuse it everywhere": a breeder's existing breeding-stock and
-- marketplace records automatically get a permanent pedigree-graph identity with no extra step.

create or replace function public.trg_create_dog_for_parent_dog()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dog_id uuid;
begin
  if new.dog_id is not null then
    return new;
  end if;
  insert into public.dogs (
    registered_name, call_name, sex, breed_id, date_of_birth, color, pedigree_number,
    microchip_number, kennel_id, profile_image_url, health_tests, titles, life_status,
    created_by, created_via
  ) values (
    new.registered_name, new.call_name, new.sex, new.breed_id, new.date_of_birth, new.color,
    new.pedigree_number, new.microchip_number, new.kennel_id, new.profile_image_url,
    coalesce(new.health_tests, '[]'::jsonb), new.titles,
    case when new.is_active then 'alive' else 'unknown' end,
    auth.uid(), 'breeder_declaration'
  )
  returning id into v_dog_id;
  new.dog_id := v_dog_id;
  return new;
end;
$$;

create trigger create_dog_for_parent_dog
  before insert on public.parent_dogs
  for each row execute function public.trg_create_dog_for_parent_dog();

create or replace function public.trg_create_dog_for_animal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dog_id uuid;
  v_source public.pedigree_source_type;
begin
  if new.dog_id is not null then
    return new;
  end if;
  v_source := case when new.organization_id is not null then 'breeder_declaration' else 'owner_declaration' end;
  insert into public.dogs (
    registered_name, sex, breed_id, date_of_birth, color, microchip_number, kennel_id,
    current_owner_profile_id, health_tests, life_status, created_by, created_via
  ) values (
    new.name, new.sex, new.breed_id, new.date_of_birth, new.color, new.microchip_number,
    new.organization_id, new.owner_profile_id, coalesce(new.health_tests, '[]'::jsonb),
    'alive', auth.uid(), v_source
  )
  returning id into v_dog_id;
  new.dog_id := v_dog_id;
  return new;
end;
$$;

create trigger create_dog_for_animal
  before insert on public.animals
  for each row execute function public.trg_create_dog_for_animal();

-- ── Auto-inherit sire/dam from the litter record onto every puppy's dog identity ───────────────
-- The core "enter once, reuse everywhere" requirement: a breeder who already has Luna and Max
-- (with their own dogs rows) and creates a litter between them never has to upload/re-declare that
-- pedigree per puppy — every animal born into that litter gets the same two relationship edges
-- automatically, sourced as the breeder's own declaration (breeder_confirmed).

create or replace function public.sync_litter_pedigree_source(p_litter_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_litter public.litters;
  v_owner uuid;
  v_source_id uuid;
begin
  select * into v_litter from public.litters where id = p_litter_id;
  if v_litter.auto_pedigree_source_id is not null then
    return v_litter.auto_pedigree_source_id;
  end if;

  select owner_user_id into v_owner from public.organisations where id = v_litter.kennel_id;

  insert into public.pedigree_sources (source_type, submitted_by, organisation_id, document_metadata)
  values (
    'breeder_declaration', v_owner, v_litter.kennel_id,
    jsonb_build_object('auto_generated_from', 'litter', 'litter_id', p_litter_id)
  )
  returning id into v_source_id;

  update public.litters set auto_pedigree_source_id = v_source_id where id = p_litter_id;
  return v_source_id;
end;
$$;

revoke all on function public.sync_litter_pedigree_source(uuid) from public, anon, authenticated;

create or replace function public.sync_animal_parent_relationships(p_animal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_animal public.animals;
  v_litter public.litters;
  v_father_dog uuid;
  v_mother_dog uuid;
  v_source uuid;
begin
  select * into v_animal from public.animals where id = p_animal_id;
  if v_animal.id is null or v_animal.dog_id is null or v_animal.litter_id is null then
    return;
  end if;

  select * into v_litter from public.litters where id = v_animal.litter_id;
  if v_litter.id is null or (v_litter.father_id is null and v_litter.mother_id is null) then
    return;
  end if;

  v_source := public.sync_litter_pedigree_source(v_litter.id);

  if v_litter.father_id is not null then
    select dog_id into v_father_dog from public.parent_dogs where id = v_litter.father_id;
    if v_father_dog is not null then
      perform public.upsert_parent_relationship(v_animal.dog_id, v_father_dog, 'sire', v_source, null);
    end if;
  end if;

  if v_litter.mother_id is not null then
    select dog_id into v_mother_dog from public.parent_dogs where id = v_litter.mother_id;
    if v_mother_dog is not null then
      perform public.upsert_parent_relationship(v_animal.dog_id, v_mother_dog, 'dam', v_source, null);
    end if;
  end if;
end;
$$;

revoke all on function public.sync_animal_parent_relationships(uuid) from public, anon, authenticated;

create or replace function public.trg_sync_animal_parent_relationships()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_animal_parent_relationships(new.id);
  return new;
end;
$$;

create trigger sync_animal_pedigree_after_write
  after insert or update of litter_id, dog_id on public.animals
  for each row execute function public.trg_sync_animal_parent_relationships();

-- Also re-sync every puppy already in a litter if the litter's parents are set/changed afterwards
-- (a breeder can add puppies to a litter before picking its mother/father).
create or replace function public.trg_sync_litter_animals_parent_relationships()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_animal_id uuid;
begin
  for v_animal_id in select id from public.animals where litter_id = new.id loop
    perform public.sync_animal_parent_relationships(v_animal_id);
  end loop;
  return new;
end;
$$;

create trigger sync_litter_animals_after_parent_update
  after update of mother_id, father_id on public.litters
  for each row execute function public.trg_sync_litter_animals_parent_relationships();

-- ── Backfill: every existing parent_dogs / animals row gets a dogs row (BEFORE INSERT triggers
-- only fire on new rows), and every existing litter->puppy relationship gets synced. Real,
-- data-driven — not a stub — this is what makes today's already-published litters show a pedigree
-- immediately.

do $$
declare
  r record;
  v_dog_id uuid;
begin
  for r in select * from public.parent_dogs where dog_id is null loop
    insert into public.dogs (
      registered_name, call_name, sex, breed_id, date_of_birth, color, pedigree_number,
      microchip_number, kennel_id, profile_image_url, health_tests, titles, life_status, created_via
    ) values (
      r.registered_name, r.call_name, r.sex, r.breed_id, r.date_of_birth, r.color, r.pedigree_number,
      r.microchip_number, r.kennel_id, r.profile_image_url, coalesce(r.health_tests, '[]'::jsonb),
      r.titles, case when r.is_active then 'alive' else 'unknown' end, 'system_import'
    )
    returning id into v_dog_id;
    update public.parent_dogs set dog_id = v_dog_id where id = r.id;
  end loop;

  for r in select * from public.animals where dog_id is null loop
    insert into public.dogs (
      registered_name, sex, breed_id, date_of_birth, color, microchip_number, kennel_id,
      current_owner_profile_id, health_tests, life_status, created_via
    ) values (
      r.name, r.sex, r.breed_id, r.date_of_birth, r.color, r.microchip_number, r.organization_id,
      r.owner_profile_id, coalesce(r.health_tests, '[]'::jsonb), 'alive', 'system_import'
    )
    returning id into v_dog_id;
    update public.animals set dog_id = v_dog_id where id = r.id;
  end loop;

  for r in select id from public.animals where litter_id is not null loop
    perform public.sync_animal_parent_relationships(r.id);
  end loop;
end $$;

-- ── RLS ─────────────────────────────────────────────────────────────────────────────────────
-- Nothing below grants authenticated/anon direct INSERT/UPDATE on dogs or
-- dog_parent_relationships — every mutation goes through the SECURITY DEFINER triggers above or
-- the RPCs in part 2, which is what makes "anonymous/authenticated never gets unrestricted
-- canonical write access" a database-enforced fact, not just a UI convention.

alter table public.dogs enable row level security;
alter table public.dog_parent_relationships enable row level security;
alter table public.pedigree_sources enable row level security;
alter table public.pedigree_relationship_sources enable row level security;
alter table public.pedigree_submissions enable row level security;
alter table public.pedigree_submission_resolutions enable row level security;
alter table public.dog_match_candidates enable row level security;
alter table public.dog_claims enable row level security;

-- SELF-AUDIT (2026-09-10): narrowed from `to anon, authenticated` to `to authenticated`. The
-- anon public read path is now the curated `public.public_dogs` view (created at the end of this
-- file), matching the repo's established "mixed public/private columns → hand-picked non-
-- security_invoker view" convention (20260101002300_public_views.sql, 20260909001100_public_
-- kennel_owner_identity_verification.sql). The base table carries `created_by` and
-- `current_owner_profile_id` (a platform user id — publicly enumerable dogs-per-user is a privacy
-- leak) which the view drops; a signed-in user reading the base table is the same low-risk
-- exposure `animals`/`parent_dogs` already accept.
create policy "authenticated reads public dogs"
  on public.dogs for select
  to authenticated
  using (is_public);

create policy "admins manage all dogs"
  on public.dogs for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- SELF-AUDIT (2026-09-10): narrowed to `to authenticated`; anon reads the curated
-- `public.public_dog_parent_relationships` view (drops `created_by`) — see the note on the dogs
-- policy above.
create policy "authenticated reads active and disputed parent relationships"
  on public.dog_parent_relationships for select
  to authenticated
  using (status in ('active', 'disputed'));

create policy "admins manage all dog parent relationships"
  on public.dog_parent_relationships for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "contributors view their own pedigree sources"
  on public.pedigree_sources for select
  to authenticated
  using (submitted_by = (select auth.uid()));

create policy "admins manage all pedigree sources"
  on public.pedigree_sources for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "contributors view relationship sources they submitted"
  on public.pedigree_relationship_sources for select
  to authenticated
  using (
    exists (
      select 1 from public.pedigree_sources ps
      where ps.id = source_id and ps.submitted_by = (select auth.uid())
    )
  );

create policy "admins manage all relationship sources"
  on public.pedigree_relationship_sources for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "contributors view their own submissions"
  on public.pedigree_submissions for select
  to authenticated
  using (submitted_by = (select auth.uid()));

create policy "staff manage all submissions"
  on public.pedigree_submissions for all
  to authenticated
  using (public.is_admin() or public.is_ops_staff())
  with check (public.is_admin() or public.is_ops_staff());

create policy "contributors view their submission resolutions"
  on public.pedigree_submission_resolutions for select
  to authenticated
  using (
    exists (
      select 1 from public.pedigree_submissions s
      where s.id = submission_id and s.submitted_by = (select auth.uid())
    )
  );

create policy "staff manage all submission resolutions"
  on public.pedigree_submission_resolutions for all
  to authenticated
  using (public.is_admin() or public.is_ops_staff())
  with check (public.is_admin() or public.is_ops_staff());

create policy "contributors view their submission match candidates"
  on public.dog_match_candidates for select
  to authenticated
  using (
    exists (
      select 1 from public.pedigree_submissions s
      where s.id = submission_id and s.submitted_by = (select auth.uid())
    )
  );

create policy "staff manage all match candidates"
  on public.dog_match_candidates for all
  to authenticated
  using (public.is_admin() or public.is_ops_staff())
  with check (public.is_admin() or public.is_ops_staff());

create policy "claimants create their own claims"
  on public.dog_claims for insert
  to authenticated
  with check (claimant_profile_id = (select auth.uid()) and status = 'pending');

create policy "claimants view their own claims"
  on public.dog_claims for select
  to authenticated
  using (claimant_profile_id = (select auth.uid()));

create policy "admins manage all dog claims"
  on public.dog_claims for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── Storage: private bucket for uploaded pedigree source documents ────────────────────────────
-- Path convention `{submission_id}/{filename}`, matching every other per-record private bucket in
-- this schema (transport-documents, post-media, ...). Original scans are never public — see
-- src/lib/storage/media.ts getSignedFileUrl for the on-demand signed-URL pattern this reuses.

insert into storage.buckets (id, name, public, file_size_limit)
values ('pedigree-sources', 'pedigree-sources', false, 20971520)
on conflict (id) do nothing;

create policy "contributors upload their own pedigree source files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'pedigree-sources'
    and exists (
      select 1 from public.pedigree_submissions s
      where s.id = (storage.foldername(name))[1]::uuid and s.submitted_by = (select auth.uid())
    )
  );

-- Anonymous submissions have no verifiable owner (no auth.uid()) — this permits writing into an
-- anonymous submission's own folder, not any submission. The folder id is an unguessable v4 uuid,
-- the bucket is private (not enumerable), and the content this protects is already
-- pending/unreviewed, so the residual risk (another anonymous visitor who already knows the exact
-- submission id attaching an extra file) is accepted for this pass — see the implementation notes.
create policy "anonymous uploads to anonymous pedigree submissions"
  on storage.objects for insert
  to anon
  with check (
    bucket_id = 'pedigree-sources'
    and exists (
      select 1 from public.pedigree_submissions s
      where s.id = (storage.foldername(name))[1]::uuid and s.submitted_by is null
    )
  );

create policy "contributors read their own pedigree source files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'pedigree-sources'
    and exists (
      select 1 from public.pedigree_submissions s
      where s.id = (storage.foldername(name))[1]::uuid and s.submitted_by = (select auth.uid())
    )
  );

create policy "staff manage all pedigree source files"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'pedigree-sources' and (public.is_admin() or public.is_ops_staff()))
  with check (bucket_id = 'pedigree-sources' and (public.is_admin() or public.is_ops_staff()));

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- SELF-AUDIT FIXES (2026-09-10) — applied against this project's repeatedly-hit Postgres/Supabase
-- gotchas before the migration is applied to the live project. Each block explains what and why.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. `anon` default-privilege trap on trigger-body functions ────────────────────────────────
-- This project has a default-privilege rule granting EXECUTE on every new public-schema function
-- directly to anon/authenticated (not just via PUBLIC), so `revoke ... from public` is not enough.
-- The RPC-shaped SECURITY DEFINER helpers above already do the full
-- `revoke ... from public, anon, authenticated`. The trigger-body functions did not — matching the
-- precedent set by 20260909000200 (which revokes prevent_client_writes_to_deposit_payment_fields(),
-- a pure trigger body) and 20260101010800, every trigger body created here is locked down too.
-- They are meaningless when called directly (no OLD/NEW outside trigger context) but SECURITY
-- DEFINER + anon-executable is exactly the shape those fixup migrations existed to remove.
revoke all on function public.set_dog_slug() from public, anon, authenticated;
revoke all on function public.trg_recompute_relationship_verification() from public, anon, authenticated;
revoke all on function public.trg_create_dog_for_parent_dog() from public, anon, authenticated;
revoke all on function public.trg_create_dog_for_animal() from public, anon, authenticated;
revoke all on function public.trg_sync_animal_parent_relationships() from public, anon, authenticated;
revoke all on function public.trg_sync_litter_animals_parent_relationships() from public, anon, authenticated;

-- ── 2. Table-level GRANTs (auto_expose_new_tables = false on this project) ─────────────────────
-- A new table with RLS policies is still unreachable by PostgREST until it gets an explicit
-- table-level GRANT for the roles its policies name (precedent: 20260101002900_table_grants.sql).
-- RLS remains the real row boundary; these only open the outer gate. Every one of the eight new
-- tables has only `to authenticated` policies after the self-audit narrowing above (anon reads go
-- through the two curated views in block 3, anon writes go through the SECURITY DEFINER RPCs in
-- 20260910000200), so none of them is granted to anon at the table level.
grant select, insert, update, delete on
  public.dogs,
  public.dog_parent_relationships,
  public.pedigree_sources,
  public.pedigree_relationship_sources,
  public.pedigree_submissions,
  public.pedigree_submission_resolutions,
  public.dog_match_candidates,
  public.dog_claims
to authenticated;

-- ── 3. Mixed public/private columns → curated, non-security_invoker public views ──────────────
-- The anon "public registry" read path. Deliberately NOT security_invoker (same reasoning as
-- public_transport_requests): they run with the view owner's rights and hand-pick a safe column
-- list, so the base tables need no `to anon` policy at all. `created_by`,
-- `current_owner_profile_id`, `is_public` and `created_via` are never exposed here.
create view public.public_dogs as
select
  d.id,
  d.registered_name,
  d.call_name,
  d.sex,
  d.breed_id,
  d.date_of_birth,
  d.date_of_death,
  d.life_status,
  d.color,
  d.pedigree_number,
  d.microchip_number,
  d.country_of_origin,
  d.kennel_name,
  d.kennel_id,
  d.description,
  d.profile_image_url,
  d.titles,
  d.health_tests,
  d.slug,
  d.created_at,
  d.updated_at
from public.dogs d
where d.is_public;

grant select on public.public_dogs to anon, authenticated;

create view public.public_dog_parent_relationships as
select
  r.id,
  r.child_dog_id,
  r.parent_dog_id,
  r.role,
  r.verification_level,
  r.status,
  r.created_at,
  r.updated_at
from public.dog_parent_relationships r
where r.status in ('active', 'disputed');

grant select on public.public_dog_parent_relationships to anon, authenticated;

-- ── 4. Storage: breeder uploads keyed by an OWNED dog id ─────────────────────────────────────
-- The original pedigree-sources policies only recognise a `{submission_id}/…` path. The breeder-
-- panel "Add pedigree" flow (attach_breeder_pedigree_source, part 2) uploads against a dog the
-- kennel already owns, so it uses a `{dog_id}/…` path instead. Gate that on the caller owning the
-- dog's kennel — same `(storage.foldername(name))[1]::uuid` convention.
create policy "kennel owners upload pedigree source files for their dogs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'pedigree-sources'
    and exists (
      select 1 from public.dogs d
      where d.id = (storage.foldername(name))[1]::uuid
        and d.kennel_id is not null
        and public.owns_org(d.kennel_id)
    )
  );

create policy "kennel owners read pedigree source files for their dogs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'pedigree-sources'
    and exists (
      select 1 from public.dogs d
      where d.id = (storage.foldername(name))[1]::uuid
        and d.kennel_id is not null
        and public.owns_org(d.kennel_id)
    )
  );

-- ── 5. Points already correct — verified, not changed ────────────────────────────────────────
--   * updated_at triggers: dogs / dog_parent_relationships / pedigree_submissions each already
--     get `set_updated_at()`. pedigree_sources, pedigree_relationship_sources,
--     pedigree_submission_resolutions, dog_match_candidates and dog_claims have no `updated_at`
--     column by design (append + review-stamp only), so correctly have no trigger.
--   * RLS recursion: no policy on any of the eight tables subqueries its own table. Self-
--     referential checks that could recurse (one active sire/dam per dog, dispute promotion) live
--     in upsert_parent_relationship() (SECURITY DEFINER), never in an inline policy subquery.
--     The relationship / resolution / match-candidate policies subquery *other* tables
--     (pedigree_sources, pedigree_submissions) through no helper, which is fine — no cycle.
--   * Storage: `pedigree-sources` policies use `(storage.foldername(name))[1]::uuid` exactly like
--     20260101002200_storage.sql, and both the authenticated (`submitted_by = auth.uid()`) and
--     anon (`submitted_by is null`) submission cases are handled, with the residual anon risk
--     documented inline where that policy is defined.
