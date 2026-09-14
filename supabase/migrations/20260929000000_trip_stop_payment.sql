-- Per-animal payment tracking on a Trip: how much to collect and whether it's collected at
-- pickup or drop-off, so a trip's total earnings can be calculated as a straightforward sum
-- instead of living in a notebook/WhatsApp thread. Column shape (numeric(10,2) + a currency
-- CHECK) mirrors every other money column in this schema exactly
-- (20260101010100_currency_code_validation.sql — only EUR/PLN are ever used anywhere in this
-- app, matching the real markets it operates in). trip_stops-only: route_stops' financial side
-- already goes through transport_requests' own quotation/pricing pipeline, which this isn't
-- meant to duplicate — this is specifically for a company's own self-run Trips, which had no
-- financial concept at all until now.
create type public.trip_stop_payment_timing as enum ('pickup', 'dropoff');

alter table public.trip_stops
  add column payment_amount numeric(10, 2),
  add column payment_currency text,
  add column payment_collected_at public.trip_stop_payment_timing;

alter table public.trip_stops
  add constraint trip_stops_payment_currency_valid
  check (payment_currency is null or payment_currency in ('EUR', 'PLN'));
