-- Multi-species foundation (docs/PRODUCT_VISION.md hierarchy pillar 1, docs/IMPLEMENTATION_PLAN.md
-- phase 15). Deliberately schema-first and minimal this pass: a `species` reference table plus a
-- `species_id` column on `breeds` and `animals`, defaulting every existing and yet-unaware insert
-- path to 'dog' via a fixed row id (not gen_random_uuid()) so this migration needs zero app-code
-- changes to avoid breaking any of the many existing dog-only insert paths (puppy/litter forms,
-- rehoming, transport's inline animal snapshot, etc.) — see docs/DECISIONS.md for the full
-- reasoning. Species-aware forms and per-species field/document/eligibility rules are explicitly
-- NOT built in this pass; this is the foundation a later phase builds on, not the full feature.

create type public.species_key as enum (
  'dog', 'cat', 'rabbit', 'guinea_pig', 'other_small_mammal',
  'bird', 'reptile_amphibian', 'fish', 'exotic', 'horse'
);

create table public.species (
  -- Fixed ids (not gen_random_uuid()) specifically so `breeds`/`animals` can default to the 'dog'
  -- row below without a subquery in a column DEFAULT (Postgres doesn't allow one).
  id uuid primary key,
  key public.species_key not null unique,
  display_name text not null,
  -- Disabled species are real rows (so future work has somewhere to attach data/config) but never
  -- publicly selectable or usable in a listing until deliberately enabled — see
  -- docs/PRODUCT_VISION.md on not activating a vertical before its dedicated workflow exists.
  enabled boolean not null default false,
  sort_order integer not null default 0
);

alter table public.species enable row level security;

create policy "enabled species are publicly readable"
  on public.species for select
  to anon, authenticated
  using (enabled);

create policy "admins manage all species"
  on public.species for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.species to anon;
grant select, insert, update, delete on public.species to authenticated;

insert into public.species (id, key, display_name, enabled, sort_order) values
  ('a0000000-5000-0000-0000-000000000001', 'dog', 'Dogs', true, 1),
  ('a0000000-5000-0000-0000-000000000002', 'cat', 'Cats', true, 2),
  ('a0000000-5000-0000-0000-000000000003', 'rabbit', 'Rabbits', true, 3),
  ('a0000000-5000-0000-0000-000000000004', 'guinea_pig', 'Guinea pigs', true, 4),
  ('a0000000-5000-0000-0000-000000000005', 'other_small_mammal', 'Other small companion mammals', true, 5),
  ('a0000000-5000-0000-0000-000000000006', 'bird', 'Birds', false, 6),
  ('a0000000-5000-0000-0000-000000000007', 'reptile_amphibian', 'Reptiles & amphibians', false, 7),
  ('a0000000-5000-0000-0000-000000000008', 'fish', 'Ornamental fish', false, 8),
  ('a0000000-5000-0000-0000-000000000009', 'exotic', 'Exotic animals', false, 9),
  ('a0000000-5000-0000-0000-000000000010', 'horse', 'Horses & other large animals', false, 10);

-- breeds: every existing breed in this database is a dog breed.
alter table public.breeds
  add column species_id uuid not null default 'a0000000-5000-0000-0000-000000000001'
    references public.species (id);

-- animals: same default reasoning — every existing row (breeder puppies, adoption listings,
-- private rehoming, transport-only snapshots) is a dog, and every existing insert path (none of
-- which set species_id yet) keeps working unchanged.
alter table public.animals
  add column species_id uuid not null default 'a0000000-5000-0000-0000-000000000001'
    references public.species (id);

-- Index for the marketplace's eventual "filter by species" query — not used by any UI yet.
create index animals_species_id_idx on public.animals (species_id);
create index breeds_species_id_idx on public.breeds (species_id);
