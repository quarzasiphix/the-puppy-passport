-- Found while testing 20260101003900: Postgres treats INSERT ... RETURNING like a SELECT for RLS
-- purposes, so a moderator/admin creating a notification for someone else (e.g. after a rehoming
-- review decision) would fail if the insert ever requests the row back, since the only SELECT
-- policy on notifications is "own rows only". The app's notifyUser() doesn't request the row back
-- today so this didn't surface as a user-facing bug, but staff having no way to read back or audit
-- notifications they send is a real gap on its own — added explicitly rather than left as a trap
-- for the next feature that does need it.
create policy "moderators and admins view all notifications"
  on public.notifications for select
  to authenticated
  using (public.is_moderator());
