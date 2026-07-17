-- Part of task #31 (document/compliance review refinement, see docs/IMPLEMENTATION_PLAN.md #10:
-- "driver access only when operationally assigned"). Until now `transport_documents` had no driver
-- policy at all, so a driver could never see the passport/vaccination/health-certificate documents
-- for a job they're actually driving — this closes that gap without opening documents to drivers
-- generally (read-only, and only while they are the request's currently assigned driver, and only
-- once the request has left draft/rejected/cancelled states).
create policy "assigned drivers view documents for their active jobs"
  on public.transport_documents for select
  to authenticated
  using (
    exists (
      select 1 from public.transport_requests tr
      join public.drivers d on d.id = tr.assigned_driver_id
      where tr.id = transport_request_id
        and d.profile_id = (select auth.uid())
        and tr.status not in ('draft', 'submitted', 'rejected', 'cancelled_by_customer', 'cancelled_by_operations')
    )
  );
