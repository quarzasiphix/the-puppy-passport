-- Public-safe planned routes: approximate region/dates/capacity only — never exact stops,
-- customer names, driver names, vehicle registration, private times or internal margins. Same
-- "definer view, not security_invoker" pattern as public_transport_requests, for the same reason
-- (the base `routes`/`route_assignments` tables have no anon-facing RLS policy at all).
create view public.public_routes
as
select
  r.id,
  r.route_number,
  r.route_name,
  r.departure_date,
  r.origin_country,
  r.origin_region,
  r.destination_countries,
  r.destination_regions,
  r.status,
  r.max_capacity,
  greatest(0, r.max_capacity - count(ra.id) filter (where ra.reservation_status not in ('released', 'cancelled', 'expired')))::int as available_capacity
from public.routes r
left join public.route_assignments ra on ra.route_id = r.id
where r.status in ('planning', 'confirmed')
group by r.id;

grant select on public.public_routes to anon, authenticated;
