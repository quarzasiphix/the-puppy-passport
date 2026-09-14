-- Driver reputation (services/fleet.ts's getDriverStats()) needs a transport-company caller to be
-- able to read driver_rating on reviews for jobs assigned to their OWN fleet — today
-- transport_reviews only has "requesters manage their own review" and "ops staff view all
-- reviews", so a company reading its own driver's ratings would get nothing back. This is an
-- additional permissive SELECT policy (Postgres OR's multiple permissive policies together), so it
-- only adds visibility and cannot narrow either existing policy.
--
-- Mirrors the exact condition "company members view jobs assigned to their fleet" already uses on
-- transport_requests itself (20260912150000_fleet_multi_tenancy.sql), just joined one hop further
-- through transport_request_id.
create policy "company members view reviews for their fleet's jobs"
  on public.transport_reviews for select to authenticated
  using (
    exists (
      select 1 from public.transport_requests tr
      where tr.id = transport_request_id
        and (
          (tr.assigned_driver_id is not null and exists (
            select 1 from public.drivers d where d.id = tr.assigned_driver_id
              and d.organization_id is not null and public.is_org_member(d.organization_id)))
          or (tr.assigned_vehicle_id is not null and exists (
            select 1 from public.vehicles v where v.id = tr.assigned_vehicle_id
              and v.organization_id is not null and public.is_org_member(v.organization_id)))
        )
    )
  );
