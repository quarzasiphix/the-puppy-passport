-- Fixes OPEN FINDING #3 (docs/DATABASE_TESTING.md, tests/db/security-regressions.test.ts "an org
-- owner notifying an applicant currently fails"). Root cause found by reproducing the exact insert
-- directly against the local database (with vs. without a RETURNING clause): the INSERT itself was
-- never the problem — "org owners notify applicants to their organisation"
-- (20260101004900_notifications_org_owner_notify_applicants.sql) evaluates correctly and the row
-- goes in. The 42501 only appears when the caller also asks for the row back (PostgREST's default
-- `.insert(...).select(...)`, and any `Prefer: return=representation` request), because Postgres
-- requires a SELECT-visible row for RETURNING to work, and notifications had no SELECT policy
-- letting an org owner see a notification once it's filed under the *applicant's* profile_id — only
-- "users manage their own notifications" (viewer = recipient) and the moderator/admin policy
-- existed for SELECT.
--
-- The fix is a real actor column (mirrors audit_logs.actor_profile_id, already established
-- elsewhere in this schema), stamped automatically so no application code has to change, plus a
-- SELECT policy scoped to "you can see notifications you personally sent" — deliberately narrower
-- than "you can see all notifications belonging to your applicants", which would let a breeder
-- read notifications sent to a buyer by ops/admin/other unrelated senders.
alter table public.notifications
  add column actor_profile_id uuid references public.profiles (id);

comment on column public.notifications.actor_profile_id is
  'Who triggered this notification (null for system-generated ones) — lets the sender see the row they just created without granting them visibility into everything the recipient has ever received.';

create or replace function public.stamp_notification_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.actor_profile_id is null then
    new.actor_profile_id := auth.uid();
  end if;
  return new;
end;
$$;

create trigger stamp_notification_actor
  before insert on public.notifications
  for each row execute function public.stamp_notification_actor();

create policy "actors view notifications they personally sent"
  on public.notifications for select
  to authenticated
  using (actor_profile_id = (select auth.uid()));
