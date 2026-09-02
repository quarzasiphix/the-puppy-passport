-- European market registry (docs/PRODUCT_VISION.md "Geographic direction", phase 17 in
-- docs/IMPLEMENTATION_PLAN.md). Real, honest per-market availability — no market claims a service
-- level it isn't actually ready for. See docs/DECISIONS.md for the reasoning behind the market
-- state enum.

create type public.market_state as enum (
  'unavailable', 'discovery_only', 'listings_available', 'adoption_available',
  'transport_requests_available', 'partner_transport', 'full_anemalo_service'
);

create table public.markets (
  id uuid primary key default gen_random_uuid(),
  -- ISO 3166-1 alpha-2, not a display name — display_name is the human label.
  country_code text not null unique,
  display_name text not null,
  enabled boolean not null default false,
  default_locale text not null default 'en',
  -- Supported locale variants for this market — a country may have more than one (e.g. Belgium:
  -- nl-BE, fr-BE). Never assumed to be a single language per country.
  supported_locales text[] not null default '{}',
  currency text not null default 'EUR',
  marketplace_state public.market_state not null default 'unavailable',
  breeder_verification_state public.market_state not null default 'unavailable',
  adoption_state public.market_state not null default 'unavailable',
  transport_post_state public.market_state not null default 'unavailable',
  transport_full_state public.market_state not null default 'unavailable',
  fundraising_state public.market_state not null default 'unavailable',
  legal_content_ready boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_markets_updated_at
  before update on public.markets
  for each row execute function public.set_updated_at();

alter table public.markets enable row level security;

create policy "enabled markets are publicly readable"
  on public.markets for select
  to anon, authenticated
  using (enabled);

create policy "admins manage all markets"
  on public.markets for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.markets to anon;
grant select, insert, update, delete on public.markets to authenticated;

-- Initial operational focus per docs/PRODUCT_VISION.md: Poland, Germany, Netherlands, Belgium,
-- Polish/English, PLN/EUR. Honest current state: the app itself is English-only today (see
-- docs/IMPLEMENTATION_PLAN.md phase 14/this migration's own follow-up) even though Polish is the
-- named initial language, so no market is marked ready for "full_anemalo_service" by this
-- migration alone -- that would overclaim readiness this schema change didn't itself deliver.
insert into public.markets (
  country_code, display_name, enabled, default_locale, supported_locales, currency,
  marketplace_state, breeder_verification_state, adoption_state, transport_post_state,
  transport_full_state, fundraising_state, legal_content_ready
) values
  ('PL', 'Poland', true, 'pl', array['pl', 'en'], 'PLN',
   'transport_requests_available', 'transport_requests_available', 'transport_requests_available',
   'transport_requests_available', 'transport_requests_available', 'unavailable', false),
  ('DE', 'Germany', true, 'de', array['de', 'en'], 'EUR',
   'listings_available', 'listings_available', 'listings_available',
   'transport_requests_available', 'discovery_only', 'unavailable', false),
  ('NL', 'Netherlands', true, 'nl', array['nl', 'en'], 'EUR',
   'listings_available', 'listings_available', 'listings_available',
   'transport_requests_available', 'discovery_only', 'unavailable', false),
  ('BE', 'Belgium', true, 'nl', array['nl-BE', 'fr-BE', 'en'], 'EUR',
   'discovery_only', 'discovery_only', 'discovery_only',
   'transport_requests_available', 'discovery_only', 'unavailable', false);
