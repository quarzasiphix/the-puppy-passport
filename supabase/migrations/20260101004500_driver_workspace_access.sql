-- Driver workspace (mobile-first, single active route): drivers currently have zero access to
-- their own assigned routes/requests — only "drivers view their own driver record" exists. Adding
-- the minimum needed for a driver to see and update progress on what they're actually driving.
-- SECURITY DEFINER helpers (same reasoning as owns_org()/owns_animal(): keeps the cross-table
-- check out of the calling policy's own expansion, and is reused across four tables below).
create or replace function public.is_my_driver_id(p_driver_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.drivers where id = p_driver_id and profile_id = auth.uid()
  );
$$;

create or replace function public.is_assigned_driver_for_request(p_transport_request_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.transport_requests tr
    join public.drivers d on d.id = tr.assigned_driver_id
    where tr.id = p_transport_request_id and d.profile_id = auth.uid()
  );
$$;

-- routes: driver sees (read-only) the route(s) they're assigned to.
create policy "assigned drivers view their own routes"
  on public.routes for select
  to authenticated
  using (driver_id is not null and public.is_my_driver_id(driver_id));

create policy "assigned drivers view stops on their own routes"
  on public.route_stops for select
  to authenticated
  using (
    exists (
      select 1 from public.routes r
      where r.id = route_id and r.driver_id is not null and public.is_my_driver_id(r.driver_id)
    )
  );

-- transport_requests: driver sees and can progress (pickup confirmed, in transport, delivered,
-- etc.) only the specific request(s) assigned to them — never the full record set ops staff see.
create policy "assigned drivers view their own requests"
  on public.transport_requests for select
  to authenticated
  using (assigned_driver_id is not null and public.is_my_driver_id(assigned_driver_id));

create policy "assigned drivers update status on their own requests"
  on public.transport_requests for update
  to authenticated
  using (assigned_driver_id is not null and public.is_my_driver_id(assigned_driver_id))
  with check (assigned_driver_id is not null and public.is_my_driver_id(assigned_driver_id));

create policy "assigned drivers view and log status on their own requests"
  on public.transport_status_history for all
  to authenticated
  using (public.is_assigned_driver_for_request(transport_request_id))
  with check (public.is_assigned_driver_for_request(transport_request_id));
