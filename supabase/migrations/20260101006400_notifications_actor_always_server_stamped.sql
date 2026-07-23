-- Hardening found while auditing 20260101006200_notifications_actor_visibility.sql immediately
-- after it shipped: stamp_notification_actor() only filled actor_profile_id when the client left it
-- null, so any authenticated user inserting their own notification (allowed by the pre-existing
-- "users manage their own notifications" policy) could explicitly set actor_profile_id to someone
-- else's id. That never granted the forger extra access (it's still their own profile_id row), but
-- it let them plant a row that a different, unrelated user would then see via "actors view
-- notifications they personally sent" — a real integrity gap on a column whose only job is
-- accurate attribution. actor_profile_id is now always server-set from auth.uid(), the same way
-- transport_requests.requester_profile_id and animals.owner_profile_id are never trusted from the
-- client body — never client-supplied, regardless of what the insert payload contains.
create or replace function public.stamp_notification_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.actor_profile_id := auth.uid();
  return new;
end;
$$;
