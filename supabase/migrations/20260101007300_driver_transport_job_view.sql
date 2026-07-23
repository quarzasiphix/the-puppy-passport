-- docs/adr/TRANSPORT_DATA_MODEL.md, "preparing the minimum driver job view": src/lib/queries/
-- driver.ts already does real column minimization at the application level (a narrow select list,
-- confirmed via direct read — never `select("*")`), but that discipline exists only in application
-- code. This adds the same minimization at the database layer as defense in depth: a raw API call
-- or a future careless `select("*")` in a new driver-facing query still cannot regain access to
-- payer/owner/compliance/internal-review columns RLS alone cannot hide (RLS is row-level, not
-- column-level).
--
-- `with (security_invoker = true)` — deliberately the opposite convention from the public-facing
-- definer views elsewhere in this schema (public_transport_requests, public_routes, etc.), because
-- this view is not blanket-public: it must still be scoped per-caller to only the specific request
-- they're assigned to. security_invoker means the view runs with the *calling* role's own
-- privileges, so the underlying transport_requests row-level RLS ("assigned drivers view their own
-- requests") still applies exactly as before — this view only narrows which *columns* come back,
-- never which *rows*.
create view public.driver_transport_job_view
with (security_invoker = true)
as
select
  tr.id,
  tr.request_number,
  tr.status,
  tr.pickup_country, tr.pickup_city, tr.pickup_area_approx, tr.pickup_address_exact,
  tr.destination_country, tr.destination_city, tr.destination_area_approx, tr.destination_address_exact,
  tr.earliest_date, tr.latest_date, tr.flexible_dates, tr.delivery_type,
  tr.animal_name, tr.breed_free_text, tr.sex, tr.weight_kg, tr.size_category,
  tr.crate_requirements, tr.behavioural_notes, tr.anxiety_or_aggression_notes,
  tr.can_travel_with_others,
  tr.release_authorized_by, tr.receive_authorized_by,
  tr.assigned_driver_id, tr.assigned_route_id, tr.assigned_vehicle_id
from public.transport_requests tr
where tr.assigned_driver_id is not null;

grant select on public.driver_transport_job_view to authenticated;
