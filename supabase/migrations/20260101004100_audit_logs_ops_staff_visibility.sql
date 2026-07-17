-- Same class of gap as 20260101004000 (notifications): "ops staff and admins write audit logs"
-- lets ops staff insert, but the only SELECT policy is admin-only, so an ops-staff insert that
-- ever requests the row back (INSERT ... RETURNING) fails RLS. Today's app code inserts without
-- .select() so this hasn't surfaced as a user-facing bug, but ops staff having no visibility into
-- the audit trail they themselves generate is also just a real product gap on its own.
create policy "ops staff view audit logs"
  on public.audit_logs for select
  to authenticated
  using (public.is_ops_staff());
