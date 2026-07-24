-- Stage CJF (third/fourth supplemental queue): immutable lifecycle history. `transport_status_
-- history` is meant to be the permanent, trustworthy record of what actually happened during a
-- delivery -- it feeds the customer-facing timeline (transportMilestones), backs dispute
-- resolution, and is the audit trail advance_transport_job_status()'s evidence photos attach to.
-- Both existing write policies were `for all`, not `for insert` -- "ops staff manage all status
-- history" and "assigned drivers view and log status on their own requests" -- meaning both ops/
-- admin AND the assigned driver could UPDATE or DELETE an existing historical row, not just
-- append new ones. Grepped every real call site in src/lib/queries/*.ts: every single one is
-- either `.insert(` or `.select(` -- zero UPDATE/DELETE anywhere in the real app -- so narrowing
-- this closes a real, reachable-via-raw-API gap (a driver could retroactively edit or delete
-- evidence of their own past status change) with zero effect on any real code path.
--
-- Matches `audit_logs`' own existing precedent exactly: that table has never had an update/delete
-- policy for anyone, not even admin, since Stage AE. History here follows the same discipline --
-- fully immutable via the Data API for everyone, including ops/admin. A genuine future correction
-- need would go through direct database access (service role), never the app's normal RLS path.
drop policy "ops staff manage all status history" on public.transport_status_history;
create policy "ops staff view all status history"
  on public.transport_status_history for select
  to authenticated
  using (public.is_ops_staff());

create policy "ops staff log status on any request"
  on public.transport_status_history for insert
  to authenticated
  with check (public.is_ops_staff());

drop policy "assigned drivers view and log status on their own requests" on public.transport_status_history;
create policy "assigned drivers view status on their own requests"
  on public.transport_status_history for select
  to authenticated
  using (public.is_assigned_driver_for_request(transport_request_id));

create policy "assigned drivers log status on their own requests"
  on public.transport_status_history for insert
  to authenticated
  with check (public.is_assigned_driver_for_request(transport_request_id));

-- Belt and suspenders, matching this session's own established pattern (Stage BR): with no
-- update/delete policy left for anyone, the original centralized grant
-- (20260101002900_table_grants.sql, `select, insert, update, delete ... to authenticated`) is now
-- purely inert for update/delete -- explicitly revoking it removes the "why is delete granted
-- with no policy" confusion for a future reader and closes the same gap at both layers, the same
-- reasoning already applied to `audit_logs` (which never had an update/delete policy to begin
-- with, and is left as-is here since it was already correct).
revoke update, delete on public.transport_status_history from authenticated;
