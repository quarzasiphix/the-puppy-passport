-- Stage IR-13 (integration-readiness queue): migration rehearsal. Auditing every SECURITY DEFINER
-- function's grants (not just RLS/search_path, already clean) found a real, previously
-- undiscovered information-disclosure gap: has_role(p_user_id uuid, p_role platform_role) was
-- never explicitly revoked from PUBLIC -- unlike every other role-check helper in this schema
-- (is_admin(), is_moderator(), owns_org(), is_org_member(), etc.), which all either take no
-- argument or a resource id and only ever answer "does the calling user (auth.uid()) have this
-- relationship" -- has_role() uniquely accepts an arbitrary p_user_id, so its default PostgreSQL
-- grant (every new function is PUBLIC-executable unless explicitly revoked) meant any caller,
-- including an unauthenticated one via PostgREST's exposed /rpc/has_role endpoint, could probe
-- any real profile id and learn whether that specific person currently holds any given platform
-- role (admin, moderator, operations, driver, breeder, foundation_member, ...) -- a direct role-
-- membership enumeration oracle over arbitrary users, useful for targeting staff accounts.
--
-- First draft of this migration claimed every real call site routes through another SECURITY
-- DEFINER function (which executes has_role() under its own owner privileges, so a bare PUBLIC
-- revoke would be invisible to them) and that has_role() was "never called directly from any RLS
-- policy body" -- caught wrong by running the full test suite before committing: two policies
-- added in 20260101009800_driver_id_checks_active_role.sql ("assigned drivers view documents for
-- their active jobs" on transport_documents, and "assigned drivers read files for their active
-- jobs" on storage.objects) call `public.has_role(auth.uid(), 'driver')` directly inline in their
-- `using()` clause, not through a wrapper -- RLS policy bodies evaluate as the real querying role
-- (authenticated), not under any SECURITY DEFINER elevation, so revoking PUBLIC alone broke both
-- real driver-access paths (confirmed by the failing "assigned-driver document access" test).
--
-- Real fix: add is_active_driver() -- a no-argument SECURITY DEFINER wrapper, the exact same
-- shape as is_admin()/is_moderator()/is_ops_staff(), only ever answering "is the calling user
-- currently an active driver" -- and point both policies at it instead of calling has_role()
-- directly. Only a wrapper with no cross-user parameter is safe to leave broadly executable; the
-- underlying has_role(p_user_id, p_role) stays fully revoked from PUBLIC, since nothing legitimate
-- needs to call it with anything other than auth.uid() ever again.
create or replace function public.is_active_driver()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.has_role(auth.uid(), 'driver');
$$;

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
        and public.is_active_driver()
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
        and public.is_active_driver()
        and tr.status not in ('draft', 'submitted', 'rejected', 'cancelled_by_customer', 'cancelled_by_operations')
    )
  );

-- Now safe: every remaining real call site (grep -rn "has_role(" across the whole codebase) is
-- either auth.uid() from inside another SECURITY DEFINER function (is_admin, is_moderator,
-- is_ops_staff, is_my_driver_id, is_assigned_driver_for_request, is_active_driver) or a resource-
-- derived id from inside owns_org() -- none of those need has_role() itself directly grantable,
-- and it is no longer called from any RLS policy body either. Zero direct `.rpc("has_role", ...)`
-- callers anywhere in src/ or tests/.
revoke execute on function public.has_role(uuid, public.platform_role) from public;
