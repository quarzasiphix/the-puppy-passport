-- Animal-related products/services architecture (docs/PRODUCT_VISION.md hierarchy pillar 8,
-- docs/IMPLEMENTATION_PLAN.md phase 16). Deliberately schema-only and entirely disabled this
-- pass — this phase's own brief is "prepare the architecture... keep these categories disabled
-- until the animal marketplace is stable", not to build a working marketplace for them. No
-- listing table, query layer, or UI exists yet; nothing references this table.
--
-- A single `config` jsonb column (rather than five separate normalised tables for
-- listing_fields/seller_eligibility/moderation_level/legal_requirements/transaction_actions/
-- delivery_options) is deliberate: every one of those varies completely by category, nothing
-- currently reads or writes them, and building five real tables for a feature with zero consumers
-- would be exactly the kind of premature abstraction worth avoiding — see CLAUDE.md. When a
-- specific category is actually activated, its config shape should be finalised against that
-- category's real requirements, not guessed here.
create type public.product_service_category_group as enum ('physical_product', 'service');

create table public.product_service_categories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  display_name text not null,
  category_group public.product_service_category_group not null,
  -- Never true by default — see file header. Only an admin can flip this once a category is
  -- actually ready to launch, which is a deliberate future decision, not a migration default.
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.product_service_categories enable row level security;

create policy "enabled categories are publicly readable"
  on public.product_service_categories for select
  to anon, authenticated
  using (enabled);

create policy "admins manage all product/service categories"
  on public.product_service_categories for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.product_service_categories to anon;
grant select, insert, update, delete on public.product_service_categories to authenticated;

-- Real rows, all disabled — a fixed, deliberately-scoped list (see docs/PRODUCT_VISION.md "It is
-- not: a general marketplace" — cars/electronics/furniture/tools are never acceptable additions
-- here, no matter how this table is later extended).
insert into public.product_service_categories (key, display_name, category_group, sort_order) values
  ('animal_food', 'Animal food', 'physical_product', 1),
  ('accessories', 'Accessories', 'physical_product', 2),
  ('carriers_crates', 'Carriers & crates', 'physical_product', 3),
  ('kennel_equipment', 'Kennel equipment', 'physical_product', 4),
  ('aquariums_terrariums', 'Aquariums & terrariums', 'physical_product', 5),
  ('equestrian_equipment', 'Equestrian equipment', 'physical_product', 6),
  ('transport_trailers', 'Animal transport trailers', 'physical_product', 7),
  ('veterinary_services', 'Veterinary services', 'service', 8),
  ('trainers', 'Trainers', 'service', 9),
  ('behaviourists', 'Behaviourists', 'service', 10),
  ('groomers', 'Groomers', 'service', 11),
  ('pet_hotels', 'Pet hotels', 'service', 12),
  ('photographers', 'Photographers', 'service', 13),
  ('exhibitions_events', 'Exhibitions & events', 'service', 14);
