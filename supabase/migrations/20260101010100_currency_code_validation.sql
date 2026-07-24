-- Stage BJ (supplemental queue): country/currency/timezone/unit normalisation. `currency` is
-- free-text with zero validation across every table that has it -- animals, reservations,
-- quotations, pricing_rules, fundraising_campaigns, fundraising_contributions, markets,
-- profiles.preferred_currency. Grepped every currency literal in the schema and seed data: only
-- 'EUR' and 'PLN' are ever used anywhere, matching the real markets this app operates in (Poland
-- on PLN; Germany/Netherlands/Belgium on EUR, per 20260101005800_markets.sql). Some of these
-- columns are writable by a party this session has otherwise treated as "trusted but not fully
-- trusted" (an org sets `animals.currency`/`reservations.currency` on their own rows) -- a
-- CHECK constraint is a real, low-risk data-integrity safeguard against a garbage or malicious
-- value silently landing in a financially-adjacent column, not a hypothetical concern given how
-- much of this session's work has been closing exactly this "row-level access doesn't mean the
-- column's *value* is validated" gap shape.
--
-- Deliberately not a full country/currency/locale normalisation overhaul: `country` remains
-- free-text across most tables (transport_requests, organisations, animals) while only
-- markets.country_code uses ISO 3166-1 alpha-2 -- a real inconsistency, but changing every
-- free-text country column to a constrained reference is a much larger, riskier migration
-- touching existing data across many tables, with no current code path that actually needs the
-- two to interoperate (Stage BI's audit already confirmed nothing joins them together yet).
-- Documented in the progress log as a real, deliberately-deferred normalisation gap rather than
-- rushed here.
alter table public.profiles
  add constraint profiles_preferred_currency_valid check (preferred_currency in ('EUR', 'PLN'));

alter table public.animals
  add constraint animals_currency_valid check (currency is null or currency in ('EUR', 'PLN'));

alter table public.reservations
  add constraint reservations_currency_valid check (currency is null or currency in ('EUR', 'PLN'));

alter table public.quotations
  add constraint quotations_currency_valid check (currency in ('EUR', 'PLN'));

alter table public.pricing_rules
  add constraint pricing_rules_currency_valid check (currency in ('EUR', 'PLN'));

alter table public.fundraising_campaigns
  add constraint fundraising_campaigns_currency_valid check (currency in ('EUR', 'PLN'));

alter table public.fundraising_contributions
  add constraint fundraising_contributions_currency_valid check (currency in ('EUR', 'PLN'));

alter table public.markets
  add constraint markets_currency_valid check (currency in ('EUR', 'PLN'));
