-- Breeder social layer, stage 4: controlled kennel-page configuration (theme, section
-- visibility/order, language, contact mode, branding) — not a free-form website builder. One row
-- per organisation; the same row is meant to power the standard anemalo.com/kennels/:slug page
-- today and a future subdomain/custom-domain render (20260903000500) without duplicating content
-- into a separate website-specific table.

create type public.kennel_theme as enum ('classic', 'editorial', 'modern');
create type public.kennel_contact_mode as enum ('anemalo', 'external', 'both');

-- The controlled set of sections a kennel page may show/order. Adding a new section later is a
-- one-line `alter type ... add value`, matching this schema's established enum-widening pattern —
-- never an arbitrary client-supplied string.
create type public.kennel_section as enum (
  'about', 'gallery', 'posts', 'dogs', 'litters', 'planned_litters', 'listings',
  'pedigrees', 'health', 'achievements', 'reviews', 'transport', 'contact'
);

create table public.organisation_site_configurations (
  organisation_id uuid primary key references public.organisations (id) on delete cascade,
  theme public.kennel_theme not null default 'classic',
  primary_color text,
  logo_asset_id uuid,
  cover_asset_id uuid,
  visible_sections public.kennel_section[] not null default array[
    'about', 'gallery', 'posts', 'dogs', 'litters', 'planned_litters',
    'achievements', 'contact'
  ]::public.kennel_section[],
  section_order public.kennel_section[] not null default array[
    'about', 'gallery', 'posts', 'dogs', 'litters', 'planned_litters',
    'achievements', 'contact'
  ]::public.kennel_section[],
  default_language text not null default 'en',
  supported_languages text[] not null default array['en'],
  contact_mode public.kennel_contact_mode not null default 'anemalo',
  show_anemalo_branding boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organisation_site_configurations_primary_color_format
    check (primary_color is null or primary_color ~ '^#[0-9a-fA-F]{6}$')
);

create trigger set_organisation_site_configurations_updated_at
  before update on public.organisation_site_configurations
  for each row execute function public.set_updated_at();

alter table public.organisation_site_configurations enable row level security;

-- Publicly readable — this is exactly what renders the public kennel page, same visibility as the
-- organisations row itself (see "public reads approved published organisations",
-- 20260101000500_organizations.sql); a kennel that isn't public/approved yet has no page to
-- configure the look of in the first place, but the config row itself carries no private data
-- either way (no addresses, no contact details — those stay on private_addresses/profiles).
create policy "kennel site configuration is publicly readable"
  on public.organisation_site_configurations for select
  to anon, authenticated
  using (true);

create policy "org owners manage their kennel's site configuration"
  on public.organisation_site_configurations for all
  to authenticated
  using (public.owns_org(organisation_id))
  with check (public.owns_org(organisation_id));

create policy "admins manage all kennel site configurations"
  on public.organisation_site_configurations for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.organisation_site_configurations to anon;
grant select, insert, update, delete on public.organisation_site_configurations to authenticated;

-- Plan/capability foundation (Monetization foundation, product brief). A real column an honest
-- capability model can read — never a fabricated per-org value, and never enforced as billing
-- (no payment provider exists yet, see docs/DEFERRED_BACKEND.md). Every existing organisation
-- defaults to 'free', matching current reality exactly.
alter table public.organisations
  add column plan text not null default 'free',
  add constraint organisations_plan_valid check (plan in ('free', 'pro', 'website'));
