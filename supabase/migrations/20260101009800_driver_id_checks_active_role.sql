-- Stage BD (supplemental queue): driver onboarding/eligibility. Found the exact same bug class
-- already fixed for organisation ownership in an earlier session
-- (20260101006100_owns_org_checks_active_role.sql: "owns_org()-gated policies checked only
-- organisations.owner_user_id, never user_roles.status -- suspending the exact role that earned
-- someone their organisation... had no effect on their ability to keep managing it") -- but never
-- applied to drivers. is_my_driver_id() (20260101004500_driver_workspace_access.sql) only ever
-- checked `drivers.profile_id = auth.uid()`, never whether the caller's 'driver' role is still
-- active. An admin suspending a problem driver's role (the exact mechanism proven to work for
-- ops/breeder/foundation/shelter roles in tests/db/workflows.test.ts) had zero effect on that
-- driver's real access -- they could keep viewing and updating their assigned transport requests
-- and route stops, a genuine "suspended-member access" gap.
create or replace function public.is_my_driver_id(p_driver_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.drivers
    where id = p_driver_id and profile_id = auth.uid() and public.has_role(auth.uid(), 'driver')
  );
$$;

-- is_assigned_driver_for_request() (transport_status_history's "assigned drivers view and log
-- status on their own requests" policy) has its own independent profile_id = auth.uid() check --
-- same bug, same fix, applied separately since it never called is_my_driver_id() to inherit the
-- first fix automatically.
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
    where tr.id = p_transport_request_id
      and d.profile_id = auth.uid()
      and public.has_role(auth.uid(), 'driver')
  );
$$;

-- Two more independent instances of the exact same unprotected join, found by grepping every
-- "d.profile_id = auth.uid()" pattern in the schema after fixing the two above: "assigned drivers
-- view documents for their active jobs" (transport_documents) and "assigned drivers read files for
-- their active jobs" (Storage, transport-documents bucket). Same fix, same reasoning.
drop policy "assigned drivers view documents for their active jobs" on public.transport_documents;

create policy "assigned drivers view documents for their active jobs"
  on public.transport_documents for select
  to authenticated
  using (
    exists (
      select 1 from public.transport_requests tr
      join public.drivers d on d.id = tr.assigned_driver_id
      where tr.id = transport_request_id
        and d.profile_id = (select auth.uid())
        and public.has_role(auth.uid(), 'driver')
        and tr.status not in ('draft', 'submitted', 'rejected', 'cancelled_by_customer', 'cancelled_by_operations')
    )
  );

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
        and public.has_role(auth.uid(), 'driver')
        and tr.status not in ('draft', 'submitted', 'rejected', 'cancelled_by_customer', 'cancelled_by_operations')
    )
  );
