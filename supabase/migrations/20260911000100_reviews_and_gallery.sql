-- ============================================================================
-- Reviews (permanent, reservation-anchored trust record) + standalone gallery
-- ============================================================================
-- User decision 2026-09-11: "users who actually reserve puppies can leave
-- public reviews that can't be deleted." A review is either:
--   - source='platform', created by `submit_reservation_review()` for a
--     COMPLETED `reservations` row the reviewer actually owns
--     -> verification_level='verified_buyer'. This is the ONLY way a new
--     review is ever created going forward — there is no anonymous/unverified
--     review-creation path.
--   - source='legacy_import', hand-backfilled from a breeder's pre-Anemalo
--     site (e.g. GRYFIN YORK's own testimonials, imported separately once
--     the verbatim rows are available — see docs/GRYFIN_IMPORT.md).
--     verification_level stays 'unverified' (no Anemalo reservation exists
--     for a pre-platform purchase).
--
-- Immutability: there is NO update/delete RLS policy for authenticated users
-- at all — an authenticated client cannot UPDATE or DELETE a row in this
-- table under any policy. Every write goes through a SECURITY DEFINER RPC
-- that only ever touches specific fields:
--   - submit_reservation_review()    inserts (once per reservation)
--   - respond_to_review()            breeder_response / breeder_response_at only
--   - set_review_moderation_status() admin/ops only — HIDES, never deletes
-- A review's content/rating/author/reservation link can never change after
-- creation, and nothing in the API can delete one. Genuine legal erasure
-- (GDPR) is a manual, superuser SQL action entirely outside RLS — deliberately
-- not exposed as an application feature.

create type public.review_source as enum ('platform', 'legacy_import');
create type public.review_verification_level as enum ('unverified', 'verified_buyer');
create type public.review_moderation_status as enum ('visible', 'hidden_by_moderation');

create table public.organisation_reviews (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  reservation_id uuid references public.reservations (id) on delete set null,
  reviewer_profile_id uuid references public.profiles (id) on delete set null,
  animal_id uuid references public.animals (id) on delete set null,
  reviewer_display_name text not null check (char_length(reviewer_display_name) between 1 and 120),
  rating integer not null check (rating between 1 and 5),
  content text not null check (char_length(content) between 1 and 4000),
  photo_url text,
  source public.review_source not null default 'platform',
  verification_level public.review_verification_level not null default 'unverified',
  moderation_status public.review_moderation_status not null default 'visible',
  breeder_response text check (char_length(breeder_response) <= 2000),
  breeder_response_at timestamptz,
  published_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A platform-created review is always anchored to a real, owned reservation.
  constraint organisation_reviews_platform_requires_reservation
    check (source = 'legacy_import' or (reservation_id is not null and reviewer_profile_id is not null)),
  constraint organisation_reviews_verified_requires_reservation
    check (verification_level = 'unverified' or reservation_id is not null)
);

comment on table public.organisation_reviews is
  'Permanent trust record. No UPDATE/DELETE RLS policy for authenticated users exists — all '
  'writes go through submit_reservation_review / respond_to_review / set_review_moderation_status.';

-- One review per reservation — a buyer can't post twice for the same purchase.
create unique index organisation_reviews_reservation_id_key
  on public.organisation_reviews (reservation_id) where reservation_id is not null;

create index organisation_reviews_organisation_id_idx on public.organisation_reviews (organisation_id);
create index organisation_reviews_reviewer_profile_id_idx on public.organisation_reviews (reviewer_profile_id);
create index organisation_reviews_animal_id_idx on public.organisation_reviews (animal_id);

create trigger set_organisation_reviews_updated_at
  before update on public.organisation_reviews
  for each row execute function public.set_updated_at();

alter table public.organisation_reviews enable row level security;

create policy "public reads visible reviews of public approved kennels"
  on public.organisation_reviews
  for select
  to anon, authenticated
  using (
    moderation_status = 'visible'
    and exists (
      select 1 from public.organisations o
      where o.id = organisation_reviews.organisation_id
        and o.verification_status = 'approved'
        and o.is_public
    )
  );

create policy "reviewers view their own reviews regardless of moderation state"
  on public.organisation_reviews
  for select
  to authenticated
  using (reviewer_profile_id = (select auth.uid()));

create policy "admins view all reviews"
  on public.organisation_reviews
  for select
  to authenticated
  using (public.is_admin());

-- Deliberately no insert/update/delete policy for anon/authenticated — see the immutability
-- note above. Grant hygiene: `auto_expose_new_tables=false` still grants EXECUTE on new
-- functions to anon by default, so every RPC below explicitly revokes it.
revoke all on public.organisation_reviews from public, anon, authenticated;
grant select on public.organisation_reviews to anon, authenticated;

-- ── RPC: a verified buyer reviews a completed reservation ──────────────────────────────────────
create or replace function public.submit_reservation_review(
  p_reservation_id uuid,
  p_rating integer,
  p_content text,
  p_photo_url text default null
)
returns public.organisation_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation record;
  v_display_name text;
  v_row public.organisation_reviews;
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'rating must be between 1 and 5';
  end if;
  if p_content is null or char_length(trim(p_content)) = 0 then
    raise exception 'content is required';
  end if;

  select * into v_reservation from public.reservations where id = p_reservation_id;
  if not found then
    raise exception 'reservation not found';
  end if;
  if v_reservation.buyer_id <> auth.uid() then
    raise exception 'this reservation does not belong to you';
  end if;
  if v_reservation.status <> 'completed' then
    raise exception 'you can only review a completed reservation';
  end if;
  if exists (select 1 from public.organisation_reviews r where r.reservation_id = p_reservation_id) then
    raise exception 'you have already reviewed this reservation';
  end if;

  select coalesce(first_name, display_name, 'Anemalo buyer') into v_display_name
  from public.profiles where id = auth.uid();

  insert into public.organisation_reviews (
    organisation_id, reservation_id, reviewer_profile_id, animal_id,
    reviewer_display_name, rating, content, photo_url,
    source, verification_level
  ) values (
    v_reservation.organization_id, v_reservation.id, auth.uid(), v_reservation.animal_id,
    coalesce(v_display_name, 'Anemalo buyer'), p_rating, trim(p_content), p_photo_url,
    'platform', 'verified_buyer'
  )
  returning * into v_row;

  -- Best-effort notify: the kennel's active team learns a review landed. Not
  -- create_notification_if_enabled() — that RPC's own authorisation check
  -- ("auth.uid() = target, or a moderator, or the org owner notifying their
  -- own applicant") doesn't fit a buyer notifying an unrelated breeder team;
  -- this reimplements its opt-out-preference logic directly instead.
  insert into public.notifications (profile_id, actor_profile_id, notification_type, title, body, dedup_key)
  select
    m.profile_id, auth.uid(), 'review_received', 'New review',
    left(trim(p_content), 140), 'review_received:' || v_row.id || ':' || m.profile_id
  from public.organisation_members m
  where m.org_id = v_reservation.organization_id
    and m.status = 'active'
    and public.get_notification_preference(m.profile_id, 'reviews')
  on conflict (profile_id, dedup_key) where dedup_key is not null do nothing;

  return v_row;
end;
$$;

comment on function public.submit_reservation_review is
  'The ONLY way a platform review is created. Buyer must own the reservation and it must be '
  'completed. One review per reservation (unique index). Always verification_level=verified_buyer.';

revoke all on function public.submit_reservation_review(uuid, integer, text, text) from public, anon;
grant execute on function public.submit_reservation_review(uuid, integer, text, text) to authenticated;

-- ── RPC: the kennel replies publicly to a review ────────────────────────────────────────────────
create or replace function public.respond_to_review(
  p_review_id uuid,
  p_response text
)
returns public.organisation_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_row public.organisation_reviews;
begin
  select organisation_id into v_org_id from public.organisation_reviews where id = p_review_id;
  if not found then
    raise exception 'review not found';
  end if;
  if not public.is_org_member(v_org_id) then
    raise exception 'not authorised to respond to this review';
  end if;
  if p_response is null or char_length(trim(p_response)) = 0 then
    raise exception 'response is required';
  end if;

  update public.organisation_reviews
    set breeder_response = trim(p_response), breeder_response_at = now()
    where id = p_review_id
    returning * into v_row;

  return v_row;
end;
$$;

comment on function public.respond_to_review is
  'Only public write path onto an existing review — touches breeder_response(_at) only. '
  'Any active organisation_members row (owner or team) may respond.';

revoke all on function public.respond_to_review(uuid, text) from public, anon;
grant execute on function public.respond_to_review(uuid, text) to authenticated;

-- ── RPC: admin/ops hides (never deletes) a review ───────────────────────────────────────────────
create or replace function public.set_review_moderation_status(
  p_review_id uuid,
  p_status public.review_moderation_status,
  p_reason text default null
)
returns public.organisation_reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.organisation_reviews;
  v_row public.organisation_reviews;
begin
  if not (public.is_admin() or public.is_ops_staff()) then
    raise exception 'not authorised';
  end if;

  select * into v_before from public.organisation_reviews where id = p_review_id;
  if not found then
    raise exception 'review not found';
  end if;

  update public.organisation_reviews
    set moderation_status = p_status
    where id = p_review_id
    returning * into v_row;

  insert into public.audit_logs (actor_profile_id, action, target_type, target_id, before, after)
  values (
    auth.uid(), 'review.moderation_status_changed', 'organisation_review', p_review_id,
    jsonb_build_object('moderation_status', v_before.moderation_status, 'reason', p_reason),
    jsonb_build_object('moderation_status', v_row.moderation_status)
  );

  return v_row;
end;
$$;

comment on function public.set_review_moderation_status is
  'Admin/ops only. Hides a review from public view — there is no function or policy that deletes '
  'a review row.';

revoke all on function public.set_review_moderation_status(uuid, public.review_moderation_status, text) from public, anon;
grant execute on function public.set_review_moderation_status(uuid, public.review_moderation_status, text) to authenticated;

-- ============================================================================
-- Standalone gallery — general kennel photos, not tied to a specific animal
-- ============================================================================
-- Ordinary CRUD (docs/EDGE_FUNCTION_ARCHITECTURE.md boundary): a direct,
-- RLS-gated client write — no edge function needed for the DB row (only the
-- R2 object write goes through anemalo-workspace's media.upload).

create type public.gallery_category as enum (
  'puppies', 'adults', 'shows', 'home', 'play', 'dogs', 'litters', 'families', 'general'
);

create table public.organisation_gallery_images (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  image_url text not null,
  caption text,
  category public.gallery_category not null default 'general',
  display_order integer not null default 0,
  width integer,
  height integer,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organisation_gallery_images_organisation_id_idx
  on public.organisation_gallery_images (organisation_id);

create trigger set_organisation_gallery_images_updated_at
  before update on public.organisation_gallery_images
  for each row execute function public.set_updated_at();

alter table public.organisation_gallery_images enable row level security;

create policy "public reads published gallery images of public approved kennels"
  on public.organisation_gallery_images
  for select
  to anon, authenticated
  using (
    is_published
    and exists (
      select 1 from public.organisations o
      where o.id = organisation_gallery_images.organisation_id
        and o.verification_status = 'approved'
        and o.is_public
    )
  );

-- Any active member (owner or team) manages their own kennel's gallery — is_org_member(),
-- not owns_org(), from day one (see docs/BREEDER_PANEL_GAP_ANALYSIS.md's owns_org->
-- is_org_member widening note; this table starts on the wider, correct predicate).
create policy "org members manage their kennel's gallery"
  on public.organisation_gallery_images
  for all
  to authenticated
  using (public.is_org_member(organisation_id))
  with check (public.is_org_member(organisation_id));

create policy "admins manage all gallery images"
  on public.organisation_gallery_images
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.organisation_gallery_images from public, anon, authenticated;
grant select on public.organisation_gallery_images to anon;
grant select, insert, update, delete on public.organisation_gallery_images to authenticated;

-- ── Backfill: GRYFIN YORK's 30 general gallery photos (URLs kept as-is, same convention as the
-- rest of the import — docs/GRYFIN_IMPORT.md) ───────────────────────────────────────────────────
insert into public.organisation_gallery_images (organisation_id, image_url, category, display_order)
select '2dce98c9-f5b9-4df9-9243-9239adc290dd', url, 'general', ord - 1
from unnest(array[
  'https://media.hodowlagryfinyork.pl/gallery/88dfb52f-0801-42ae-9754-d8c3b9d56715.webp',
  'https://media.hodowlagryfinyork.pl/gallery/bf047d58-b201-4a5d-956b-e696511ee590.webp',
  'https://media.hodowlagryfinyork.pl/gallery/0bc60120-2a42-472a-99d7-b7102ccafe5a.webp',
  'https://media.hodowlagryfinyork.pl/gallery/4f06ea56-b5ea-4a7d-aee1-2b19ac1e5204.webp',
  'https://media.hodowlagryfinyork.pl/gallery/78ca6c49-13b0-4bf2-8dad-dc34be99e5b5.webp',
  'https://media.hodowlagryfinyork.pl/gallery/43c0c879-a571-41cc-a753-dd7d80b4c6fc.webp',
  'https://media.hodowlagryfinyork.pl/gallery/0721d8bc-733a-4665-b1f1-b026f495fa84.webp',
  'https://media.hodowlagryfinyork.pl/gallery/04d1e61d-39bf-4067-9b1e-2be09bd6a769.webp',
  'https://media.hodowlagryfinyork.pl/gallery/98c08930-dfbb-48c1-adea-4e6061eb6f10.webp',
  'https://media.hodowlagryfinyork.pl/gallery/969f3816-6ef0-44ad-bb44-e28698903a65.webp',
  'https://media.hodowlagryfinyork.pl/gallery/6a40a9c8-1fb9-4af8-894c-6c6b110522eb.webp',
  'https://media.hodowlagryfinyork.pl/gallery/bce4e8bf-aaa3-4f20-b184-bfe46f4f2e57.webp',
  'https://media.hodowlagryfinyork.pl/gallery/f2698085-4d65-46fa-b0e6-6d0688df3c53.webp',
  'https://media.hodowlagryfinyork.pl/gallery/c0089363-8c89-46fa-9324-512800d53d9b.webp',
  'https://media.hodowlagryfinyork.pl/gallery/df172989-adec-46b5-b7ea-5ee78ee12c7a.webp',
  'https://media.hodowlagryfinyork.pl/gallery/d7496a8a-7da7-45f5-b952-b2436299e23a.webp',
  'https://media.hodowlagryfinyork.pl/gallery/f07c2bbb-e1d9-4957-a7c1-e52fa525c5e1.webp',
  'https://media.hodowlagryfinyork.pl/gallery/f9e97312-783e-45d3-bf39-90c0450afd0a.webp',
  'https://media.hodowlagryfinyork.pl/gallery/615747aa-d8ec-4d35-bf57-f096571b942d.webp',
  'https://media.hodowlagryfinyork.pl/gallery/52a867c8-ef7f-4688-b982-05663e5253d8.webp',
  'https://media.hodowlagryfinyork.pl/gallery/421a679d-f891-4f55-9b66-0001853b5838.webp',
  'https://media.hodowlagryfinyork.pl/gallery/eccdc106-4be3-4194-9d77-f159711ce18f.webp',
  'https://media.hodowlagryfinyork.pl/gallery/0d2eec31-dbb2-4ff9-9c7b-87846c829d78.webp',
  'https://media.hodowlagryfinyork.pl/gallery/9740472c-1fee-41f4-99fa-4adccba6509e.webp',
  'https://media.hodowlagryfinyork.pl/gallery/88ac4814-3cca-429a-8c58-1f818fae00d9.webp',
  'https://media.hodowlagryfinyork.pl/gallery/d75e86a1-d19a-4214-a504-277a243e59c3.webp',
  'https://media.hodowlagryfinyork.pl/gallery/0ad3b78d-489e-4bc0-bc59-66c2ae3ce797.webp',
  'https://media.hodowlagryfinyork.pl/gallery/172dbcaf-20df-495d-9736-886c93442e04.webp',
  'https://media.hodowlagryfinyork.pl/gallery/c70fec73-9ff7-4438-a01b-b57286d1911c.webp',
  'https://media.hodowlagryfinyork.pl/gallery/ec7b78ff-4c01-42b5-97e2-5546dd0b9855.webp'
]) with ordinality as t(url, ord);

-- NOTE: GRYFIN's 19 legacy testimonials are NOT backfilled here — this session only has a
-- summary (author-name sample + "all rating 5") from .gryfin-migration/snapshot.json, not the
-- verbatim content per row. Fabricating review text attributed to real people would be actively
-- wrong. Backfill as `source='legacy_import'` rows once the exact 19 rows are re-read from the
-- Gryfin project (reconnect Supabase MCP to eqggerrzfwlfqibcdyjy) — see docs/GRYFIN_IMPORT.md.
