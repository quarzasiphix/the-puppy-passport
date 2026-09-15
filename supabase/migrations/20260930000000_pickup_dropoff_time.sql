-- Same split already applied to ordering (20260928000000_pickup_dropoff_order.sql): a planned
-- time was a single field per animal, unable to express "pick this one up at 2pm, drop it off at
-- 6pm" — two different moments, not one. trip_stops had no planned-time field at all (only
-- picked_up_at/delivered_at, the ACTUAL timestamp once a stop is marked done — those stay
-- untouched, this is the separate "when is it scheduled" concept). route_stops' single
-- planned_time is replaced the same way stop_order was: backfilled into pickup_time, then dropped.

alter table public.trip_stops add column pickup_time timestamptz, add column dropoff_time timestamptz;

alter table public.route_stops add column pickup_time timestamptz, add column dropoff_time timestamptz;
update public.route_stops set pickup_time = planned_time;
alter table public.route_stops drop column planned_time;
