-- Stage R (supplemental queue): messaging/conversation security. "participants send messages in
-- their conversations" (20260101002000_messaging.sql) checks sender_profile_id = auth.uid() and
-- conversation membership, but never restricts is_internal -- an ordinary participant's INSERT
-- could set is_internal = true on their own message. is_internal is the real security/visibility
-- gate ("participants view non-internal messages" explicitly filters `not is_internal`, and
-- internal notes are meant to be an ops/staff-only annotation channel layered on top of the same
-- conversation) -- letting any participant set it themselves means an ops-side reader of "internal
-- notes" can no longer trust that everything flagged internal actually came from staff. Not
-- reachable through the real UI today (chat-thread.tsx's only sendMessage() call site never passes
-- isInternal, and no route currently even renders is_internal-gated content), only via a raw API
-- call -- the same "found during an audit, not yet reachable through the app, real via the API"
-- shape as every other lock added this session. Ops staff are unaffected: they already write
-- through the separate "ops staff manage all messages" FOR ALL policy, which has no such
-- restriction.
drop policy "participants send messages in their conversations" on public.messages;

create policy "participants send messages in their conversations"
  on public.messages for insert
  to authenticated
  with check (
    sender_profile_id = (select auth.uid())
    and is_internal = false
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id and cp.profile_id = (select auth.uid())
    )
  );
