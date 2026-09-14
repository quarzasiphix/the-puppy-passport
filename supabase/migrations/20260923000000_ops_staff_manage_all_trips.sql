-- Gives the broader "operations" role the same oversight of transport-company Trips that only
-- true admins had before (see "admins manage all trips"/"admins manage all trip stops",
-- 20260915000000_transport_company_trips.sql) — an ops staffer running the day-to-day dashboard
-- previously had zero RLS access to any company's trip data at all. Deliberately scoped to
-- trips/trip_stops only (not trip_join_requests or the public-visibility columns) — ops oversight
-- means seeing and editing the trip and its stops, not the company-facing join-request/public-
-- listing workflow, which stays exclusively that company's own decision.
create policy "ops staff manage all trips" on public.trips
  for all to authenticated using (public.is_ops_staff()) with check (public.is_ops_staff());

create policy "ops staff manage all trip stops" on public.trip_stops
  for all to authenticated using (public.is_ops_staff()) with check (public.is_ops_staff());
