-- 20260101002000_messaging.sql's "participants view their conversations" policy wrote
-- `cp.conversation_id = id` inside a correlated subquery aliased `cp` on conversation_participants.
-- Since conversation_participants also has its own `id` column, Postgres resolved the bare `id` to
-- the subquery's own table (cp.id) instead of the outer conversations row — so the check became
-- "does a participant row exist whose conversation_id equals its own id", which is never true. This
-- silently made every conversation invisible to its own participants (not even a permission error,
-- just an empty result), only found by testing an actual read after start_application_conversation
-- succeeded. Fixed by qualifying the outer reference explicitly.
drop policy "participants view their conversations" on public.conversations;

create policy "participants view their conversations"
  on public.conversations for select
  to authenticated
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversations.id
        and cp.profile_id = (select auth.uid())
    )
  );
