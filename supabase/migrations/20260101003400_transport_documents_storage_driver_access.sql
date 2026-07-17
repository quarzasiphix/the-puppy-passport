-- Matches 20260101003300_transport_documents_driver_access.sql at the storage layer: the actual
-- files in the private `transport-documents` bucket need the same driver-while-assigned read
-- policy, otherwise an assigned driver could see a document row but get denied downloading the
-- file itself.
create policy "assigned drivers read files for their active jobs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'transport-documents'
    and exists (
      select 1 from public.transport_requests tr
      join public.drivers d on d.id = tr.assigned_driver_id
      where tr.id = (storage.foldername(name))[1]::uuid
        and d.profile_id = (select auth.uid())
        and tr.status not in ('draft', 'submitted', 'rejected', 'cancelled_by_customer', 'cancelled_by_operations')
    )
  );
