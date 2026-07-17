-- Configurable pricing so the price logic isn't hardcoded in UI components — admins/ops can
-- adjust rules without a code change. This is still a simple linear model (base + additive/
-- multiplicative factors), not a real routing-aware pricing engine.

create type public.pricing_rule_type as enum (
  'base_fee', 'distance_band', 'size_multiplier', 'service_multiplier', 'additional_stop',
  'waiting_time', 'special_crate', 'urgent_planning', 'document_handling', 'country_surcharge',
  'ferry_or_toll_placeholder', 'manual_adjustment'
);

create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  rule_type public.pricing_rule_type not null,
  -- What this rule applies to, e.g. service_multiplier -> 'shared'/'express', size_multiplier ->
  -- 'small'/'giant', distance_band -> '0-300'/'300-800'/'800+'. Null means "applies generally"
  -- (e.g. base_fee).
  applies_to text,
  amount numeric(10, 2) not null,
  is_percentage boolean not null default false,
  currency text not null default 'EUR',
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_pricing_rules_updated_at
  before update on public.pricing_rules
  for each row execute function public.set_updated_at();

alter table public.pricing_rules enable row level security;

create policy "pricing rules are readable by any authenticated or anonymous visitor"
  on public.pricing_rules for select
  to anon, authenticated
  using (active);

create policy "ops staff manage pricing rules"
  on public.pricing_rules for all
  to authenticated
  using (public.is_ops_staff())
  with check (public.is_ops_staff());

insert into public.pricing_rules (rule_type, applies_to, amount, is_percentage, currency, notes) values
  ('base_fee', null, 120, false, 'EUR', 'Flat base fee before any multipliers.'),
  ('distance_band', '0-300', 60, false, 'EUR', 'Up to 300km.'),
  ('distance_band', '300-800', 180, false, 'EUR', '300-800km.'),
  ('distance_band', '800+', 320, false, 'EUR', 'Over 800km.'),
  ('size_multiplier', 'small', 0, true, 'EUR', 'No surcharge for small animals.'),
  ('size_multiplier', 'medium', 10, true, 'EUR', '+10% for medium animals.'),
  ('size_multiplier', 'large', 20, true, 'EUR', '+20% for large animals.'),
  ('size_multiplier', 'giant', 35, true, 'EUR', '+35% for giant animals.'),
  ('service_multiplier', 'shared', -15, true, 'EUR', 'Shared transport discount.'),
  ('service_multiplier', 'individual', 25, true, 'EUR', 'Individual transport surcharge.'),
  ('service_multiplier', 'express', 60, true, 'EUR', 'Express surcharge.'),
  ('service_multiplier', 'vip', 110, true, 'EUR', 'VIP surcharge.'),
  ('service_multiplier', 'recommend_best', 0, true, 'EUR', 'No surcharge — operations picks the best fit.'),
  ('urgent_planning', null, 40, false, 'EUR', 'Applied when flexible_dates = false and earliest_date is soon.'),
  ('document_handling', null, 25, false, 'EUR', 'TRACES / extra document handling.');
