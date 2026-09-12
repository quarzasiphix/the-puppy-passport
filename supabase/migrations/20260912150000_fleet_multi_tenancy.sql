-- Vehicle + driver-staff multi-tenancy — vehicles/drivers are real, detailed tables but were
-- single-tenant (Anemalo's own internal fleet only, ops-staff-managed). This connects them to
-- transport_company organisations, which already existed as a dead org_type until this session's
-- verification migration. Nullable organization_id: NULL stays Anemalo's own fleet (today's only
-- rows, completely unaffected), non-null is that company's fleet.
--
-- org_member_role already had 'driver'/'transport_coordinator' values sitting unused — this
-- migration is what finally connects them to real operational tables.

alter table public.vehicles add column organization_id uuid references public.organisations(id);
alter table public.drivers  add column organization_id uuid references public.organisations(id);
create index vehicles_organization_id_idx on public.vehicles(organization_id) where organization_id is not null;
create index drivers_organization_id_idx  on public.drivers(organization_id)  where organization_id is not null;

-- Additive only — existing ops-staff ALL policies and the individual driver's own-record SELECT
-- policy are untouched. is_org_member() (not owns_org()) per the confirmed decision: any active
-- company member (owner or a transport_coordinator/driver-role staffer) can manage the fleet day
-- to day, matching the organisation_gallery_images precedent.
create policy "company members manage their own vehicles"
  on public.vehicles for all to authenticated
  using (organization_id is not null and public.is_org_member(organization_id))
  with check (organization_id is not null and public.is_org_member(organization_id));

create policy "company members manage their own drivers"
  on public.drivers for all to authenticated
  using (organization_id is not null and public.is_org_member(organization_id))
  with check (organization_id is not null and public.is_org_member(organization_id));

-- "Jobs" tab, no new columns needed on transport_requests — a company's jobs are simply the
-- requests assigned to their fleet. Deliberately SELECT-only: a transport company never writes
-- transport_requests.status directly (that stays change_ops_request_status()/
-- advance_transport_job_status(), both untouched); the individually assigned driver still updates
-- status through their own existing /dashboard/driver workspace via is_my_driver_id().
create policy "company members view jobs assigned to their fleet"
  on public.transport_requests for select to authenticated
  using (
    (assigned_driver_id is not null and exists (
      select 1 from public.drivers d where d.id = assigned_driver_id
        and d.organization_id is not null and public.is_org_member(d.organization_id)))
    or (assigned_vehicle_id is not null and exists (
      select 1 from public.vehicles v where v.id = assigned_vehicle_id
        and v.organization_id is not null and public.is_org_member(v.organization_id)))
  );
