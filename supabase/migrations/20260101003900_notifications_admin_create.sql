-- "users manage their own notifications" (for all, profile_id = auth.uid()) means nobody can ever
-- insert a notification FOR someone else — but the rehoming-review admin action needs to notify
-- the dog's owner when their submission is approved/rejected. Scoped narrowly to staff (not open
-- to any user notifying any other user, which would just be a spam vector) since that's the only
-- place this is used today.
create policy "moderators and admins create notifications for any user"
  on public.notifications for insert
  to authenticated
  with check (public.is_moderator());
