-- Ops "Routes" could create a route shell and attach EXISTING transport requests to it, but had no
-- way to actually plan the route itself: routes.vehicle_id/driver_id have existed since the
-- original schema (20260101001700_routes_and_fleet.sql) and route_stops has existed just as long
-- (already read by the driver's own workspace and the calendar view), yet nothing in the app ever
-- wrote to any of them. This brings ops route planning to the same shape as the transport-company
-- Trips feature (trip_stops) already has: each pickup/dropoff stop can carry the animal being
-- handled there plus the address/contact details needed to actually run the stop, while a 'rest'
-- stop leaves those fields null (it isn't about any one animal).
--
-- transport_request_id is a separate, nullable link (not required) — a stop can represent an
-- animal not yet a formal transport_request, exactly like trip_stops.animal_label already allows
-- for a transport company's own trips.
alter table public.route_stops
  add column animal_label text,
  add column transport_request_id uuid references public.transport_requests (id) on delete set null,
  add column address_text text,
  add column maps_url text,
  add column contact_name text,
  add column contact_phone text,
  add column notes text;
