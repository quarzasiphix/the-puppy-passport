-- Splits the single stop_order integer into two independent sequences, pickup_order and
-- dropoff_order, on trip_stops and route_stops — one row = one animal continues, but pickups and
-- drop-offs can now be sequenced independently instead of implying a single combined order that
-- couldn't represent a real multi-animal circuit (pick up A, pick up B, drop off A, pick up C,
-- drop off B, drop off C). No new unique constraint: ordering here is a pure UI/display concern,
-- not a data-integrity one — see this migration's own PR description for the non-deferrable
-- UNIQUE (route_id, stop_order) swap-collision bug this deliberately avoids reproducing.

alter table public.trip_stops add column pickup_order integer, add column dropoff_order integer;
update public.trip_stops set pickup_order = stop_order, dropoff_order = stop_order;
alter table public.trip_stops
  alter column pickup_order set not null,
  alter column dropoff_order set not null,
  drop column stop_order;

alter table public.route_stops add column pickup_order integer, add column dropoff_order integer;
update public.route_stops set pickup_order = stop_order, dropoff_order = stop_order;
alter table public.route_stops
  alter column pickup_order set not null,
  alter column dropoff_order set not null,
  drop column stop_order;
