-- Fixes OPEN FINDING #4 (docs/DATABASE_TESTING.md, tests/db/access-control.test.ts "an assigned
-- driver cannot actually read their job's documents") — the exact same bug class as
-- 20260101005200_fix_conversations_select_column_shadowing.sql, reintroduced via a different pair
-- of same-named columns. "assigned drivers read files for their active jobs"
-- (20260101003400_transport_documents_storage_driver_access.sql) wrote `(storage.foldername(name))`
-- inside a correlated subquery joining `public.drivers d` — and drivers has its own `name` column
-- (the driver's display name, 20260101001700_routes_and_fleet.sql). Postgres resolved the bare
-- `name` to the subquery-local `d.name` instead of the outer `storage.objects.name`, so the folder
-- path being parsed was the driver's own name string, never the actual object key — silently
-- blocking every assigned driver from their own job's documents. Fixed by qualifying the outer
-- reference explicitly, same as the conversations fix.
drop policy "assigned drivers read files for their active jobs" on storage.objects;

create policy "assigned drivers read files for their active jobs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'transport-documents'
    and exists (
      select 1 from public.transport_requests tr
      join public.drivers d on d.id = tr.assigned_driver_id
      where tr.id = (storage.foldername(storage.objects.name))[1]::uuid
        and d.profile_id = (select auth.uid())
        and tr.status not in ('draft', 'submitted', 'rejected', 'cancelled_by_customer', 'cancelled_by_operations')
    )
  );
