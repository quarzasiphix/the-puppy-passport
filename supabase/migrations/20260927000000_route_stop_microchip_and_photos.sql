-- Extends the transported-animal registry (20260926000000_trip_stop_microchip_and_photos.sql) to
-- ops-planned routes: route_stops gets the same microchip_number + photos capability trip_stops
-- already has, and recognize_transported_microchip() is widened to also count route_stops matches
-- so "has this chip been transported before" is a platform-wide answer, not just a company-Trips
-- one. routes has no owning organisation (Anemalo's own planned-route model, not a transport
-- company's), so a route_stops match is labeled 'Anemalo operations' in the existing
-- `companies text[]` result rather than adding a new column.

alter table public.route_stops add column microchip_number text;
create index route_stops_microchip_number_idx
  on public.route_stops (lower(trim(microchip_number)))
  where microchip_number is not null and trim(microchip_number) <> '';

-- Structural copy of trip_stop_photos — ops-only (route_stops has no company-facing side, so no
-- is_org_member() branch is needed, unlike trip_stop_photos').
create table public.route_stop_photos (
  id uuid primary key default gen_random_uuid(),
  route_stop_id uuid not null references public.route_stops(id) on delete cascade,
  storage_path text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index route_stop_photos_route_stop_id_idx on public.route_stop_photos(route_stop_id);

alter table public.route_stop_photos enable row level security;
create policy "ops staff manage route stop photos" on public.route_stop_photos
  for all to authenticated using (public.is_ops_staff()) with check (public.is_ops_staff());
revoke all on public.route_stop_photos from public, anon;
grant select, insert, update, delete on public.route_stop_photos to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('route-stop-photos', 'route-stop-photos', false, 10485760)
on conflict (id) do nothing;

create policy "ops staff manage route stop photo objects" on storage.objects
  for all to authenticated
  using (bucket_id = 'route-stop-photos' and public.is_ops_staff())
  with check (bucket_id = 'route-stop-photos' and public.is_ops_staff());

-- Widened to union route_stops into every aggregate — same privacy contract as before (counts/
-- dates/names only), just now sourced from both tables.
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
  with chip as (select lower(btrim(p_microchip)) as v),
  matches as (
    select t.departure_date as when_date, o.name as company_name
    from public.trip_stops ts
    join public.trips t on t.id = ts.trip_id
    join public.organisations o on o.id = t.organization_id, chip
    where lower(trim(ts.microchip_number)) = chip.v and chip.v <> ''
    union all
    select r.departure_date as when_date, 'Anemalo operations' as company_name
    from public.route_stops rs
    join public.routes r on r.id = rs.route_id, chip
    where lower(trim(rs.microchip_number)) = chip.v and chip.v <> ''
  )
  select
    (select count(*) from matches),
    (select min(when_date) from matches),
    (select max(when_date) from matches),
    (select array_agg(distinct company_name) from matches),
    d.id, d.registered_name, d.slug,
    a.id, a.name
  from chip
  left join public.dogs d on lower(trim(d.microchip_number)) = chip.v and chip.v <> '' and d.is_public
  left join public.animals a on lower(trim(a.microchip_number)) = chip.v and chip.v <> '' and a.is_published
  limit 1;
$$;

revoke all on function public.recognize_transported_microchip(text) from public;
grant execute on function public.recognize_transported_microchip(text) to authenticated;
