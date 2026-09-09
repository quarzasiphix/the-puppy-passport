-- Public collaborative pedigree graph, part 2: the client-callable RPC surface.
--
-- 20260910000100 (part 1) builds the tables, the SECURITY DEFINER relationship helpers
-- (upsert_parent_relationship, recompute_dog_parent_relationship_verification) and the
-- auto-identity triggers, but it deliberately grants NO direct INSERT/UPDATE on `dogs`,
-- `dog_parent_relationships`, `pedigree_submissions` or `pedigree_sources` to anon/authenticated
-- (see its RLS header comment). This file is the sanctioned write path referenced there as
-- "the RPCs in part 2":
--
--   create_pedigree_submission          -- start an "Add pedigree" contribution (anon or signed-in)
--   attach_pedigree_submission_document -- record an uploaded file against that submission's source
--   resolve_pedigree_slot              -- per-ancestor-slot "use existing / create new / skip"
--   finalize_pedigree_submission       -- staff-only: promote resolved slots to canonical edges
--   attach_breeder_pedigree_source     -- breeder panel: attach a source + edges to an OWNED dog
--   search_dogs_ranked                 -- reg-number-exact-weighted dog search (import dedup)
--
-- Grant hygiene: this project grants EXECUTE on every new public function directly to anon +
-- authenticated via a default-privilege rule, so each function below does
-- `revoke all ... from public, anon, authenticated;` then an explicit `grant execute` to exactly
-- the roles it is meant for (precedent: 20260909000200, 20260101010800).

-- ── create_pedigree_submission ───────────────────────────────────────────────────────────────
-- Creates the submission row + its one paired pedigree_sources row (part 1's comment: "A
-- submission always has exactly one paired source row, created together"). Anonymous callers get
-- submitted_by = null — a pending row, never a canonical write. A submission tied to a kennel
-- (breeder panel) must be made by that org's owner; the org id is re-verified here, never trusted
-- from the client.
create or replace function public.create_pedigree_submission(
  p_method public.pedigree_submission_method,
  p_source_type public.pedigree_source_type,
  p_subject_dog_id uuid default null,
  p_contact_email text default null,
  p_submitted_org_id uuid default null,
  p_manual_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_submission_id uuid;
  v_source_id uuid;
begin
  if p_submitted_org_id is not null then
    if v_uid is null or not public.owns_org(p_submitted_org_id) then
      raise exception 'You can only submit a kennel pedigree for a kennel you own.';
    end if;
  end if;

  if v_uid is null and coalesce(btrim(p_contact_email), '') = '' then
    raise exception 'An email address is required for an anonymous pedigree submission.';
  end if;

  insert into public.pedigree_submissions (
    submitted_by, contact_email, method, submitted_org_id, subject_dog_id
  ) values (
    v_uid, nullif(btrim(p_contact_email), ''), p_method, p_submitted_org_id, p_subject_dog_id
  )
  returning id into v_submission_id;

  insert into public.pedigree_sources (
    submission_id, source_type, submitted_by, contact_email, organisation_id, document_metadata
  ) values (
    v_submission_id, p_source_type, v_uid, nullif(btrim(p_contact_email), ''), p_submitted_org_id,
    coalesce(p_manual_payload, '{}'::jsonb)
  )
  returning id into v_source_id;

  return jsonb_build_object('submission_id', v_submission_id, 'source_id', v_source_id);
end;
$$;

revoke all on function public.create_pedigree_submission(
  public.pedigree_submission_method, public.pedigree_source_type, uuid, text, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.create_pedigree_submission(
  public.pedigree_submission_method, public.pedigree_source_type, uuid, text, uuid, jsonb
) to anon, authenticated;

-- ── attach_pedigree_submission_document ──────────────────────────────────────────────────────
-- After the browser has uploaded the file into `pedigree-sources/{submission_id}/…` (storage RLS
-- from part 1 already gates that write), record its path on the submission's paired source row.
-- An anonymous submission has no verifiable owner, so `submitted_by is null` is accepted here —
-- the same residual risk the storage policy documents (folder id is an unguessable v4 uuid, the
-- content is already pending/unreviewed).
create or replace function public.attach_pedigree_submission_document(
  p_submission_id uuid,
  p_bucket text,
  p_path text,
  p_mime text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
begin
  select submitted_by into v_owner from public.pedigree_submissions where id = p_submission_id;
  if not found then
    raise exception 'Submission not found.';
  end if;
  if v_owner is not null and v_owner is distinct from v_uid
     and not (public.is_admin() or public.is_ops_staff()) then
    raise exception 'You can only attach a document to your own submission.';
  end if;

  update public.pedigree_sources
    set document_bucket = p_bucket,
        document_path = p_path,
        document_mime_type = p_mime
    where submission_id = p_submission_id;
end;
$$;

revoke all on function public.attach_pedigree_submission_document(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.attach_pedigree_submission_document(uuid, text, text, text)
  to anon, authenticated;

-- ── resolve_pedigree_slot ───────────────────────────────────────────────────────────────────
-- Records one per-ancestor-slot decision. slot_key '' = the subject dog, then a dot path of
-- 'sire'/'dam' segments. A slot cannot be resolved until its parent slot already has a
-- non-'skip' resolution — enforced here, not just by client ordering. 'create_new' mints a
-- `dogs` row (the only canonical write a contributor can trigger, and only for a brand-new
-- ancestor node, never an edit of an existing dog). Callable by the submission's owner or staff.
create or replace function public.resolve_pedigree_slot(
  p_submission_id uuid,
  p_slot_key text,
  p_action text,
  p_role public.pedigree_parent_role default null,
  p_resolved_dog_id uuid default null,
  p_new_dog jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_parent_slot text;
  v_parent_resolved boolean;
  v_dog_id uuid := p_resolved_dog_id;
  v_name text;
begin
  if v_uid is null then
    raise exception 'Sign in to review a pedigree submission.';
  end if;
  select submitted_by into v_owner from public.pedigree_submissions where id = p_submission_id;
  if not found then
    raise exception 'Submission not found.';
  end if;
  if v_owner is distinct from v_uid and not (public.is_admin() or public.is_ops_staff()) then
    raise exception 'You can only review your own submission.';
  end if;
  if p_action not in ('use_existing', 'create_new', 'skip') then
    raise exception 'Unknown slot action %', p_action;
  end if;

  -- Any non-root slot must have its parent slot resolved (non-'skip') first. Parent of a
  -- dotless slot ('sire') is the root (''); parent of 'sire.dam' is 'sire'.
  if coalesce(p_slot_key, '') <> '' then
    if position('.' in p_slot_key) > 0 then
      v_parent_slot := left(p_slot_key, length(p_slot_key) - position('.' in reverse(p_slot_key)));
    else
      v_parent_slot := '';
    end if;
    select exists (
      select 1 from public.pedigree_submission_resolutions
      where submission_id = p_submission_id and slot_key = v_parent_slot and action <> 'skip'
    ) into v_parent_resolved;
    if not v_parent_resolved then
      raise exception 'Resolve the parent slot "%" before this one.', v_parent_slot;
    end if;
  end if;

  if p_action = 'use_existing' then
    if v_dog_id is null then
      raise exception 'use_existing requires a dog id.';
    end if;
  elsif p_action = 'create_new' then
    v_name := btrim(coalesce(p_new_dog->>'registered_name', ''));
    if v_name = '' then
      raise exception 'A new ancestor needs at least a registered name.';
    end if;
    insert into public.dogs (
      registered_name, call_name, sex, pedigree_number, color, country_of_origin, kennel_name,
      date_of_birth, created_by, created_via
    ) values (
      v_name,
      nullif(btrim(coalesce(p_new_dog->>'call_name', '')), ''),
      nullif(p_new_dog->>'sex', '')::public.dog_sex,
      nullif(btrim(coalesce(p_new_dog->>'pedigree_number', '')), ''),
      nullif(btrim(coalesce(p_new_dog->>'color', '')), ''),
      nullif(btrim(coalesce(p_new_dog->>'country_of_origin', '')), ''),
      nullif(btrim(coalesce(p_new_dog->>'kennel_name', '')), ''),
      nullif(p_new_dog->>'date_of_birth', '')::date,
      v_uid,
      'community_contribution'
    )
    returning id into v_dog_id;
  else
    v_dog_id := null;
  end if;

  insert into public.pedigree_submission_resolutions (
    submission_id, slot_key, role, resolved_dog_id, action
  ) values (
    p_submission_id, p_slot_key, p_role, v_dog_id, p_action
  )
  on conflict (submission_id, slot_key)
  do update set role = excluded.role, resolved_dog_id = excluded.resolved_dog_id,
               action = excluded.action;

  return v_dog_id;
end;
$$;

revoke all on function public.resolve_pedigree_slot(
  uuid, text, text, public.pedigree_parent_role, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.resolve_pedigree_slot(
  uuid, text, text, public.pedigree_parent_role, uuid, jsonb
) to authenticated;

-- ── finalize_pedigree_submission ────────────────────────────────────────────────────────────
-- Promotes the resolved slots to canonical `dog_parent_relationships` edges via part 1's
-- upsert_parent_relationship() (which never silently overwrites a conflicting active parent — it
-- moves both to 'disputed'). STAFF / ADMIN ONLY: an ordinary contributor's submission stays
-- `pending_review` until a moderator runs this. Breeders working on their own kennel's dogs use
-- the direct trigger path (parent_dogs / litters auto-create identity + edges) or
-- attach_breeder_pedigree_source below, neither of which needs this.
create or replace function public.finalize_pedigree_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_id uuid;
  v_subject uuid;
  r record;
  v_parent_slot text;
  v_parent_dog uuid;
begin
  if not (public.is_admin() or public.is_ops_staff()) then
    raise exception 'Only staff can finalize a pedigree submission.';
  end if;

  select ps.id, s.subject_dog_id
    into v_source_id, v_subject
    from public.pedigree_submissions s
    join public.pedigree_sources ps on ps.submission_id = s.id
    where s.id = p_submission_id;
  if not found then
    raise exception 'Submission not found.';
  end if;

  -- Slot '' may itself resolve the subject dog when the submission had none.
  select resolved_dog_id into v_subject
    from public.pedigree_submission_resolutions
    where submission_id = p_submission_id and slot_key = '' and resolved_dog_id is not null
    limit 1;
  if v_subject is null then
    select subject_dog_id into v_subject from public.pedigree_submissions where id = p_submission_id;
  end if;
  if v_subject is null then
    raise exception 'The submission has no subject dog to attach ancestry to.';
  end if;

  for r in
    select slot_key, role, resolved_dog_id
      from public.pedigree_submission_resolutions
      where submission_id = p_submission_id
        and action <> 'skip'
        and resolved_dog_id is not null
        and slot_key <> ''
      order by length(slot_key) - length(replace(slot_key, '.', '')) asc
  loop
    if position('.' in r.slot_key) > 0 then
      v_parent_slot := left(r.slot_key, length(r.slot_key) - position('.' in reverse(r.slot_key)));
      select resolved_dog_id into v_parent_dog
        from public.pedigree_submission_resolutions
        where submission_id = p_submission_id and slot_key = v_parent_slot;
    else
      v_parent_dog := v_subject;
    end if;
    if v_parent_dog is not null and r.role is not null then
      perform public.upsert_parent_relationship(
        v_parent_dog, r.resolved_dog_id, r.role, v_source_id, p_submission_id
      );
    end if;
  end loop;

  update public.pedigree_sources
    set review_state = 'accepted', reviewed_by = auth.uid(), reviewed_at = now()
    where id = v_source_id;
  update public.pedigree_submissions
    set status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
    where id = p_submission_id;
end;
$$;

revoke all on function public.finalize_pedigree_submission(uuid)
  from public, anon, authenticated;
grant execute on function public.finalize_pedigree_submission(uuid) to authenticated;

-- ── attach_breeder_pedigree_source ──────────────────────────────────────────────────────────
-- Breeder panel "Add pedigree" for a dog the breeder's kennel already owns (its `dogs` row was
-- auto-created by part 1's parent_dogs / animals trigger). Creates an accepted
-- `breeder_declaration` source (optionally carrying an uploaded document already placed in
-- storage) and, for each provided parent, a canonical edge — all gated on owns_org() for the
-- dog's kennel. This is the "enter once, reused everywhere" path proven end-to-end for the
-- authenticated breeder case.
create or replace function public.attach_breeder_pedigree_source(
  p_dog_id uuid,
  p_org_id uuid,
  p_document_bucket text default null,
  p_document_path text default null,
  p_document_mime text default null,
  p_sire_dog_id uuid default null,
  p_dam_dog_id uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_dog_kennel uuid;
  v_source_id uuid;
begin
  if v_uid is null or not public.owns_org(p_org_id) then
    raise exception 'You can only add a pedigree for a kennel you own.';
  end if;
  select kennel_id into v_dog_kennel from public.dogs where id = p_dog_id;
  if not found then
    raise exception 'Dog not found.';
  end if;
  if v_dog_kennel is distinct from p_org_id and not public.is_admin() then
    raise exception 'That dog is not linked to this kennel.';
  end if;

  insert into public.pedigree_sources (
    source_type, submitted_by, organisation_id, document_bucket, document_path,
    document_mime_type, review_state, reviewed_by, reviewed_at, notes
  ) values (
    'breeder_declaration', v_uid, p_org_id, p_document_bucket, p_document_path,
    p_document_mime, 'accepted', v_uid, now(), p_notes
  )
  returning id into v_source_id;

  if p_sire_dog_id is not null then
    perform public.upsert_parent_relationship(p_dog_id, p_sire_dog_id, 'sire', v_source_id, null);
  end if;
  if p_dam_dog_id is not null then
    perform public.upsert_parent_relationship(p_dog_id, p_dam_dog_id, 'dam', v_source_id, null);
  end if;

  return v_source_id;
end;
$$;

revoke all on function public.attach_breeder_pedigree_source(
  uuid, uuid, text, text, text, uuid, uuid, text
) from public, anon, authenticated;
grant execute on function public.attach_breeder_pedigree_source(
  uuid, uuid, text, text, text, uuid, uuid, text
) to authenticated;

-- ── search_dogs_ranked ──────────────────────────────────────────────────────────────────────
-- Load-bearing for import dedup: an exact registration-/pedigree-number or microchip hit must
-- rank far above any fuzzy name match, so a contributor is shown the real existing dog instead of
-- creating a duplicate. Read-only over the same public projection the `public_dogs` view exposes.
-- rank: 100 exact pedigree number, 90 exact microchip, then trigram name similarity (0..60).
create or replace function public.search_dogs_ranked(p_query text, p_limit integer default 25)
returns table (
  id uuid,
  registered_name text,
  call_name text,
  sex public.dog_sex,
  breed_id uuid,
  date_of_birth date,
  pedigree_number text,
  microchip_number text,
  kennel_name text,
  kennel_id uuid,
  profile_image_url text,
  slug text,
  match_rank numeric,
  matched_on text[]
)
language sql
stable
security definer
-- pg_trgm lives in the `extensions` schema on this project (20260101000100_extensions.sql), so
-- similarity() must be schema-qualified / on the search_path.
set search_path = public, extensions
as $$
  with q as (select btrim(coalesce(p_query, '')) as term)
  select
    d.id, d.registered_name, d.call_name, d.sex, d.breed_id, d.date_of_birth,
    d.pedigree_number, d.microchip_number, d.kennel_name, d.kennel_id, d.profile_image_url, d.slug,
    (
      case when q.term <> '' and lower(d.pedigree_number) = lower(q.term) then 100 else 0 end
      + case when q.term <> '' and lower(d.microchip_number) = lower(q.term) then 90 else 0 end
      + case when q.term <> ''
             then 60 * extensions.similarity(lower(d.registered_name), lower(q.term))
             else 0 end
    )::numeric as match_rank,
    (
      array_remove(array[
        case when q.term <> '' and lower(d.pedigree_number) = lower(q.term) then 'pedigree_number' end,
        case when q.term <> '' and lower(d.microchip_number) = lower(q.term) then 'microchip' end,
        case when q.term <> ''
             and extensions.similarity(lower(d.registered_name), lower(q.term)) > 0.3
             then 'registered_name' end
      ], null)
    ) as matched_on
  from public.dogs d, q
  where d.is_public
    and (
      q.term = ''
      or lower(d.pedigree_number) = lower(q.term)
      or lower(d.microchip_number) = lower(q.term)
      or extensions.similarity(lower(d.registered_name), lower(q.term)) > 0.3
      or lower(d.registered_name) like '%' || lower(q.term) || '%'
      or lower(coalesce(d.kennel_name, '')) like '%' || lower(q.term) || '%'
    )
  order by match_rank desc, d.registered_name asc
  limit greatest(1, least(coalesce(p_limit, 25), 100));
$$;

revoke all on function public.search_dogs_ranked(text, integer)
  from public, anon, authenticated;
grant execute on function public.search_dogs_ranked(text, integer) to anon, authenticated;
