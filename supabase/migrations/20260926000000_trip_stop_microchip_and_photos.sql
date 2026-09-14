-- A transported-animal registry: each trip stop can carry the animal's microchip number and
-- photos, and any company (or ops) can instantly recognize a chip that's already passed through
-- the system before — the same way a vet or border check would. See this migration's own plan
-- (docs/TRANSPORT_MARKETPLACE_VISION.md-adjacent reasoning) for why cross-company recognition
-- returns only privacy-safe aggregates (counts/dates/company names), never another company's raw
-- trip data — company identity is already public via /transport-companies, trip contents are not.

alter table public.trip_stops add column microchip_number text;
-- No uniqueness constraint (unlike animals.microchip_number) — a real chip legitimately appears
-- here every time the same animal is transported again, same reasoning already written into
-- 20260101010700_duplicate_detection.sql for why transport_request_animals was left unconstrained.
create index trip_stops_microchip_number_idx
  on public.trip_stops (lower(trim(microchip_number)))
  where microchip_number is not null and trim(microchip_number) <> '';

-- Structural copy of animal_images' shape (20260101000900_animals.sql): a child table, not a flat
-- array column, so per-photo metadata/RLS/removal all work the normal way.
create table public.trip_stop_photos (
  id uuid primary key default gen_random_uuid(),
  trip_stop_id uuid not null references public.trip_stops(id) on delete cascade,
  storage_path text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index trip_stop_photos_trip_stop_id_idx on public.trip_stop_photos(trip_stop_id);

alter table public.trip_stop_photos enable row level security;

create policy "org members manage photos on their own trip stops" on public.trip_stop_photos
  for all to authenticated
  using (exists (
    select 1 from public.trip_stops ts join public.trips t on t.id = ts.trip_id
    where ts.id = trip_stop_photos.trip_stop_id and public.is_org_member(t.organization_id)
  ))
  with check (exists (
    select 1 from public.trip_stops ts join public.trips t on t.id = ts.trip_id
    where ts.id = trip_stop_photos.trip_stop_id and public.is_org_member(t.organization_id)
  ));

create policy "ops staff manage all trip stop photos" on public.trip_stop_photos
  for all to authenticated using (public.is_ops_staff()) with check (public.is_ops_staff());
create policy "admins manage all trip stop photos" on public.trip_stop_photos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.trip_stop_photos from public, anon;
grant select, insert, update, delete on public.trip_stop_photos to authenticated;

-- Private bucket (storage_path resolved to a signed URL on read, never a public URL) — exact same
-- shape as transport-evidence (20260101010000_pickup_delivery_evidence.sql): objects live under
-- <trip_stop_id>/<filename>, policies gated on that id prefix.
insert into storage.buckets (id, name, public, file_size_limit)
values ('trip-stop-photos', 'trip-stop-photos', false, 10485760)
on conflict (id) do nothing;

create policy "org members upload photos for their own trip stops" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'trip-stop-photos'
    and exists (
      select 1 from public.trip_stops ts join public.trips t on t.id = ts.trip_id
      where ts.id = (storage.foldername(storage.objects.name))[1]::uuid
        and public.is_org_member(t.organization_id)
    )
  );

create policy "org members and ops staff read their own trip stop photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'trip-stop-photos'
    and (
      public.is_ops_staff()
      or exists (
        select 1 from public.trip_stops ts join public.trips t on t.id = ts.trip_id
        where ts.id = (storage.foldername(storage.objects.name))[1]::uuid
          and public.is_org_member(t.organization_id)
      )
    )
  );

create policy "ops staff manage all trip stop photo objects" on storage.objects
  for all to authenticated
  using (bucket_id = 'trip-stop-photos' and public.is_ops_staff())
  with check (bucket_id = 'trip-stop-photos' and public.is_ops_staff());

-- The actual "instant recognition": SECURITY DEFINER so it can read across every company's
-- trip_stops (plain RLS would never allow a non-owner to do this), but returns only aggregate
-- facts — a count, a date range, and distinct company NAMES (already public via
-- /transport-companies) — never a stop id, address, contact, or photo from a trip that isn't the
-- caller's own. Also cross-references the pedigree graph (dogs) and marketplace (animals), both
-- already public for a matching chip.
create or replace function public.recognize_transported_microchip(p_microchip text)
returns table (
  times_transported bigint,
  first_transported_at date,
  last_transported_at date,
  companies text[],
  known_pedigree_dog_id uuid,
  known_pedigree_dog_name text,
  known_pedigree_dog_slug text,
  known_marketplace_animal_id uuid,
  known_marketplace_animal_name text
)
language sql
stable
security definer
set search_path = public
as $$
  with chip as (select lower(btrim(p_microchip)) as v)
  select
    (select count(*) from public.trip_stops ts, chip
       where lower(trim(ts.microchip_number)) = chip.v and chip.v <> ''),
    (select min(t.departure_date) from public.trip_stops ts
       join public.trips t on t.id = ts.trip_id, chip
       where lower(trim(ts.microchip_number)) = chip.v and chip.v <> ''),
    (select max(t.departure_date) from public.trip_stops ts
       join public.trips t on t.id = ts.trip_id, chip
       where lower(trim(ts.microchip_number)) = chip.v and chip.v <> ''),
    (select array_agg(distinct o.name) from public.trip_stops ts
       join public.trips t on t.id = ts.trip_id
       join public.organisations o on o.id = t.organization_id, chip
       where lower(trim(ts.microchip_number)) = chip.v and chip.v <> ''),
    d.id, d.registered_name, d.slug,
    a.id, a.name
  from chip
  left join public.dogs d on lower(trim(d.microchip_number)) = chip.v and chip.v <> '' and d.is_public
  left join public.animals a on lower(trim(a.microchip_number)) = chip.v and chip.v <> '' and a.is_published
  limit 1;
$$;

revoke all on function public.recognize_transported_microchip(text) from public;
grant execute on function public.recognize_transported_microchip(text) to authenticated;
