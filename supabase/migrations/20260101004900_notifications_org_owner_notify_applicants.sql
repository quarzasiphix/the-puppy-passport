-- respondToApplication() (src/lib/queries/applications.ts) notifies the buyer from the breeder's
-- own session when they approve/reject/request info on an application. The only existing insert
-- policy for notifying *another* user is moderator/admin-only (see
-- 20260101003900_notifications_admin_create.sql), so a regular breeder responding to an
-- application would get a 42501 the moment this shipped — caught here before it reached a real
-- breeder account, by the same "who is actually allowed to write this row" check used throughout
-- this project's RLS work. Scoped narrowly: an org owner may only notify a profile that has
-- actually applied to their organisation, not any arbitrary user (keeps this from becoming a spam
-- vector).
create policy "org owners notify applicants to their organisation"
  on public.notifications for insert
  to authenticated
  with check (
    exists (
      select 1 from public.buyer_applications ba
      where ba.buyer_id = profile_id
        and ba.organization_id is not null
        and public.owns_org(ba.organization_id)
    )
  );
